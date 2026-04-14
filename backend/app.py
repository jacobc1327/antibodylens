"""
AntibodyLens API — Flask backend
Run: flask run --debug
"""

import os
import io
import csv
from flask import Flask, jsonify, request, Response
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
from functools import wraps

app = Flask(__name__)

# CORS:
# - Default: permissive (good for local dev)
# - Production: set CORS_ORIGINS="https://your-site.netlify.app,https://yourdomain.com"
_cors_origins = os.getenv("CORS_ORIGINS", "").strip()
if _cors_origins:
    origins = [o.strip() for o in _cors_origins.split(",") if o.strip()]
    CORS(app, resources={r"/api/*": {"origins": origins}})
else:
    CORS(app)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/antibodylens")

# Subcellular location mapping — real biological localizations
# Used by the Living Cell visualization
SUBCELLULAR_LOCATIONS = {
    "TP53":  "nucleus",
    "BRCA1": "nucleus",
    "MYC":   "nucleus",
    "EGFR":  "membrane",
    "HER2":  "membrane",
    "CD8A":  "membrane",
    "PD-L1": "membrane",
    "KRAS":  "membrane",
    "GAPDH": "cytoplasm",
    "ACTB":  "cytoplasm",
    "AKT1":  "cytoplasm",
    "MTOR":  "cytoplasm",
    "VEGFA": "extracellular",
    "TNF":   "extracellular",
    "IL6":   "extracellular",
}


def get_db():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    return conn


def with_db(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        conn = get_db()
        try:
            result = f(conn, *args, **kwargs)
            conn.commit()
            return result
        except Exception as e:
            conn.rollback()
            return jsonify({"error": str(e)}), 500
        finally:
            conn.close()
    return wrapper


# ---------------------------------------------------------------------------
# ROUTES
# ---------------------------------------------------------------------------

@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


# ---------------------------------------------------------------------------
# Living Cell visualization endpoint
# ---------------------------------------------------------------------------

@app.route("/api/cell-map")
@with_db
def get_cell_map(conn):
    """
    GET /api/cell-map
    Returns all targets with subcellular locations, validation stats,
    and per-application breakdowns for the Living Cell visualization.
    """
    cur = conn.cursor()

    # Get targets with aggregate stats
    cur.execute("""
        SELECT t.id, t.gene_name, t.protein_name, t.uniprot_id,
               COUNT(DISTINCT a.id) AS antibody_count,
               COUNT(v.id) AS validation_count,
               ROUND(AVG(cs.overall_score)::numeric, 1) AS avg_score,
               ROUND(MAX(cs.overall_score)::numeric, 1) AS top_score
        FROM targets t
        LEFT JOIN antibodies a ON a.target_id = t.id
        LEFT JOIN validations v ON v.antibody_id = a.id
        LEFT JOIN confidence_scores cs ON cs.antibody_id = a.id
        GROUP BY t.id
        ORDER BY COUNT(v.id) DESC
    """)
    targets = cur.fetchall()

    # Get per-application breakdown for each target
    cur.execute("""
        SELECT t.id AS target_id, v.application, COUNT(*) AS count
        FROM targets t
        JOIN antibodies a ON a.target_id = t.id
        JOIN validations v ON v.antibody_id = a.id
        GROUP BY t.id, v.application
    """)
    app_rows = cur.fetchall()

    # Build lookup: target_id -> {app: count}
    app_map = {}
    for row in app_rows:
        tid = row["target_id"]
        if tid not in app_map:
            app_map[tid] = {}
        app_map[tid][row["application"]] = row["count"]

    # Enrich targets
    result = []
    for t in targets:
        t_dict = dict(t)
        t_dict["subcellular_location"] = SUBCELLULAR_LOCATIONS.get(
            t["gene_name"], "cytoplasm"
        )
        t_dict["by_application"] = app_map.get(t["id"], {})
        result.append(t_dict)

    return jsonify({"targets": result})


# ---------------------------------------------------------------------------
# Search & Autocomplete
# ---------------------------------------------------------------------------

@app.route("/api/targets/search")
@with_db
def search_targets(conn):
    query = request.args.get("q", "").strip()
    if not query or len(query) < 2:
        return jsonify({"error": "Query must be at least 2 characters"}), 400

    cur = conn.cursor()
    cur.execute("""
        SELECT id, uniprot_id, gene_name, protein_name, organism, function_summary
        FROM targets
        WHERE gene_name ILIKE %s OR protein_name ILIKE %s
        ORDER BY
            CASE WHEN gene_name ILIKE %s THEN 0 ELSE 1 END,
            gene_name
        LIMIT 20
    """, (f"%{query}%", f"%{query}%", query))
    results = cur.fetchall()
    return jsonify({"targets": results})


@app.route("/api/targets/autocomplete")
@with_db
def autocomplete_targets(conn):
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"targets": [], "antibodies": []})

    cur = conn.cursor()
    cur.execute("""
        SELECT id, gene_name, protein_name, uniprot_id,
               GREATEST(
                   similarity(gene_name, %s),
                   similarity(protein_name, %s)
               ) AS rank
        FROM targets
        WHERE gene_name ILIKE %s OR protein_name ILIKE %s
        ORDER BY
            CASE WHEN gene_name ILIKE %s THEN 0 ELSE 1 END,
            rank DESC
        LIMIT 8
    """, (query, query, f"%{query}%", f"%{query}%", f"{query}%"))
    targets = cur.fetchall()

    antibodies = []
    if len(query) >= 2:
        cur.execute("""
            SELECT a.id, a.vendor, a.clone_name, a.catalog_number,
                   t.gene_name,
                   cs.overall_score
            FROM antibodies a
            JOIN targets t ON t.id = a.target_id
            LEFT JOIN confidence_scores cs ON cs.antibody_id = a.id
            WHERE a.catalog_number ILIKE %s
               OR a.clone_name ILIKE %s
               OR a.vendor ILIKE %s
            ORDER BY cs.overall_score DESC NULLS LAST
            LIMIT 5
        """, (f"%{query}%", f"%{query}%", f"%{query}%"))
        antibodies = cur.fetchall()

    return jsonify({"targets": targets, "antibodies": antibodies})


