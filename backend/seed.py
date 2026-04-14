"""
seed.py — Populate AntibodyLens DB with real data from UniProt + synthetic validations.

Usage:
    1. Create DB:   createdb antibodylens
    2. Run schema:  psql -d antibodylens -f schema.sql
    3. Seed:        python seed.py

This fetches real protein data from UniProt's public API, then generates
realistic (but synthetic) antibody and validation records for demo purposes.
"""

import os
import json
import random
import requests
import psycopg2

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/antibodylens")

# Common research targets — these are real, heavily-studied proteins
SEED_TARGETS = [
    "TP53", "EGFR", "HER2", "BRCA1", "GAPDH",
    "ACTB", "CD8A", "PD-L1", "VEGFA", "TNF",
    "IL6", "KRAS", "MYC", "AKT1", "MTOR",
]

VENDORS = [
    "Abcam", "Cell Signaling Technology", "Thermo Fisher",
    "Santa Cruz Biotechnology", "Bio-Rad", "BioLegend",
    "R&D Systems", "Sigma-Aldrich", "BD Biosciences", "Novus Biologicals",
]

HOST_SPECIES = ["Rabbit", "Mouse", "Goat", "Rat"]
CLONALITIES = ["Monoclonal", "Polyclonal"]
APPLICATIONS = ["WB", "IHC", "IF", "FC", "ChIP", "ELISA", "IP"]
SPECIES_TESTED = ["Human", "Mouse", "Rat"]

JOURNALS = [
    "Nature", "Science", "Cell", "PNAS", "Nature Methods",
    "Journal of Biological Chemistry", "Cancer Research",
    "Journal of Immunology", "Molecular Cell", "Nature Medicine",
    "eLife", "PLoS ONE", "Scientific Reports", "BMC Biology",
]


def fetch_uniprot_target(gene_name: str) -> dict | None:
    """Fetch protein info from UniProt REST API."""
    url = "https://rest.uniprot.org/uniprotkb/search"
    params = {
        "query": f"gene_exact:{gene_name} AND organism_id:9606 AND reviewed:true",
        "format": "json",
        "size": 1,
    }
    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if not results:
            return None
        entry = results[0]
        return {
            "uniprot_id": entry["primaryAccession"],
            "gene_name": gene_name,
            "protein_name": entry.get("proteinDescription", {})
                .get("recommendedName", {})
                .get("fullName", {})
                .get("value", gene_name),
            "organism": "Homo sapiens",
            "function_summary": next(
                (c["texts"][0]["value"] for c in entry.get("comments", [])
                 if c["commentType"] == "FUNCTION" and c.get("texts")),
                None
            ),
        }
    except Exception as e:
        print(f"  Warning: could not fetch {gene_name} from UniProt: {e}")
        return {
            "uniprot_id": f"UNKNOWN_{gene_name}",
            "gene_name": gene_name,
            "protein_name": gene_name,
            "organism": "Homo sapiens",
            "function_summary": None,
        }


def generate_antibodies(target_id: int, gene_name: str) -> list[dict]:
    """Generate realistic synthetic antibody records."""
    num = random.randint(8, 25)
    antibodies = []
    for i in range(num):
        vendor = random.choice(VENDORS)
        clonality = random.choice(CLONALITIES)
        host = random.choice(HOST_SPECIES)
        clone = None
        if clonality == "Monoclonal":
            clone = f"{''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ', k=2))}-{random.randint(1,99)}"
        antibodies.append({
            "ab_registry_id": f"AB_{random.randint(100000, 999999)}",
            "catalog_number": f"{''.join(random.choices('abcdefghijklmnopqrstuvwxyz', k=2))}{random.randint(1000,99999)}",
            "vendor": vendor,
            "clone_name": clone,
            "host_species": host,
            "clonality": clonality,
            "isotype": random.choice(["IgG", "IgG1", "IgG2a", "IgG2b", "IgM"]) if clonality == "Monoclonal" else "IgG",
            "target_id": target_id,
        })
    return antibodies


def generate_validations(antibody_id: int) -> list[dict]:
    """Generate synthetic validation/publication records."""
    num = random.randint(1, 15)
    validations = []
    for _ in range(num):
        year = random.randint(2010, 2025)
        validations.append({
            "antibody_id": antibody_id,
            "application": random.choice(APPLICATIONS),
            "species_tested": random.choice(SPECIES_TESTED),
            "publication_doi": f"10.{random.randint(1000,9999)}/{''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=8))}",
            "pubmed_id": str(random.randint(20000000, 39999999)),
            "publication_title": f"{''.join(random.choices(['Analysis', 'Characterization', 'Role', 'Targeting', 'Identification', 'Functional', 'Novel'], k=1))[0]} of {random.choice(['signaling', 'expression', 'regulation', 'pathway', 'mechanism'])} in {random.choice(['cancer', 'inflammation', 'development', 'disease', 'immunity'])}",
            "journal": random.choice(JOURNALS),
            "pub_year": year,
            "citation_count": max(0, int(random.gauss(50, 80))),
            "validated_positive": random.random() > 0.15,  # 85% positive rate
        })
    return validations


def main():
    print("Connecting to database...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    print(f"Fetching {len(SEED_TARGETS)} targets from UniProt...\n")

    for gene in SEED_TARGETS:
        print(f"  Fetching {gene}...")
        target = fetch_uniprot_target(gene)
        if not target:
            continue

        cur.execute("""
            INSERT INTO targets (uniprot_id, gene_name, protein_name, organism, function_summary)
            VALUES (%(uniprot_id)s, %(gene_name)s, %(protein_name)s, %(organism)s, %(function_summary)s)
            ON CONFLICT (uniprot_id) DO UPDATE SET gene_name = EXCLUDED.gene_name
            RETURNING id
        """, target)
        target_id = cur.fetchone()[0]

        antibodies = generate_antibodies(target_id, gene)
        for ab in antibodies:
            cur.execute("""
                INSERT INTO antibodies (ab_registry_id, catalog_number, vendor, clone_name,
                                        host_species, clonality, isotype, target_id)
                VALUES (%(ab_registry_id)s, %(catalog_number)s, %(vendor)s, %(clone_name)s,
                        %(host_species)s, %(clonality)s, %(isotype)s, %(target_id)s)
                RETURNING id
            """, ab)
            ab_id = cur.fetchone()[0]

            validations = generate_validations(ab_id)
            for val in validations:
                cur.execute("""
                    INSERT INTO validations (antibody_id, application, species_tested,
                                             publication_doi, pubmed_id, publication_title,
                                             journal, pub_year, citation_count, validated_positive)
                    VALUES (%(antibody_id)s, %(application)s, %(species_tested)s,
                            %(publication_doi)s, %(pubmed_id)s, %(publication_title)s,
                            %(journal)s, %(pub_year)s, %(citation_count)s, %(validated_positive)s)
                """, val)

        print(f"    → {len(antibodies)} antibodies seeded")

    conn.commit()

    # Recompute confidence scores
    print("\nRecomputing confidence scores...")
    cur.execute("""
        INSERT INTO confidence_scores (antibody_id, overall_score, citation_score,
                                        application_breadth, recency_score, positive_rate,
                                        total_validations, last_computed)
        SELECT
            a.id,
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
    conn.commit()
    print("Done! Database seeded successfully.")

    cur.execute("SELECT COUNT(*) FROM targets")
    print(f"  Targets: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM antibodies")
    print(f"  Antibodies: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM validations")
    print(f"  Validations: {cur.fetchone()[0]}")

    conn.close()


if __name__ == "__main__":
    main()
