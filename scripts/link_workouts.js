const { Pool } = require('pg');

(async ()=>{
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const res = await pool.query("UPDATE workouts SET exercise_id = e.id FROM exercises e WHERE workouts.exercise_id IS NULL AND workouts.name = e.name RETURNING workouts.id, workouts.exercise_id");
    console.log('updated workouts:', res.rows);
    await pool.end();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
