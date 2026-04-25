# 🔬 AntibodyLens

Open-source antibody validation dashboard. Search protein targets, explore validated antibodies across applications and species, and assess reliability through a composite confidence score.

**Built with:** React · Flask · PostgreSQL · D3.js · Docker

![Status](https://img.shields.io/badge/status-in%20development-yellow)

---

## Features

- **Target Search** — Fuzzy search by gene name or protein name with autocomplete
- **Antibody Explorer** — Filter by application (WB, IHC, IF, FC, ChIP, ELISA, IP), species, host, clonality
- **Confidence Scoring** — Composite score (0-10) based on citation weight, application breadth, recency, and positive validation rate
- **Interactive Visualizations** — D3.js heatmap (antibody × application), bar chart (validations by app), and publication timeline
- **Publication Links** — Direct links to PubMed for every validation record

## Quick Start

### With Docker (recommended)

```bash
git clone https://github.com/jacobcho/antibodylens.git
cd antibodylens
docker-compose up --build
```

Then seed the database:

```bash
docker-compose exec backend python seed.py
```

- Frontend: http://localhost:3000
- API: http://localhost:5000/api/health

### Without Docker

**Prerequisites:** Python 3.11+, Node 18+, PostgreSQL 14+

```bash
# Database
createdb antibodylens
psql -d antibodylens -f backend/schema.sql

# Backend
cd backend
pip install -r requirements.txt
python seed.py
flask run

# Frontend (new terminal)
cd frontend
npm install
npm start
```

## Importing real antibody catalogs (CSV)

AntibodyLens can import **real antibody rows** (vendor / catalog / clone / isotype / RRID) from a CSV.
Most catalogs do **not** include structured validation evidence, so imported antibodies will typically have
no confidence score until you also load validations.

1) Put a CSV somewhere under `backend/` (example: `backend/data/antibodies.csv`).

2) CSV header should include at least:
- `gene_name` (or `target_gene`)
- `vendor`

Optional columns:
`catalog_number`, `clone_name`, `host_species`, `clonality`, `isotype`, `ab_registry_id` (RRID),
`uniprot_id`, `protein_name`, `organism`

3) Run the importer:

```bash
cd backend
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/antibodylens"
python import_antibodies.py --csv data/antibodies.csv --create-missing-targets
```

If you only want to validate without writing:

```bash
python import_antibodies.py --csv data/antibodies.csv --create-missing-targets --dry-run
```

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/targets/search?q=TP53` | Fuzzy search targets |
| `GET /api/targets/:id` | Target detail with antibody count |
| `GET /api/targets/:id/antibodies?application=WB&species=Human&sort=score` | Filtered antibody list |
| `GET /api/targets/:id/heatmap` | Validation heatmap matrix data |
| `GET /api/targets/:id/stats` | Aggregate stats for visualizations |
| `GET /api/antibodies/:id` | Full antibody detail + all validations |
| `GET /api/applications` | Reference list of application types |
| `POST /api/admin/recompute-scores` | Recompute all confidence scores |

## Confidence Score

Each antibody receives a score from 0-10 based on:

| Component | Weight | What it measures |
|---|---|---|
| Citation Score | 30% | Log-scaled total citations across all validating publications |
| Application Breadth | 25% | Number of distinct applications validated (WB, IHC, etc.) |
| Recency | 20% | How recent the latest validating publication is |
| Positive Rate | 25% | Percentage of validations with positive results |

## Project Structure

```
antibodylens/
├── backend/
│   ├── app.py              # Flask API (all endpoints)
│   ├── schema.sql           # PostgreSQL schema
│   ├── seed.py              # UniProt data fetcher + synthetic data generator
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.js           # Router + layout
│   │   ├── pages/
│   │   │   ├── SearchPage.js
│   │   │   ├── TargetPage.js
│   │   │   └── AntibodyDetailPage.js
│   │   ├── components/
│   │   │   ├── ApplicationBarChart.js    # D3 horizontal bar chart
│   │   │   ├── PublicationTimeline.js    # D3 area/line chart
│   │   │   └── ValidationHeatmap.js      # D3 heatmap
│   │   └── utils/
│   │       └── api.js       # Axios API client
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## Build Plan (14 days)

### Days 1-3: Backend + Database
- [x] Design schema
- [x] Build Flask API with all endpoints
- [x] Write seed script with UniProt integration
- [ ] Test all endpoints with curl/Postman
- [ ] Add error handling and input validation

### Days 4-6: Core API + Confidence Scoring
- [ ] Test confidence score computation with edge cases
- [ ] Add search debouncing and rate limiting
- [ ] Optimize queries (add EXPLAIN ANALYZE, tune indexes)

### Days 7-9: React Frontend
- [ ] Implement SearchPage with debounced autocomplete
- [ ] Build TargetPage with filter controls and antibody table
- [ ] Build AntibodyDetailPage with score breakdown bars
- [ ] Add CSS styling (go for clean scientific aesthetic)

### Days 10-12: D3 Visualizations
- [ ] ApplicationBarChart — horizontal bars with transitions
- [ ] PublicationTimeline — area chart with hover tooltips
- [ ] ValidationHeatmap — the showpiece, antibody × application matrix

### Days 13-14: Polish + Deploy
- [ ] Dockerize and test full stack
- [ ] Deploy to Railway/Render (free tier)
- [ ] Write clean README with screenshots
- [ ] Record 30-second demo GIF

## Data Sources

- **[UniProt](https://www.uniprot.org/)** — Protein target metadata (real data via REST API)
- **Validation records** — Synthetic but realistic, modeled on typical antibody validation patterns

## License

MIT

---

*Built by [Jacob Cho](https://linkedin.com/in/jacobcho) — Duke University BME/CS '28*
