(async()=>{
  const { Pool } = require('pg');
  const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!url) { console.error('DATABASE_URL not set'); process.exit(2); }
  const pool = new Pool({ connectionString: url });
  try {
    const r = await pool.query("SELECT id, name, email, created_at FROM users ORDER BY id");
    console.log(JSON.stringify(r.rows, null, 2));
  } catch (e) {
    console.error('ERROR', e && e.message ? e.message : e);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
