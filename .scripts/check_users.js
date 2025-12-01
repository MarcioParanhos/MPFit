const { Pool } = require('pg');

(async ()=>{
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const c = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='name'");
    console.log('column name exists:', c.rowCount>0);
    const r = await pool.query('SELECT id,name,email FROM users ORDER BY id LIMIT 10');
    console.log('users sample:', r.rows);
  } catch(e) {
    console.error('query error', e && e.message ? e.message : e);
  } finally {
    await pool.end();
  }
})();