@app.route("/api/targets/popular")
@with_db
def popular_targets(conn):
    cur = conn.cursor()
    cur.execute("""
        SELECT t.id, t.gene_name, t.protein_name, t.uniprot_id,
               COUNT(DISTINCT a.id) AS antibody_count,
               COUNT(v.id) AS validation_count,
               ROUND(AVG(cs.overall_score)::numeric, 1) AS avg_score
        FROM targets t
        LEFT JOIN antibodies a ON a.target_id = t.id
        LEFT JOIN validations v ON v.antibody_id = a.id
        LEFT JOIN confidence_scores cs ON cs.antibody_id = a.id
        GROUP BY t.id
        ORDER BY COUNT(v.id) DESC
    """)
    targets = cur.fetchall()
    return jsonify({"targets": targets})


# ---------------------------------------------------------------------------
# Target & Antibody endpoints
# ---------------------------------------------------------------------------

@app.route("/api/targets/<int:target_id>")
@with_db
def get_target(conn, target_id):
    cur = conn.cursor()
    cur.execute("""
        SELECT t.*,
               COUNT(a.id) AS antibody_count
        FROM targets t
        LEFT JOIN antibodies a ON a.target_id = t.id
        WHERE t.id = %s
        GROUP BY t.id
    """, (target_id,))
    target = cur.fetchone()
    if not target:
        return jsonify({"error": "Target not found"}), 404
    return jsonify({"target": target})


