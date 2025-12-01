(async()=>{
  const { Pool } = require('pg');
  const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!url) { console.error('DATABASE_URL not set'); process.exit(2); }
  const pool = new Pool({ connectionString: url });
  try {
    for (const t of ['workouts','logs','users']){
      const r = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position", [t]);
      console.log('TABLE', t, JSON.stringify(r.rows, null, 2));
    }
  } catch(e) { console.error('ERROR', e && e.message ? e.message : e); process.exitCode=1; } finally { await pool.end(); }
})();
