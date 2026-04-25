-- AntibodyLens Database Schema
-- Run: psql -d antibodylens -f schema.sql

CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- for fuzzy text search

-- Protein targets (e.g., TP53, EGFR, HER2)
CREATE TABLE targets (
    id SERIAL PRIMARY KEY,
    uniprot_id VARCHAR(20) UNIQUE NOT NULL,   -- e.g., 'P04637'
    gene_name VARCHAR(50) NOT NULL,            -- e.g., 'TP53'
    protein_name TEXT NOT NULL,                 -- e.g., 'Cellular tumor antigen p53'
    organism VARCHAR(100) DEFAULT 'Homo sapiens',
    function_summary TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_targets_gene_name ON targets USING gin (gene_name gin_trgm_ops);

-- Antibodies catalogued from public registries
CREATE TABLE antibodies (
    id SERIAL PRIMARY KEY,
    ab_registry_id VARCHAR(50),               -- Antibody Registry RRID
    catalog_number VARCHAR(100),
    vendor VARCHAR(200) NOT NULL,              -- e.g., 'Abcam', 'Cell Signaling Technology'
    clone_name VARCHAR(100),
    host_species VARCHAR(50),                  -- e.g., 'Rabbit', 'Mouse'
    clonality VARCHAR(20),                     -- 'Monoclonal' or 'Polyclonal'
    isotype VARCHAR(50),
    target_id INTEGER REFERENCES targets(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_antibodies_target ON antibodies(target_id);
CREATE INDEX idx_antibodies_vendor ON antibodies(vendor);

-- Validated applications for each antibody
-- (e.g., Western Blot, IHC, IF, Flow Cytometry, ChIP, ELISA)
CREATE TABLE validations (
    id SERIAL PRIMARY KEY,
    antibody_id INTEGER REFERENCES antibodies(id) ON DELETE CASCADE,
    application VARCHAR(50) NOT NULL,          -- 'WB', 'IHC', 'IF', 'FC', 'ChIP', 'ELISA', 'IP'
    species_tested VARCHAR(50),                -- 'Human', 'Mouse', 'Rat'
    publication_doi VARCHAR(200),
    pubmed_id VARCHAR(20),
    publication_title TEXT,
    journal VARCHAR(200),
    pub_year INTEGER,
    citation_count INTEGER DEFAULT 0,
    validated_positive BOOLEAN DEFAULT TRUE,   -- did it actually work?
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_validations_antibody ON validations(antibody_id);
CREATE INDEX idx_validations_application ON validations(application);
CREATE INDEX idx_validations_species ON validations(species_tested);

-- Precomputed confidence scores (refreshed periodically)
CREATE TABLE confidence_scores (
    id SERIAL PRIMARY KEY,
    antibody_id INTEGER UNIQUE REFERENCES antibodies(id) ON DELETE CASCADE,
    overall_score NUMERIC(4,2),               -- 0.00 to 10.00
    citation_score NUMERIC(4,2),              -- weighted by total citations
    application_breadth NUMERIC(4,2),         -- how many distinct apps validated
    recency_score NUMERIC(4,2),               -- weighted toward recent publications
    positive_rate NUMERIC(5,2),               -- 0–100% (needs >4,2 so 100.00 fits)
    total_validations INTEGER DEFAULT 0,
    last_computed TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_confidence_overall ON confidence_scores(overall_score DESC);

-- Application type reference table
CREATE TABLE application_types (
    code VARCHAR(10) PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    description TEXT
);

INSERT INTO application_types (code, full_name, description) VALUES
    ('WB',   'Western Blot',      'Protein detection by size separation and membrane transfer'),
    ('IHC',  'Immunohistochemistry', 'Protein localization in tissue sections'),
    ('IF',   'Immunofluorescence', 'Fluorescent antibody staining for microscopy'),
    ('FC',   'Flow Cytometry',     'Single-cell protein expression analysis'),
    ('ChIP', 'ChIP',               'Chromatin immunoprecipitation for DNA-binding proteins'),
    ('ELISA','ELISA',              'Enzyme-linked immunosorbent assay for quantification'),
    ('IP',   'Immunoprecipitation','Protein complex isolation from cell lysates');