@app.route("/api/targets/<int:target_id>/antibodies")
@with_db
def get_antibodies(conn, target_id):
    application = request.args.get("application")
    species = request.args.get("species")
    host = request.args.get("host")
    clonality = request.args.get("clonality")
    sort = request.args.get("sort", "score")
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 25))

    conditions = ["a.target_id = %s"]
    params = [target_id]

    if application:
        conditions.append("EXISTS (SELECT 1 FROM validations v WHERE v.antibody_id = a.id AND v.application = %s)")
        params.append(application)
    if species:
        conditions.append("EXISTS (SELECT 1 FROM validations v WHERE v.antibody_id = a.id AND v.species_tested = %s)")
        params.append(species)
    if host:
        conditions.append("a.host_species = %s")
        params.append(host)
    if clonality:
        conditions.append("a.clonality = %s")
        params.append(clonality)

    where = " AND ".join(conditions)

    sort_map = {
        "score": "cs.overall_score DESC NULLS LAST",
        "citations": "cs.citation_score DESC NULLS LAST",
        "recent": "cs.recency_score DESC NULLS LAST",
        "validations": "cs.total_validations DESC NULLS LAST",
    }
    order = sort_map.get(sort, "cs.overall_score DESC NULLS LAST")
    offset = (page - 1) * per_page
    params_count = list(params)

    cur = conn.cursor()
    cur.execute(f"SELECT COUNT(*) AS total FROM antibodies a WHERE {where}", params_count)
    total = cur.fetchone()["total"]

    params.extend([per_page, offset])
    cur.execute(f"""
        SELECT a.*,
               cs.overall_score, cs.citation_score, cs.application_breadth,
               cs.recency_score, cs.positive_rate, cs.total_validations
        FROM antibodies a
        LEFT JOIN confidence_scores cs ON cs.antibody_id = a.id
        WHERE {where}
        ORDER BY {order}
        LIMIT %s OFFSET %s
    """, params)
    antibodies = cur.fetchall()

    return jsonify({
        "antibodies": antibodies,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    })


@app.route("/api/antibodies/<int:antibody_id>")
@with_db
def get_antibody_detail(conn, antibody_id):
    cur = conn.cursor()
    cur.execute("""
        SELECT a.*,
               t.gene_name, t.protein_name, t.uniprot_id,
               cs.overall_score, cs.citation_score, cs.application_breadth,
               cs.recency_score, cs.positive_rate, cs.total_validations
        FROM antibodies a
        JOIN targets t ON t.id = a.target_id
        LEFT JOIN confidence_scores cs ON cs.antibody_id = a.id
        WHERE a.id = %s
    """, (antibody_id,))
    antibody = cur.fetchone()
    if not antibody:
        return jsonify({"error": "Antibody not found"}), 404

    cur.execute("""
        SELECT application, species_tested, publication_doi, pubmed_id,
               publication_title, journal, pub_year, citation_count, validated_positive
        FROM validations
        WHERE antibody_id = %s
        ORDER BY pub_year DESC, citation_count DESC
    """, (antibody_id,))
    validations = cur.fetchall()

    return jsonify({"antibody": antibody, "validations": validations})


# ---------------------------------------------------------------------------
# Compare & Export
# ---------------------------------------------------------------------------

@app.route("/api/antibodies/compare")
@with_db
def compare_antibodies(conn):
    ids_str = request.args.get("ids", "")
    if not ids_str:
        return jsonify({"error": "Provide antibody IDs as ?ids=1,2,3"}), 400
    try:
        ids = [int(x.strip()) for x in ids_str.split(",") if x.strip()]
    except ValueError:
        return jsonify({"error": "Invalid ID format"}), 400
    if len(ids) > 5:
        return jsonify({"error": "Maximum 5 antibodies"}), 400
    if len(ids) < 2:
        return jsonify({"error": "Need at least 2 antibodies"}), 400

    cur = conn.cursor()
    cur.execute("""
        SELECT a.*, t.gene_name, t.protein_name, t.uniprot_id,
               cs.overall_score, cs.citation_score, cs.application_breadth,
               cs.recency_score, cs.positive_rate, cs.total_validations
        FROM antibodies a
        JOIN targets t ON t.id = a.target_id
        LEFT JOIN confidence_scores cs ON cs.antibody_id = a.id
        WHERE a.id = ANY(%s)
        ORDER BY cs.overall_score DESC NULLS LAST
    """, (ids,))
    antibodies = cur.fetchall()

    comparisons = []
    for ab in antibodies:
        cur.execute("""
            SELECT application, COUNT(*) AS count,
                   ROUND(AVG(CASE WHEN validated_positive THEN 100.0 ELSE 0 END)::numeric, 0) AS success_rate,
                   MAX(pub_year) AS latest_year,
                   SUM(citation_count) AS total_citations
            FROM validations WHERE antibody_id = %s
            GROUP BY application ORDER BY count DESC
        """, (ab["id"],))
        comparisons.append({"antibody": ab, "applications": cur.fetchall()})

    return jsonify({"comparisons": comparisons})


