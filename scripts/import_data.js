(async()=>{
  const fs = require('fs');
  const path = require('path');
  const { Pool } = require('pg');
  const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!url) { console.error('DATABASE_URL not set'); process.exit(2); }
  const pool = new Pool({ connectionString: url });
  const file = path.join(process.cwd(),'data.json');
  if (!fs.existsSync(file)) { console.error('data.json not found'); process.exit(2); }
  const data = JSON.parse(fs.readFileSync(file,'utf8'));
  const users = data.users || [];
  const days = data.days || [];
  const workouts = data.workouts || [];
  const logs = data.logs || [];

  const userMap = new Map(); // oldId -> newId
  const dayMap = new Map();
  const workoutMap = new Map();

  try {
    // detect schema features
    const colsRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='days'");
    const dayCols = new Set(colsRes.rows.map(r => r.column_name));
    const workoutsColsRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='workouts'");
    const workoutCols = new Set(workoutsColsRes.rows.map(r => r.column_name));
      const logsColsRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='logs'");
      const logsCols = new Set(logsColsRes.rows.map(r => r.column_name));
    console.log('Importing users:', users.length);
    for (const u of users) {
      const email = (u.email||'').toLowerCase();
      if (!email) continue;
      const name = u.name || null;
      const password_hash = u.password_hash || u.passwordHash || null;
      const created_at = u.createdAt || u.created_at || null;
      // upsert by email
      const res = await pool.query(
        `INSERT INTO users(name,email,password_hash,created_at) VALUES($1,$2,$3,$4) ON CONFLICT (email) DO UPDATE SET name = COALESCE(EXCLUDED.name, users.name) RETURNING id`,
        [name, email, password_hash, created_at]
      );
      const newId = res.rows[0].id;
      userMap.set(u.id, newId);
    }

    console.log('Imported users:', userMap.size);

    console.log('Importing days:', days.length);
    for (const d of days) {
      const oldId = d.id;
      const name = d.name || 'Dia';
      const subtitle = d.subtitle || d.subTitle || null;
      const completed = !!d.completed;
      const started_at = d.startedAt || d.started_at || null;
      const finished_at = d.finishedAt || d.finished_at || null;
      const duration_seconds = d.durationSeconds || d.duration_seconds || null;
      const share_code = d.share_code || d.shareCode || null;
      // build insert depending on schema
      if (dayCols.has('user_id') && dayCols.has('share_code')) {
        const userId = d.user_id || d.userId || null;
        const mappedUser = userId ? (userMap.get(userId) || null) : null;
        const res = await pool.query(
          `INSERT INTO days(user_id,name,subtitle,completed,started_at,finished_at,duration_seconds,share_code) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [mappedUser, name, subtitle, completed, started_at, finished_at, duration_seconds, share_code]
        );
        dayMap.set(oldId, res.rows[0].id);
      } else if (dayCols.has('user_id') && !dayCols.has('share_code')) {
        const userId = d.user_id || d.userId || null;
        const mappedUser = userId ? (userMap.get(userId) || null) : null;
        const res = await pool.query(
          `INSERT INTO days(user_id,name,subtitle,completed,started_at,finished_at,duration_seconds) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [mappedUser, name, subtitle, completed, started_at, finished_at, duration_seconds]
        );
        dayMap.set(oldId, res.rows[0].id);
      } else {
        // no user_id column: insert without user linkage
        const res = await pool.query(
          `INSERT INTO days(name,subtitle,completed,started_at,finished_at,duration_seconds) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
          [name, subtitle, completed, started_at, finished_at, duration_seconds]
        );
        dayMap.set(oldId, res.rows[0].id);
      }
    }
    console.log('Imported days:', dayMap.size);

    console.log('Importing workouts:', workouts.length);
    for (const w of workouts) {
      const oldId = w.id;
      const day_old = w.day_id || w.dayId || null;
      const mappedDay = day_old ? (dayMap.get(day_old) || null) : null;
      const user_old = w.user_id || w.userId || null;
      const mappedUser = user_old ? (userMap.get(user_old) || null) : null;
      const name = w.name || 'Exercício';
      const planned_sets = w.plannedSets || w.planned_sets || 0;
      const planned_reps = w.plannedReps || w.planned_reps || 0;
      const youtube = w.youtube || null;
      const current_weight = w.currentWeight || w.current_weight || null;
      const completed = !!w.completed;
      const position = w.position || null;
      if (workoutCols.has('user_id')) {
        const res = await pool.query(
          `INSERT INTO workouts(day_id,user_id,name,planned_sets,planned_reps,youtube,current_weight,completed,position) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [mappedDay, mappedUser, name, planned_sets, planned_reps, youtube, current_weight, completed, position]
        );
        workoutMap.set(oldId, res.rows[0].id);
      } else {
        const res = await pool.query(
          `INSERT INTO workouts(day_id,name,planned_sets,planned_reps,youtube,current_weight,completed,position) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [mappedDay, name, planned_sets, planned_reps, youtube, current_weight, completed, position]
        );
        workoutMap.set(oldId, res.rows[0].id);
      }
    }
    console.log('Imported workouts:', workoutMap.size);

    console.log('Importing logs:', logs.length);
    let importedLogs = 0;
    for (const l of logs) {
      const workout_old = l.workout_id || l.workoutId || null;
      const mappedWorkout = workout_old ? (workoutMap.get(workout_old) || null) : null;
      const user_old = l.user_id || l.userId || null;
      const mappedUser = user_old ? (userMap.get(user_old) || null) : null;
      if (!mappedWorkout) continue;
      const series = l.series || null;
      const reps = l.reps || null;
      const weight = l.weight || null;
      const date = l.date || new Date().toISOString();
      if (logsCols.has('user_id')) {
        await pool.query(`INSERT INTO logs(workout_id,user_id,series,reps,weight,date) VALUES($1,$2,$3,$4,$5,$6)`, [mappedWorkout, mappedUser, series, reps, weight, date]);
      } else {
        await pool.query(`INSERT INTO logs(workout_id,series,reps,weight,date) VALUES($1,$2,$3,$4,$5)`, [mappedWorkout, series, reps, weight, date]);
      }
      importedLogs++;
    }
    console.log('Imported logs:', importedLogs);

    console.log('Import complete');
  } catch (e) {
    console.error('Import error', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
