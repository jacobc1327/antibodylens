"""
AntibodyLens API — Flask backend
Run: flask run --debug
"""

import os
from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
from functools import wraps

app = Flask(__name__)
CORS(app)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/antibodylens")


def get_db():
    """Get a database connection."""
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    return conn


def with_db(f):
    """Decorator to handle DB connection lifecycle."""
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


@app.route("/api/targets/search")
@with_db
def search_targets(conn):
    """
    GET /api/targets/search?q=TP53
    Fuzzy search protein targets by gene name or protein name.
    """
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


@app.route("/api/targets/<int:target_id>")
@with_db
def get_target(conn, target_id):
    """
    GET /api/targets/1
    Get full target info with antibody count.
    """
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
    """
    GET /api/targets/1/antibodies?application=WB&species=Human&sort=score&page=1
    List antibodies for a target with filters, sorting, pagination.
    """
    application = request.args.get("application")
    species = request.args.get("species")
    host = request.args.get("host")
    clonality = request.args.get("clonality")
    sort = request.args.get("sort", "score")  # score, citations, recent
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 25))

    conditions = ["a.target_id = %s"]
    params = [target_id]

    # Filter by application (requires join to validations)
    if application:
        conditions.append("EXISTS (SELECT 1 FROM validations v WHERE v.antibody_id = a.id AND v.application = %s)")
        params.append(application)

    # Filter by tested species
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

    # Count total results
    cur.execute(f"SELECT COUNT(*) AS total FROM antibodies a WHERE {where}", params_count)
    total = cur.fetchone()["total"]

    # Fetch page
    params.extend([per_page, offset])
    cur.execute(f"""
        SELECT a.*,
               cs.overall_score,
               cs.citation_score,
               cs.application_breadth,
               cs.recency_score,
               cs.positive_rate,
               cs.total_validations
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
    """
    GET /api/antibodies/42
    Full antibody detail with all validations.
    """
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

    return jsonify({
        "antibody": antibody,
        "validations": validations,
    })


@app.route("/api/targets/<int:target_id>/heatmap")
@with_db
def get_validation_heatmap(conn, target_id):
    """
    GET /api/targets/1/heatmap
    Returns matrix data for validation coverage heatmap:
    antibodies × applications with validation counts.
    """
    cur = conn.cursor()
    cur.execute("""
        SELECT
            a.id AS antibody_id,
            a.vendor || ' ' || COALESCE(a.clone_name, a.catalog_number) AS antibody_label,
            v.application,
            COUNT(*) AS validation_count,
            AVG(CASE WHEN v.validated_positive THEN 1.0 ELSE 0.0 END) AS success_rate
        FROM antibodies a
        JOIN validations v ON v.antibody_id = a.id
        WHERE a.target_id = %s
        GROUP BY a.id, antibody_label, v.application
        ORDER BY a.id, v.application
    """, (target_id,))

    rows = cur.fetchall()
    return jsonify({"heatmap": rows})


@app.route("/api/targets/<int:target_id>/stats")
@with_db
def get_target_stats(conn, target_id):
    """
    GET /api/targets/1/stats
    Aggregate stats for D3 visualizations.
    """
    cur = conn.cursor()

    # Top antibodies by score
    cur.execute("""
        SELECT a.id, a.vendor, a.clone_name, a.catalog_number,
               cs.overall_score, cs.total_validations
        FROM antibodies a
        JOIN confidence_scores cs ON cs.antibody_id = a.id
        WHERE a.target_id = %s
        ORDER BY cs.overall_score DESC
        LIMIT 10
    """, (target_id,))
    top_antibodies = cur.fetchall()

    # Validation counts by application
    cur.execute("""
        SELECT v.application, at.full_name, COUNT(*) AS count
        FROM validations v
        JOIN antibodies a ON a.id = v.antibody_id
        LEFT JOIN application_types at ON at.code = v.application
        WHERE a.target_id = %s
        GROUP BY v.application, at.full_name
        ORDER BY count DESC
    """, (target_id,))
    by_application = cur.fetchall()

    # Publications by year
    cur.execute("""
        SELECT v.pub_year, COUNT(*) AS count
        FROM validations v
        JOIN antibodies a ON a.id = v.antibody_id
        WHERE a.target_id = %s AND v.pub_year IS NOT NULL
        GROUP BY v.pub_year
        ORDER BY v.pub_year
    """, (target_id,))
    by_year = cur.fetchall()

    # Species coverage
    cur.execute("""
        SELECT v.species_tested, COUNT(DISTINCT a.id) AS antibody_count
        FROM validations v
        JOIN antibodies a ON a.id = v.antibody_id
        WHERE a.target_id = %s AND v.species_tested IS NOT NULL
        GROUP BY v.species_tested
        ORDER BY antibody_count DESC
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
    """GET /api/applications — reference list of application types."""
    cur = conn.cursor()
    cur.execute("SELECT * FROM application_types ORDER BY code")
    return jsonify({"applications": cur.fetchall()})


# ---------------------------------------------------------------------------
# Confidence score computation
# ---------------------------------------------------------------------------

@app.route("/api/admin/recompute-scores", methods=["POST"])
@with_db
def recompute_scores(conn):
    """
    POST /api/admin/recompute-scores
    Recompute confidence scores for all antibodies.
    """
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO confidence_scores (antibody_id, overall_score, citation_score,
                                        application_breadth, recency_score, positive_rate,
                                        total_validations, last_computed)
        SELECT
            a.id,
            -- Overall: weighted combination
            ROUND((
                LEAST(LN(GREATEST(SUM(v.citation_count), 1) + 1) * 2, 10) * 0.3 +  -- citations
                LEAST(COUNT(DISTINCT v.application) * 2.0, 10) * 0.25 +              -- breadth
                LEAST(COALESCE(MAX(v.pub_year) - 2015, 0) * 1.0, 10) * 0.2 +       -- recency
                LEAST(AVG(CASE WHEN v.validated_positive THEN 10.0 ELSE 0 END), 10) * 0.25  -- positive rate
            )::numeric, 2),
            ROUND(LEAST(LN(GREATEST(SUM(v.citation_count), 1) + 1) * 2, 10)::numeric, 2),
            ROUND(LEAST(COUNT(DISTINCT v.application) * 2.0, 10)::numeric, 2),
            ROUND(LEAST(COALESCE(MAX(v.pub_year) - 2015, 0) * 1.0, 10)::numeric, 2),
            ROUND(AVG(CASE WHEN v.validated_positive THEN 100.0 ELSE 0 END)::numeric, 2),
            COUNT(v.id),
            NOW()
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

    count = cur.rowcount
    return jsonify({"recomputed": count})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
