// Simple migration script: reads data.json and inserts into Postgres
// Usage: DATABASE_URL=... node scripts/migrate-to-pg.js

const fs = require('fs');
const path = require('path');

async function main(){
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('Set DATABASE_URL environment variable (Neon connection string)');
    process.exit(1);
  }
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: DATABASE_URL });
  const file = path.join(process.cwd(), 'data.json');
  if (!fs.existsSync(file)) {
    console.error('data.json not found'); process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(file,'utf8'));
  try {
    await pool.query('BEGIN');
    // insert days
    for (const d of raw.days || []){
      const res = await pool.query('INSERT INTO days(id, name, subtitle, completed, started_at, finished_at, duration_seconds) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name', [d.id, d.name, d.subtitle, !!d.completed, d.startedAt || null, d.finishedAt || null, d.durationSeconds === undefined ? null : d.durationSeconds]);
    }
    // insert workouts
    for (const w of raw.workouts || []){
      await pool.query('INSERT INTO workouts(id, day_id, name, planned_sets, planned_reps, youtube, current_weight, completed, position) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name', [w.id, w.day_id, w.name, w.plannedSets || null, w.plannedReps || null, w.youtube||null, w.currentWeight === undefined ? null : w.currentWeight, !!w.completed, w.position || null]);
    }
    // insert logs
    for (const l of raw.logs || []){
      await pool.query('INSERT INTO logs(id, workout_id, series, reps, weight, date) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET series=EXCLUDED.series', [l.id, l.workout_id, l.series, l.reps, l.weight, l.date]);
    }
    await pool.query('COMMIT');
    console.log('Migration complete');
  } catch (e) {
    await pool.query('ROLLBACK');
    console.error('Migration failed', e);
  } finally { await pool.end(); }
}

main();