@app.route("/api/targets/<int:target_id>/antibodies/export")
@with_db
def export_antibodies_csv(conn, target_id):
    application = request.args.get("application")
    species = request.args.get("species")
    conditions = ["a.target_id = %s"]
    params = [target_id]
    if application:
        conditions.append("EXISTS (SELECT 1 FROM validations v WHERE v.antibody_id = a.id AND v.application = %s)")
        params.append(application)
    if species:
        conditions.append("EXISTS (SELECT 1 FROM validations v WHERE v.antibody_id = a.id AND v.species_tested = %s)")
        params.append(species)
    where = " AND ".join(conditions)

    cur = conn.cursor()
    cur.execute("SELECT gene_name FROM targets WHERE id = %s", (target_id,))
    target = cur.fetchone()
    gene = target["gene_name"] if target else "unknown"

    cur.execute(f"""
        SELECT a.vendor, a.catalog_number, a.clone_name, a.host_species,
               a.clonality, a.isotype, a.ab_registry_id,
               t.gene_name, t.uniprot_id,
               cs.overall_score, cs.citation_score, cs.application_breadth,
               cs.recency_score, cs.positive_rate, cs.total_validations
        FROM antibodies a
        JOIN targets t ON t.id = a.target_id
        LEFT JOIN confidence_scores cs ON cs.antibody_id = a.id
        WHERE {where}
        ORDER BY cs.overall_score DESC NULLS LAST
    """, params)
    rows = cur.fetchall()

    output = io.StringIO()
    if rows:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename=antibodylens_{gene}.csv"}
    )


@app.route("/api/antibodies/compare/export")
@with_db
def export_comparison_csv(conn):
    ids_str = request.args.get("ids", "")
    try:
        ids = [int(x.strip()) for x in ids_str.split(",") if x.strip()]
    except ValueError:
        return jsonify({"error": "Invalid ID format"}), 400

    cur = conn.cursor()
    cur.execute("""
        SELECT a.vendor, a.catalog_number, a.clone_name, a.host_species,
               a.clonality, a.isotype, a.ab_registry_id,
               t.gene_name, t.uniprot_id,
               cs.overall_score, cs.citation_score, cs.application_breadth,
               cs.recency_score, cs.positive_rate, cs.total_validations
        FROM antibodies a
        JOIN targets t ON t.id = a.target_id
        LEFT JOIN confidence_scores cs ON cs.antibody_id = a.id
        WHERE a.id = ANY(%s)
        ORDER BY cs.overall_score DESC NULLS LAST
    """, (ids,))
    rows = cur.fetchall()

    output = io.StringIO()
    if rows:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=antibodylens_comparison.csv"}
    )


# ---------------------------------------------------------------------------
# Stats & Reference
# ---------------------------------------------------------------------------

@app.route("/api/targets/<int:target_id>/heatmap")
@with_db
def get_validation_heatmap(conn, target_id):
    cur = conn.cursor()
    cur.execute("""
        SELECT a.id AS antibody_id,
               a.vendor || ' ' || COALESCE(a.clone_name, a.catalog_number) AS antibody_label,
               v.application, COUNT(*) AS validation_count,
               AVG(CASE WHEN v.validated_positive THEN 1.0 ELSE 0.0 END) AS success_rate
        FROM antibodies a
        JOIN validations v ON v.antibody_id = a.id
        WHERE a.target_id = %s
        GROUP BY a.id, antibody_label, v.application
        ORDER BY a.id, v.application
    """, (target_id,))
    return jsonify({"heatmap": cur.fetchall()})


