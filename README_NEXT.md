# MPFit - Next.js Mobile-first App

This Next.js app is a mobile-first prototype for tracking gym workouts. It uses a JSON file (`data.json`) for local testing and is prepared for future migration to Postgres.

Run locally

```powershell
cd E:\Projetos\MPFit
npm install
npm run dev
```

The dev server runs on port `3001` (configured to avoid conflict if another local server uses 3000).

API endpoints (local JSON):
- `GET /api/days` — list days
- `POST /api/days` — create day { name }
- `GET /api/days/:id/workouts` — list workouts for day
- `POST /api/days/:id/workouts` — create workout { name, plannedSets, plannedReps, youtube }
- `GET /api/workouts/:id/weights` — list logs
- `POST /api/workouts/:id/weights` — add log { series, reps, weight }

Migration to Postgres

- Replace `lib/db.js` with a Postgres adapter or modify it to switch on env var.
- Use `pg` package and set `DATABASE_URL` in Vercel.
