const { Pool } = require('pg');

(async ()=>{
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('Running ALTER TABLE to add name column if not exists...');
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT");
    console.log('ALTER TABLE completed');
  } catch(e) {
    console.error('alter error', e && e.message ? e.message : e);
  } finally {
    await pool.end();
  }
})();
