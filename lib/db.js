const fs = require('fs');
const path = require('path');
const os = require('os');

// If DATABASE_URL is provided (Neon), use pg, otherwise fallback to JSON file.
const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || null;
let usePg = !!DATABASE_URL;

async function initPg() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: DATABASE_URL });

  // create tables if not exist
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

  return pool;
}

// File fallback implementation (kept async-compatible)
const DEFAULT_FILE = path.join(process.cwd(), 'data.json');
let FILE = DEFAULT_FILE;
let _usingTmp = false;

function loadFile() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (e) {
    try {
      const tmp = path.join(os.tmpdir(), 'mpfit-data.json');
      if (FILE !== tmp) { FILE = tmp; _usingTmp = true; }
      return JSON.parse(fs.readFileSync(FILE, 'utf8'));
    } catch (e2) {
      const init = { days: [], workouts: [], logs: [], _ids: { days: 0, workouts: 0, logs: 0 } };
      try { fs.writeFileSync(FILE, JSON.stringify(init, null, 2), 'utf8'); }
      catch (e3) {
        try { const tmp2 = path.join(os.tmpdir(), 'mpfit-data.json'); FILE = tmp2; _usingTmp = true; fs.writeFileSync(FILE, JSON.stringify(init, null, 2), 'utf8'); }
        catch (e4) { console.error('lib/db.js: failed to init data file', e4); }
      }
      return init;
    }
  }
}

function saveFile(dbObj) {
  try { fs.writeFileSync(FILE, JSON.stringify(dbObj, null, 2), 'utf8'); return true; }
  catch (err) {
    console.error('lib/db.js: failed to write to', FILE, err && err.stack ? err.stack : err);
    if (!_usingTmp) {
      try { const tmp = path.join(os.tmpdir(), 'mpfit-data.json'); fs.writeFileSync(tmp, JSON.stringify(dbObj, null, 2), 'utf8'); FILE = tmp; _usingTmp = true; console.warn('lib/db.js: falling back to tmp file', tmp); return true; }
      catch (err2) { console.error('lib/db.js: fallback write failed', err2); }
    }
    return false;
  }
}

// If using Postgres, initialize pool
let pgPool = null;
if (usePg) {
  // lazy init: we will initialize when first needed
  pgPool = null;
}

async function ensurePg() {
  if (!pgPool) pgPool = await initPg();
  return pgPool;
}

