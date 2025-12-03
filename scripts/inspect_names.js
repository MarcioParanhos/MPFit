const { Pool } = require('pg');
(async ()=>{
  try{
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const ex = await pool.query('SELECT id, name, length(name) as len, name as raw FROM exercises ORDER BY id');
    console.log('EXERCISES:', ex.rows);
    const wk = await pool.query('SELECT id, name, length(name) as len, name as raw, exercise_id FROM workouts ORDER BY id');
    console.log('WORKOUTS:', wk.rows);
    await pool.end();
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