@app.route("/api/targets/<int:target_id>/stats")
@with_db
def get_target_stats(conn, target_id):
    cur = conn.cursor()
    cur.execute("""
        SELECT a.id, a.vendor, a.clone_name, a.catalog_number,
               cs.overall_score, cs.total_validations
        FROM antibodies a
        JOIN confidence_scores cs ON cs.antibody_id = a.id
        WHERE a.target_id = %s ORDER BY cs.overall_score DESC LIMIT 10
    """, (target_id,))
    top_antibodies = cur.fetchall()

    cur.execute("""
        SELECT v.application, at.full_name, COUNT(*) AS count
        FROM validations v
        JOIN antibodies a ON a.id = v.antibody_id
        LEFT JOIN application_types at ON at.code = v.application
        WHERE a.target_id = %s GROUP BY v.application, at.full_name ORDER BY count DESC
    """, (target_id,))
    by_application = cur.fetchall()

    cur.execute("""
        SELECT v.pub_year, COUNT(*) AS count
        FROM validations v JOIN antibodies a ON a.id = v.antibody_id
        WHERE a.target_id = %s AND v.pub_year IS NOT NULL
        GROUP BY v.pub_year ORDER BY v.pub_year
    """, (target_id,))
    by_year = cur.fetchall()

    cur.execute("""
        SELECT v.species_tested, COUNT(DISTINCT a.id) AS antibody_count
        FROM validations v JOIN antibodies a ON a.id = v.antibody_id
        WHERE a.target_id = %s AND v.species_tested IS NOT NULL
        GROUP BY v.species_tested ORDER BY antibody_count DESC
    """, (target_id,))
    by_species = cur.fetchall()

    return jsonify({
        "top_antibodies": top_antibodies,
        "by_application": by_application,
        "by_year": by_year,
        "by_species": by_species,
    })


@app.route("/api/applications")
@with_db
def list_applications(conn):
    cur = conn.cursor()
    cur.execute("SELECT * FROM application_types ORDER BY code")
    return jsonify({"applications": cur.fetchall()})


@app.route("/api/admin/recompute-scores", methods=["POST"])
@with_db
def recompute_scores(conn):
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO confidence_scores (antibody_id, overall_score, citation_score,
                                        application_breadth, recency_score, positive_rate,
                                        total_validations, last_computed)
        SELECT a.id,
            ROUND((
                LEAST(LN(GREATEST(SUM(v.citation_count), 1) + 1) * 2, 10) * 0.3 +
                LEAST(COUNT(DISTINCT v.application) * 2.0, 10) * 0.25 +
                LEAST(COALESCE(MAX(v.pub_year) - 2015, 0) * 1.0, 10) * 0.2 +
                LEAST(AVG(CASE WHEN v.validated_positive THEN 10.0 ELSE 0 END), 10) * 0.25
            )::numeric, 2),
            ROUND(LEAST(LN(GREATEST(SUM(v.citation_count), 1) + 1) * 2, 10)::numeric, 2),
            ROUND(LEAST(COUNT(DISTINCT v.application) * 2.0, 10)::numeric, 2),
            ROUND(LEAST(COALESCE(MAX(v.pub_year) - 2015, 0) * 1.0, 10)::numeric, 2),
            ROUND(AVG(CASE WHEN v.validated_positive THEN 100.0 ELSE 0 END)::numeric, 2),
            COUNT(v.id), NOW()
        FROM antibodies a
        LEFT JOIN validations v ON v.antibody_id = a.id
        GROUP BY a.id
        ON CONFLICT (antibody_id) DO UPDATE SET
            overall_score = EXCLUDED.overall_score,
            citation_score = EXCLUDED.citation_score,
            application_breadth = EXCLUDED.application_breadth,
            recency_score = EXCLUDED.recency_score,
            positive_rate = EXCLUDED.positive_rate,
            total_validations = EXCLUDED.total_validations,
            last_computed = NOW()
    """)
    return jsonify({"recomputed": cur.rowcount})


if __name__ == "__main__":
    app.run(debug=True, port=5000)