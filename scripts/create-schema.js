// Creates tables days, workouts, logs if they don't exist using DATABASE_URL env var
const { Pool } = require('pg');

async function main(){
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) { console.error('Set DATABASE_URL env var'); process.exit(1); }
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS days (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        subtitle TEXT,
        completed BOOLEAN DEFAULT FALSE,
        started_at TIMESTAMPTZ,
        finished_at TIMESTAMPTZ,
        duration_seconds INTEGER
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workouts (
        id SERIAL PRIMARY KEY,
        day_id INTEGER REFERENCES days(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        planned_sets INTEGER,
        planned_reps INTEGER,
        youtube TEXT,
        current_weight NUMERIC,
        completed BOOLEAN DEFAULT FALSE,
        position INTEGER
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        workout_id INTEGER REFERENCES workouts(id) ON DELETE CASCADE,
        series INTEGER,
        reps INTEGER,
        weight NUMERIC,
        date TIMESTAMPTZ
      );
    `);
    console.log('Schema created/verified');
  } catch (e) {
    console.error('Failed to create schema', e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
