# StockGame

StockGame is a stock market simulation platform with:
- **Backend:** FastAPI + SQLAlchemy + Redis
- **Frontend:** React (Vite)
- **Auth:** Firebase ID tokens

## Repository structure

- `./backend` – API, market logic, data layer
- `./frontend` – web UI

## Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Backend environment variables

- `DATABASE_URL` (default local postgres URL)
- `REMOTE_DATABASE_URL` (optional, preferred when present)
- `REDIS_URL` (default `redis://localhost:6379`)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_TOKEN` (optional)
- `GOOGLE_APPLICATION_CREDENTIALS` (path to Firebase service account JSON)
- `CORS_ALLOW_ORIGINS` (comma-separated list)
- `CORS_ALLOW_CREDENTIALS` (`true`/`false`)
- `AUTO_CREATE_TABLES` (`true` only for local bootstrap; prefer migrations)

## Migrations (Alembic)

```bash
cd backend
alembic upgrade head
alembic revision --autogenerate -m "describe change"
```

## Backend tests

```bash
cd backend
pytest -q
```

## Frontend setup

```bash
cd frontend
npm ci
npm run dev
```

## Frontend quality checks

```bash
npm run lint
npm run build
```

## Notes

- Keep backend schema changes migration-driven (Alembic), not startup `create_all`.
- Prefer one frontend component style long-term (TypeScript is recommended) to reduce duplicated `.jsx`/`.tsx` UI files.
