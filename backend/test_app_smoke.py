import psycopg2
import pytest
import os


def _db_url():
    # In CI we set DATABASE_URL. Locally, you can export it too.
    import os

    return os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/antibodylens")


# Ensure the Flask app reads the correct DATABASE_URL on first import.
os.environ.setdefault("DATABASE_URL", _db_url())


def _bootstrap_minimal_data():
    """
    Seed a tiny dataset without calling UniProt.
    Assumes schema.sql has already been applied (CI step).
    """
    import os
    os.environ["DATABASE_URL"] = _db_url()

    try:
        conn = psycopg2.connect(_db_url())
    except Exception as e:
        pytest.skip(f"Database not reachable for tests: {e}")
    conn.autocommit = True
    cur = conn.cursor()

    try:
        # Clear demo rows (idempotent)
        cur.execute("DELETE FROM antibodies")
        cur.execute("DELETE FROM targets")

        cur.execute(
            """
            INSERT INTO targets (uniprot_id, gene_name, protein_name, organism, function_summary)
            VALUES ('P04637', 'TP53', 'Cellular tumor antigen p53', 'Homo sapiens', NULL)
            RETURNING id
            """
        )
        target_id = cur.fetchone()[0]

        cur.execute(
            """
            INSERT INTO antibodies (ab_registry_id, catalog_number, vendor, clone_name, host_species,
                                   clonality, isotype, target_id)
            VALUES ('AB_123456', 'ab123', 'DemoVendor', 'AA-12', 'Mouse',
                    'Monoclonal', 'IgG1', %s)
            RETURNING id
            """,
            (target_id,),
        )
        ab_id = cur.fetchone()[0]

        cur.execute(
            """
            INSERT INTO validations (antibody_id, application, species_tested, pub_year, citation_count, validated_positive)
            VALUES (%s, 'IHC', 'Human', 2024, 50, TRUE),
                   (%s, 'WB',  'Human', 2023, 30, TRUE)
            """,
            (ab_id, ab_id),
        )

        # One confidence score row to exercise joins
        cur.execute(
            """
            INSERT INTO confidence_scores (antibody_id, overall_score, citation_score, application_breadth,
                                           recency_score, positive_rate, total_validations)
            VALUES (%s, 7.50, 6.00, 4.00, 8.00, 100.00, 2)
            ON CONFLICT (antibody_id) DO UPDATE SET
              overall_score = EXCLUDED.overall_score
            """,
            (ab_id,),
        )
    except Exception as e:
        pytest.skip(f"Database not initialized for tests (run schema.sql): {e}")
    finally:
        cur.close()
        conn.close()


def test_health_endpoint():
    from app import app

    client = app.test_client()
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.is_json
    assert resp.get_json().get("status") == "ok"


def test_search_requires_min_length():
    _bootstrap_minimal_data()
    from app import app

    client = app.test_client()
    resp = client.get("/api/targets/search?q=T")
    # Note: connection happens before handler; CI provides DB.
    assert resp.status_code == 400


def test_cell_map_returns_json():
    _bootstrap_minimal_data()
    from app import app

    client = app.test_client()
    resp = client.get("/api/cell-map")
    assert resp.status_code == 200
    assert resp.is_json
    data = resp.get_json()
    assert "targets" in data
    assert len(data["targets"]) >= 1

