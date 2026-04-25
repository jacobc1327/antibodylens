# AntibodyLens Demo Checklist

## Local (Docker)

### Start stack

```bash
docker compose up --build
```

### Seed data (resets antibodies/validations)

```bash
docker compose exec backend python seed.py
```

### If confidence scores are blank

```bash
curl -X POST "http://localhost:5000/api/admin/recompute-scores"
```

## Deployed (Render + Netlify)

### Common checks

- **API health**: `GET /api/health`
- **Frontend API URL**: Netlify env var `REACT_APP_API_URL` should be `https://<your-api>/api`
- **CORS**: Render env var `CORS_ORIGINS` should include your Netlify origin (`https://...netlify.app`)

### If confidence scores are blank

Run recompute against the deployed API:

```bash
curl -X POST "https://<your-api>/api/admin/recompute-scores"
```

If you set `ADMIN_TOKEN` on the API, include it:

```bash
curl -X POST "https://<your-api>/api/admin/recompute-scores?token=<ADMIN_TOKEN>"
```

### If Living Cell assay filters don't hide targets

This usually means the database has **stacked seeds** from earlier runs. The latest `seed.py` clears antibodies first, so:

1. Re-run `seed.py` against the same production DB (or reset the DB).
2. Re-run recompute-scores.

