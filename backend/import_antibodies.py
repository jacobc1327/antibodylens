"""
import_antibodies.py — Import real antibody catalog rows into AntibodyLens.

This script imports antibodies (not validations) from a CSV into Postgres.

Why: real antibody catalogs/registries rarely include validation evidence in a structured way.
You can still browse/filter by vendor/host/clonality/isotype, but confidence scores require
validations + citations.

CSV columns (case-insensitive; extra columns are ignored):
  - gene_name (required unless uniprot_id provided AND target exists)
  - uniprot_id (optional; used when creating missing targets)
  - protein_name (optional)
  - organism (optional; default Homo sapiens)
  - vendor (required)
  - catalog_number (optional)
  - clone_name (optional)
  - host_species (optional)
  - clonality (optional)
  - isotype (optional)
  - ab_registry_id (optional; RRID)

Typical workflow:
  1) Put CSV at backend/data/antibodies.csv
  2) export DATABASE_URL="postgresql://..."
  3) python import_antibodies.py --csv data/antibodies.csv --create-missing-targets
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from dataclasses import dataclass
from typing import Optional

import psycopg2
from psycopg2.extras import RealDictCursor


DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/antibodylens")


def norm(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    v = str(s).strip()
    return v or None


def norm_key(s: str) -> str:
    return s.strip().lower().replace(" ", "_")


@dataclass
class Row:
    gene_name: Optional[str]
    uniprot_id: Optional[str]
    protein_name: Optional[str]
    organism: Optional[str]
    vendor: str
    catalog_number: Optional[str]
    clone_name: Optional[str]
    host_species: Optional[str]
    clonality: Optional[str]
    isotype: Optional[str]
    ab_registry_id: Optional[str]


def parse_row(d: dict) -> Row:
    # case-insensitive keys
    dd = {norm_key(k): v for k, v in d.items()}
    vendor = norm(dd.get("vendor"))
    if not vendor:
        raise ValueError("Missing required column: vendor")

    return Row(
        gene_name=norm(dd.get("gene_name") or dd.get("gene") or dd.get("target_gene")),
        uniprot_id=norm(dd.get("uniprot_id") or dd.get("uniprot")),
        protein_name=norm(dd.get("protein_name") or dd.get("target_name")),
        organism=norm(dd.get("organism")) or "Homo sapiens",
        vendor=vendor,
        catalog_number=norm(dd.get("catalog_number") or dd.get("catalog") or dd.get("catno")),
        clone_name=norm(dd.get("clone_name") or dd.get("clone")),
        host_species=norm(dd.get("host_species") or dd.get("host")),
        clonality=norm(dd.get("clonality")),
        isotype=norm(dd.get("isotype")),
        ab_registry_id=norm(dd.get("ab_registry_id") or dd.get("rrid") or dd.get("ab_rrid")),
    )


def get_or_create_target_id(cur, r: Row, create_missing: bool) -> int:
    # Prefer gene_name match
    if r.gene_name:
        cur.execute("SELECT id FROM targets WHERE gene_name = %s LIMIT 1", (r.gene_name,))
        row = cur.fetchone()
        if row:
            return row["id"]

    if not create_missing:
        raise ValueError(
            f"Target not found for gene_name={r.gene_name!r}. "
            f"Re-run with --create-missing-targets (and provide gene_name/uniprot_id)."
        )

    # Creating targets requires a non-null unique uniprot_id in schema.
    # If uniprot_id is missing, we create a stable synthetic id to satisfy schema,
    # but you should supply real UniProt IDs for production-quality data.
    uniprot_id = r.uniprot_id
    if not uniprot_id:
        if not r.gene_name:
            raise ValueError("Need gene_name or uniprot_id to create target.")
        uniprot_id = f"IMP_{r.gene_name}"[:20]

    gene = r.gene_name or uniprot_id
    protein_name = r.protein_name or gene

    cur.execute(
        """
        INSERT INTO targets (uniprot_id, gene_name, protein_name, organism, function_summary)
        VALUES (%s, %s, %s, %s, NULL)
        ON CONFLICT (uniprot_id) DO UPDATE SET
          gene_name = EXCLUDED.gene_name,
          protein_name = EXCLUDED.protein_name,
          organism = EXCLUDED.organism
        RETURNING id
        """,
        (uniprot_id, gene, protein_name, r.organism or "Homo sapiens"),
    )
    return cur.fetchone()["id"]


def antibody_exists(cur, target_id: int, r: Row) -> bool:
    # Deduplicate on (target_id, vendor, catalog_number) when possible, else (target_id, vendor, clone_name)
    if r.catalog_number:
        cur.execute(
            """
            SELECT 1 FROM antibodies
            WHERE target_id = %s AND vendor = %s AND catalog_number = %s
            LIMIT 1
            """,
            (target_id, r.vendor, r.catalog_number),
        )
        return cur.fetchone() is not None
    if r.clone_name:
        cur.execute(
            """
            SELECT 1 FROM antibodies
            WHERE target_id = %s AND vendor = %s AND clone_name = %s
            LIMIT 1
            """,
            (target_id, r.vendor, r.clone_name),
        )
        return cur.fetchone() is not None
    return False


def insert_antibody(cur, target_id: int, r: Row) -> int:
    cur.execute(
        """
        INSERT INTO antibodies (
          ab_registry_id, catalog_number, vendor, clone_name,
          host_species, clonality, isotype, target_id
        )
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        RETURNING id
        """,
        (
            r.ab_registry_id,
            r.catalog_number,
            r.vendor,
            r.clone_name,
            r.host_species,
            r.clonality,
            r.isotype,
            target_id,
        ),
    )
    return cur.fetchone()["id"]


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True, help="Path to CSV file (relative to backend/ or absolute).")
    ap.add_argument(
        "--create-missing-targets",
        action="store_true",
        help="Create targets when gene_name not found in DB (requires gene_name or uniprot_id).",
    )
    ap.add_argument("--dry-run", action="store_true", help="Validate rows but don't write.")
    args = ap.parse_args(argv)

    csv_path = args.csv
    if not os.path.isabs(csv_path):
        csv_path = os.path.join(os.path.dirname(__file__), csv_path)

    if not os.path.exists(csv_path):
        print(f"CSV not found: {csv_path}", file=sys.stderr)
        return 2

    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    cur = conn.cursor()

    inserted = 0
    skipped = 0
    errors = 0

    try:
        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames:
                print("CSV has no header row.", file=sys.stderr)
                return 2

            for i, d in enumerate(reader, start=2):  # header=1
                try:
                    r = parse_row(d)
                    target_id = get_or_create_target_id(cur, r, args.create_missing_targets)

                    if antibody_exists(cur, target_id, r):
                        skipped += 1
                        continue

                    if not args.dry_run:
                        insert_antibody(cur, target_id, r)
                    inserted += 1
                except Exception as e:
                    errors += 1
                    print(f"[row {i}] {e}", file=sys.stderr)

        if args.dry_run:
            conn.rollback()
        else:
            conn.commit()
    finally:
        cur.close()
        conn.close()

    print(f"Inserted: {inserted}")
    print(f"Skipped (dupe): {skipped}")
    print(f"Errors: {errors}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