// Exported API: all functions are async to keep a single contract
module.exports = {
  async getDays() {
    if (usePg) {
      const pool = await ensurePg();
      const res = await pool.query('SELECT id, name, subtitle, completed, started_at AS "startedAt", finished_at AS "finishedAt", duration_seconds AS "durationSeconds" FROM days ORDER BY id');
      return res.rows.map(r => ({ ...r }));
    }
    const db = loadFile();
    return db.days.slice();
  },

  async addDay(name, subtitle) {
    if (usePg) {
      const pool = await ensurePg();
      const res = await pool.query('INSERT INTO days(name, subtitle) VALUES($1,$2) RETURNING id, name, subtitle, completed, started_at AS "startedAt", finished_at AS "finishedAt", duration_seconds AS "durationSeconds"', [name, subtitle || null]);
      return res.rows[0];
    }
    const db = loadFile(); db._ids.days += 1; const d = { id: db._ids.days, name, subtitle: subtitle || null, completed: false, startedAt: null, finishedAt: null, durationSeconds: null }; db.days.push(d); saveFile(db); return d;
  },

  async getWorkoutsByDay(dayId) {
    if (usePg) {
      const pool = await ensurePg();
      const res = await pool.query('SELECT id, day_id AS "day_id", name, planned_sets AS "plannedSets", planned_reps AS "plannedReps", youtube, current_weight AS "currentWeight", completed, position FROM workouts WHERE day_id=$1 ORDER BY position NULLS LAST, id', [Number(dayId)]);
      return res.rows.map(r => ({ id: r.id, day_id: r.day_id, name: r.name, plannedSets: r.plannedSets, plannedReps: r.plannedReps, youtube: r.youtube, currentWeight: r.currentweight === null ? null : Number(r.currentweight), completed: r.completed, position: r.position }));
    }
    const db = loadFile(); return db.workouts.filter(w => w.day_id === Number(dayId)).slice().sort((a,b)=> (a.position||0) - (b.position||0));
  },

  async addWorkout(dayId, { name, plannedSets, plannedReps, youtube }) {
    if (usePg) {
      const pool = await ensurePg();
      // determine next position
      const posRes = await pool.query('SELECT COALESCE(MAX(position),0) + 1 AS nextpos FROM workouts WHERE day_id=$1', [Number(dayId)]);
      const nextPos = posRes.rows[0].nextpos || 1;
      const res = await pool.query('INSERT INTO workouts(day_id, name, planned_sets, planned_reps, youtube, position) VALUES($1,$2,$3,$4,$5,$6) RETURNING id, day_id, name, planned_sets AS "plannedSets", planned_reps AS "plannedReps", youtube, current_weight AS "currentWeight", completed, position', [Number(dayId), name, Number(plannedSets||0), Number(plannedReps||0), youtube||null, nextPos]);
      const r = res.rows[0]; return { id: r.id, day_id: r.day_id, name: r.name, plannedSets: r.plannedsets, plannedReps: r.plannedreps, youtube: r.youtube, currentWeight: r.currentweight === null ? null : Number(r.currentweight), completed: r.completed, position: r.position };
    }
    const db = loadFile(); db._ids.workouts += 1; const dayNum = Number(dayId); const positions = db.workouts.filter(w => w.day_id === dayNum).map(w => w.position || 0); const nextPos = positions.length ? Math.max(...positions) + 1 : 1; const w = { id: db._ids.workouts, day_id: dayNum, name, plannedSets: Number(plannedSets||0), plannedReps: Number(plannedReps||0), youtube: youtube||null, currentWeight: null, completed: false, position: nextPos }; db.workouts.push(w); saveFile(db); return w;
  },

  async setCompleted(workoutId, completed) {
    if (usePg) {
      const pool = await ensurePg();
      const res = await pool.query('UPDATE workouts SET completed=$1 WHERE id=$2 RETURNING id, day_id AS "day_id", name, planned_sets AS "plannedSets", planned_reps AS "plannedReps", youtube, current_weight AS "currentWeight", completed, position', [!!completed, Number(workoutId)]);
      return res.rows[0] || null;
    }
    const db = loadFile(); const w = db.workouts.find(x => x.id === Number(workoutId)); if (!w) return null; w.completed = !!completed; saveFile(db); return w;
  },

  async setCurrentWeight(workoutId, weight) {
    if (usePg) {
      const pool = await ensurePg();
      const val = weight === null ? null : Number(weight);
      const res = await pool.query('UPDATE workouts SET current_weight=$1 WHERE id=$2 RETURNING id, day_id AS "day_id", name, planned_sets AS "plannedSets", planned_reps AS "plannedReps", youtube, current_weight AS "currentWeight", completed, position', [val, Number(workoutId)]);
      const r = res.rows[0]; if (!r) return null; return { id: r.id, day_id: r.day_id, name: r.name, plannedSets: r.plannedsets, plannedReps: r.plannedreps, youtube: r.youtube, currentWeight: r.currentweight === null ? null : Number(r.currentweight), completed: r.completed, position: r.position };
    }
    const db = loadFile(); const w = db.workouts.find(x => x.id === Number(workoutId)); if (!w) return null; w.currentWeight = weight === null ? null : Number(weight); saveFile(db); return w;
  },

  async addLog(workoutId, { series, reps, weight, date }) {
    if (usePg) {
      const pool = await ensurePg();
      const d = date || new Date().toISOString();
      const res = await pool.query('INSERT INTO logs(workout_id, series, reps, weight, date) VALUES($1,$2,$3,$4,$5) RETURNING id, workout_id AS "workout_id", series, reps, weight, date', [Number(workoutId), Number(series), Number(reps), Number(weight), d]);
      return res.rows[0];
    }
    const db = loadFile(); db._ids.logs += 1; const l = { id: db._ids.logs, workout_id: Number(workoutId), series: Number(series), reps: Number(reps), weight: Number(weight), date: date||new Date().toISOString() }; db.logs.push(l); saveFile(db); return l;
  },

  async getLogsByWorkout(workoutId) {
    if (usePg) {
      const pool = await ensurePg();
      const res = await pool.query('SELECT id, workout_id AS "workout_id", series, reps, weight, date FROM logs WHERE workout_id=$1 ORDER BY date DESC', [Number(workoutId)]);
      return res.rows.map(r => ({ id: r.id, workout_id: r.workout_id, series: r.series, reps: r.reps, weight: Number(r.weight), date: r.date }));
    }
    const db = loadFile(); return db.logs.filter(l => l.workout_id === Number(workoutId)).sort((a,b)=> new Date(b.date)-new Date(a.date));
  },

  // small helper
  async getWorkout(id) {
    if (usePg) {
      const pool = await ensurePg(); const res = await pool.query('SELECT id, day_id AS "day_id", name, planned_sets AS "plannedSets", planned_reps AS "plannedReps", youtube, current_weight AS "currentWeight", completed, position FROM workouts WHERE id=$1', [Number(id)]); return res.rows[0] || null;
    }
    const db = loadFile(); return db.workouts.find(w=>w.id===Number(id))||null;
  },

  async deleteWorkout(workoutId) {
    if (usePg) {
      const pool = await ensurePg(); const res = await pool.query('DELETE FROM workouts WHERE id=$1', [Number(workoutId)]); return res.rowCount>0;
    }
    const db = loadFile(); const wid = Number(workoutId); const idx = db.workouts.findIndex(w => w.id === wid); if (idx === -1) return false; db.workouts.splice(idx, 1); db.logs = db.logs.filter(l => l.workout_id !== wid); saveFile(db); return true;
  },

  async updateWorkoutPositions(dayId, orderedIds) {
    if (usePg) {
      const pool = await ensurePg(); if (!Array.isArray(orderedIds)) return false; const client = await pool.connect(); try { await client.query('BEGIN'); for (let i=0;i<orderedIds.length;i++){ const wid = Number(orderedIds[i]); await client.query('UPDATE workouts SET position=$1 WHERE id=$2 AND day_id=$3', [i+1, wid, Number(dayId)]); } await client.query('COMMIT'); return true; } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    }
    const db = loadFile(); const did = Number(dayId); if (!Array.isArray(orderedIds)) return false; let changed=false; orderedIds.forEach((wid, idx)=>{ const w = db.workouts.find(x=>x.id===Number(wid)&&x.day_id===did); if (w && w.position!==idx+1){ w.position=idx+1; changed=true;} }); if (changed) saveFile(db); return true;
  },

  async deleteDay(dayId) {
    if (usePg) {
      const pool = await ensurePg(); const res = await pool.query('DELETE FROM days WHERE id=$1', [Number(dayId)]); return res.rowCount>0;
    }
    const db = loadFile(); const did = Number(dayId); const idx = db.days.findIndex(d => d.id === did); if (idx === -1) return false; db.days.splice(idx, 1); const workoutsToRemove = db.workouts.filter(w => w.day_id === did).map(w => w.id); db.workouts = db.workouts.filter(w => w.day_id !== did); db.logs = db.logs.filter(l => !workoutsToRemove.includes(l.workout_id)); saveFile(db); return true;
  },

  // start/complete a day
  async startDay(dayId) {
    if (usePg) {
      const pool = await ensurePg(); const now = new Date().toISOString(); const res = await pool.query('UPDATE days SET completed=false, started_at=$1, finished_at=NULL, duration_seconds=NULL WHERE id=$2 RETURNING id, name, subtitle, completed, started_at AS "startedAt", finished_at AS "finishedAt", duration_seconds AS "durationSeconds"', [now, Number(dayId)]);
      // also mark workouts not completed
      await pool.query('UPDATE workouts SET completed=false WHERE day_id=$1', [Number(dayId)]);
      return res.rows[0] || null;
    }
    const db = loadFile(); const did = Number(dayId); const day = db.days.find(d => d.id === did); if (!day) return false; day.completed = false; day.startedAt = new Date().toISOString(); day.finishedAt = null; day.durationSeconds = null; db.workouts.forEach(w => { if (w.day_id === did) w.completed = false; }); saveFile(db); return day;
  },

  async completeDay(dayId) {
    if (usePg) {
      const pool = await ensurePg(); const now = new Date(); // we will compute duration if started_at exists
      // fetch started_at
      const sres = await pool.query('SELECT started_at FROM days WHERE id=$1', [Number(dayId)]);
      if (sres.rowCount===0) return false;
      const startedAt = sres.rows[0].started_at;
      let duration = null;
      if (startedAt) {
        const started = new Date(startedAt).getTime();
        duration = Math.max(0, Math.round((now.getTime() - started)/1000));
      }
      const fres = await pool.query('UPDATE days SET completed=true, finished_at=$1, duration_seconds=COALESCE($2,duration_seconds), started_at=NULL WHERE id=$3 RETURNING id, name, subtitle, completed, started_at AS "startedAt", finished_at AS "finishedAt", duration_seconds AS "durationSeconds"', [now.toISOString(), duration, Number(dayId)]);
      await pool.query('UPDATE workouts SET completed=true WHERE day_id=$1', [Number(dayId)]);
      return fres.rows[0] || null;
    }
    const db = loadFile(); const did = Number(dayId); const day = db.days.find(d => d.id === did); if (!day) return false; day.completed = true; const now = new Date(); if (day.startedAt) { const started = new Date(day.startedAt).getTime(); day.durationSeconds = Math.max(0, Math.round((now.getTime() - started)/1000)); day.finishedAt = now.toISOString(); day.startedAt = null; } else { day.durationSeconds = day.durationSeconds || 0; day.finishedAt = now.toISOString(); } db.workouts.forEach(w => { if (w.day_id === did) w.completed = true; }); saveFile(db); return day;
  }
};
