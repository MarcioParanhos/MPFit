const fs = require('fs');
const path = require('path');
const os = require('os');

// This application now requires a Postgres (Neon) connection and will
// use it exclusively. The JSON file fallback has been disabled so the
// app always interacts with the database configured by `DATABASE_URL`.
function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || null;
}

// Force usage of pg. Ensure a DB URL is present when initializing.
let usePg = true;

async function initPg() {
  const { Pool } = require('pg');
  const DATABASE_URL = getDatabaseUrl();
  if (!DATABASE_URL) throw new Error('DATABASE_URL (or NEON_DATABASE_URL) is required when running with Postgres');
  const pool = new Pool({ connectionString: DATABASE_URL });
  // create tables if not exist (users + relations)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS days (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      subtitle TEXT,
      completed BOOLEAN DEFAULT FALSE,
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      duration_seconds INTEGER
    );
  `);

  console.log('initPg: ensured days table (creating or verifying)');
  // If this database had an older schema without `user_id` on days, ensure it's added.
  console.log('initPg: ensuring days.user_id column exists (ALTER TABLE)');
  await pool.query(`ALTER TABLE days ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;`);
  console.log('initPg: ensured days.user_id');

  // Ensure share_code column exists for sharing/importing day templates
  await pool.query(`ALTER TABLE days ADD COLUMN IF NOT EXISTS share_code TEXT;`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_days_share_code ON days(share_code);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workouts (
      id SERIAL PRIMARY KEY,
      day_id INTEGER REFERENCES days(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      planned_sets INTEGER,
      planned_reps INTEGER,
      youtube TEXT,
      current_weight NUMERIC,
      completed BOOLEAN DEFAULT FALSE,
      position INTEGER
    );
  `);

  console.log('initPg: ensured workouts table (creating or verifying)');
  // Ensure older DBs gain the user_id column on workouts if it's missing.
  console.log('initPg: ensuring workouts.user_id column exists (ALTER TABLE)');
  await pool.query(`ALTER TABLE workouts ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;`);
  console.log('initPg: ensured workouts.user_id');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS logs (
      id SERIAL PRIMARY KEY,
      workout_id INTEGER REFERENCES workouts(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      series INTEGER,
      reps INTEGER,
      weight NUMERIC,
      date TIMESTAMPTZ
    );
  `);

  console.log('initPg: ensured logs table (creating or verifying)');
  // Ensure older DBs gain the user_id column on logs if it's missing.
  console.log('initPg: ensuring logs.user_id column exists (ALTER TABLE)');
  await pool.query(`ALTER TABLE logs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;`);
  console.log('initPg: ensured logs.user_id');

  return pool;
}

// NOTE: JSON file fallback removed. All read/write operations use Postgres.

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
  async createUser(name, email, passwordHash) {
    if (usePg) {
      const pool = await ensurePg();
      const res = await pool.query('INSERT INTO users(name, email, password_hash) VALUES($1,$2,$3) RETURNING id, name, email, created_at AS "createdAt"', [name || null, String(email).toLowerCase(), passwordHash]);
      return res.rows[0];
    }
    const db = loadFile(); db._ids.users = (db._ids.users||0) + 1; const u = { id: db._ids.users, name: name || null, email: String(email).toLowerCase(), password_hash: passwordHash, createdAt: new Date().toISOString() }; db.users = db.users || []; db.users.push(u); saveFile(db); return u;
  },

  async getUserByEmail(email) {
    if (usePg) {
      const pool = await ensurePg(); const res = await pool.query('SELECT id, name, email, password_hash AS "passwordHash", created_at AS "createdAt" FROM users WHERE email=$1', [String(email).toLowerCase()]); return res.rows[0] || null;
    }
    const db = loadFile(); db.users = db.users || []; return db.users.find(u => u.email === String(email).toLowerCase()) || null;
  },

  async getUserById(id) {
    if (usePg) {
      const pool = await ensurePg(); const res = await pool.query('SELECT id, name, email, created_at AS "createdAt" FROM users WHERE id=$1', [Number(id)]); return res.rows[0] || null;
    }
    const db = loadFile(); db.users = db.users || []; return db.users.find(u => u.id === Number(id)) || null;
  },

  async getDays() {
    // optional userId parameter
    const args = Array.from(arguments);
    const userId = args.length ? args[0] : null;
    if (usePg) {
      const pool = await ensurePg();
      if (userId) {
        const res = await pool.query('SELECT id, name, subtitle, completed, started_at AS "startedAt", finished_at AS "finishedAt", duration_seconds AS "durationSeconds", share_code AS "shareCode" FROM days WHERE user_id=$1 ORDER BY id', [Number(userId)]);
        return res.rows.map(r => ({ ...r }));
      } else {
        const res = await pool.query('SELECT id, name, subtitle, completed, started_at AS "startedAt", finished_at AS "finishedAt", duration_seconds AS "durationSeconds", share_code AS "shareCode" FROM days ORDER BY id');
        return res.rows.map(r => ({ ...r }));
      }
    }
    const db = loadFile();
    // normalize file-based objects to match Postgres shape
    const norm = (d) => ({ id: d.id, userId: d.user_id || d.userId || null, name: d.name, subtitle: d.subtitle, completed: !!d.completed, startedAt: d.startedAt || d.started_at || null, finishedAt: d.finishedAt || d.finished_at || null, durationSeconds: d.durationSeconds || d.duration_seconds || null, shareCode: d.share_code || d.shareCode || null });
    if (userId) return db.days.filter(d => (d.user_id || d.userId) === Number(userId)).map(norm);
    return db.days.map(norm);
  },

  async getDayById(id) {
    if (!id) return null;
    if (usePg) {
      const pool = await ensurePg();
      const res = await pool.query('SELECT id, user_id AS "userId", name, subtitle, completed, started_at AS "startedAt", finished_at AS "finishedAt", duration_seconds AS "durationSeconds", share_code AS "shareCode" FROM days WHERE id=$1', [Number(id)]);
      return res.rows[0] || null;
    }
    const db = loadFile(); db.days = db.days || []; const d = db.days.find(d => d.id === Number(id)) || null; if (!d) return null; return { id: d.id, userId: d.user_id || d.userId || null, name: d.name, subtitle: d.subtitle, completed: !!d.completed, startedAt: d.startedAt || d.started_at || null, finishedAt: d.finishedAt || d.finished_at || null, durationSeconds: d.durationSeconds || d.duration_seconds || null, shareCode: d.share_code || d.shareCode || null };
  },

  async addDay(name, subtitle) {
    // signature: addDay(name, subtitle, userId?)
    const args = Array.from(arguments);
    const userId = args.length>2 ? args[2] : null;
    if (usePg) {
      const pool = await ensurePg();
      const res = await pool.query('INSERT INTO days(user_id, name, subtitle, share_code) VALUES($1,$2,$3,$4) RETURNING id, user_id AS "userId", name, subtitle, completed, started_at AS "startedAt", finished_at AS "finishedAt", duration_seconds AS "durationSeconds", share_code AS "shareCode"', [userId||null, name, subtitle || null, args.length>3 ? args[3] : null]);
      return res.rows[0];
    }
    const db = loadFile(); db._ids.days += 1; const d = { id: db._ids.days, user_id: userId||null, name, subtitle: subtitle || null, completed: false, startedAt: null, finishedAt: null, durationSeconds: null }; db.days.push(d); saveFile(db); return d;
  },

  async getDayByShareCode(code) {
    if (!code) return null;
    if (usePg) {
      const pool = await ensurePg(); const res = await pool.query('SELECT id, user_id AS "userId", name, subtitle, completed, started_at AS "startedAt", finished_at AS "finishedAt", duration_seconds AS "durationSeconds", share_code AS "shareCode" FROM days WHERE share_code=$1 LIMIT 1', [String(code)]); return res.rows[0] || null;
    }
    const db = loadFile(); db.days = db.days || []; return db.days.find(d => d.share_code === String(code)) || null;
  },

  async copyDayByShareCode(code, targetUserId) {
    if (!code) return null;
    const src = await this.getDayByShareCode(code);
    if (!src) return null;
    // create new day for target user
    const newDay = await this.addDay(src.name, src.subtitle, targetUserId);
    // fetch workouts from source (no user scope)
    const wks = await this.getWorkoutsByDay(src.id);
    for (const w of wks) {
      await this.addWorkout(newDay.id, { name: w.name, plannedSets: w.plannedSets, plannedReps: w.plannedReps, youtube: w.youtube }, targetUserId);
    }
    return newDay;
  },

  async setDayShareCode(dayId, code, userId) {
    if (!dayId) return null;
    if (usePg) {
      const pool = await ensurePg();
      const res = userId ? await pool.query('UPDATE days SET share_code=$1 WHERE id=$2 AND user_id=$3 RETURNING id, user_id AS "userId", name, subtitle, share_code AS "shareCode"', [code, Number(dayId), Number(userId)]) : await pool.query('UPDATE days SET share_code=$1 WHERE id=$2 RETURNING id, user_id AS "userId", name, subtitle, share_code AS "shareCode"', [code, Number(dayId)]);
      return res.rows[0] || null;
    }
    const db = loadFile(); const did = Number(dayId); const day = db.days.find(d=>d.id===did); if (!day) return null; day.share_code = code; saveFile(db); return day;
  },

  async getWorkoutsByDay(dayId) {
    // signature: getWorkoutsByDay(dayId, userId?)
    const args = Array.from(arguments);
    const userId = args.length>1 ? args[1] : null;
    if (usePg) {
      const pool = await ensurePg();
      if (userId) {
        const res = await pool.query('SELECT id, day_id AS "day_id", name, planned_sets AS "plannedSets", planned_reps AS "plannedReps", youtube, current_weight AS "currentWeight", completed, position FROM workouts WHERE day_id=$1 AND user_id=$2 ORDER BY position NULLS LAST, id', [Number(dayId), Number(userId)]);
        return res.rows.map(r => ({ id: r.id, day_id: r.day_id, name: r.name, plannedSets: r.plannedSets, plannedReps: r.plannedReps, youtube: r.youtube, currentWeight: r.currentweight === null ? null : Number(r.currentweight), completed: r.completed, position: r.position }));
      }
      const res = await pool.query('SELECT id, day_id AS "day_id", name, planned_sets AS "plannedSets", planned_reps AS "plannedReps", youtube, current_weight AS "currentWeight", completed, position FROM workouts WHERE day_id=$1 ORDER BY position NULLS LAST, id', [Number(dayId)]);
      return res.rows.map(r => ({ id: r.id, day_id: r.day_id, name: r.name, plannedSets: r.plannedSets, plannedReps: r.plannedReps, youtube: r.youtube, currentWeight: r.currentweight === null ? null : Number(r.currentweight), completed: r.completed, position: r.position }));
    }
    const db = loadFile(); return db.workouts.filter(w => w.day_id === Number(dayId)).slice().sort((a,b)=> (a.position||0) - (b.position||0));
  },

  async addWorkout(dayId, { name, plannedSets, plannedReps, youtube }) {
    // signature: addWorkout(dayId, payload, userId?)
    const args = Array.from(arguments);
    const userId = args.length>2 ? args[2] : null;
    if (usePg) {
      const pool = await ensurePg();
      // determine next position
      const posRes = await pool.query('SELECT COALESCE(MAX(position),0) + 1 AS nextpos FROM workouts WHERE day_id=$1', [Number(dayId)]);
      const nextPos = posRes.rows[0].nextpos || 1;
      const res = await pool.query('INSERT INTO workouts(day_id, user_id, name, planned_sets, planned_reps, youtube, position) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id, day_id, user_id AS "userId", name, planned_sets AS "plannedSets", planned_reps AS "plannedReps", youtube, current_weight AS "currentWeight", completed, position', [Number(dayId), userId||null, name, Number(plannedSets||0), Number(plannedReps||0), youtube||null, nextPos]);
      const r = res.rows[0]; return { id: r.id, day_id: r.day_id, userId: r.userid, name: r.name, plannedSets: r.plannedsets, plannedReps: r.plannedreps, youtube: r.youtube, currentWeight: r.currentweight === null ? null : Number(r.currentweight), completed: r.completed, position: r.position };
    }
    const db = loadFile(); db._ids.workouts += 1; const dayNum = Number(dayId); const positions = db.workouts.filter(w => w.day_id === dayNum).map(w => w.position || 0); const nextPos = positions.length ? Math.max(...positions) + 1 : 1; const w = { id: db._ids.workouts, day_id: dayNum, user_id: userId||null, name, plannedSets: Number(plannedSets||0), plannedReps: Number(plannedReps||0), youtube: youtube||null, currentWeight: null, completed: false, position: nextPos }; db.workouts.push(w); saveFile(db); return w;
  },

  async setCompleted(workoutId, completed) {
    // signature: setCompleted(workoutId, completed, userId?)
    const args = Array.from(arguments);
    const userId = args.length>2 ? args[2] : null;
    if (usePg) {
      const pool = await ensurePg();
      const res = userId ? await pool.query('UPDATE workouts SET completed=$1 WHERE id=$2 AND user_id=$3 RETURNING id, day_id AS "day_id", name, planned_sets AS "plannedSets", planned_reps AS "plannedReps", youtube, current_weight AS "currentWeight", completed, position', [!!completed, Number(workoutId), Number(userId)]) : await pool.query('UPDATE workouts SET completed=$1 WHERE id=$2 RETURNING id, day_id AS "day_id", name, planned_sets AS "plannedSets", planned_reps AS "plannedReps", youtube, current_weight AS "currentWeight", completed, position', [!!completed, Number(workoutId)]);
      return res.rows[0] || null;
    }
    const db = loadFile(); const w = db.workouts.find(x => x.id === Number(workoutId)); if (!w) return null; w.completed = !!completed; saveFile(db); return w;
  },

  async setCurrentWeight(workoutId, weight) {
    // signature: setCurrentWeight(workoutId, weight, userId?)
    const args = Array.from(arguments);
    const userId = args.length>2 ? args[2] : null;
    if (usePg) {
      const pool = await ensurePg();
      const val = weight === null ? null : Number(weight);
      const res = userId ? await pool.query('UPDATE workouts SET current_weight=$1 WHERE id=$2 AND user_id=$3 RETURNING id, day_id AS "day_id", name, planned_sets AS "plannedSets", planned_reps AS "plannedReps", youtube, current_weight AS "currentWeight", completed, position', [val, Number(workoutId), Number(userId)]) : await pool.query('UPDATE workouts SET current_weight=$1 WHERE id=$2 RETURNING id, day_id AS "day_id", name, planned_sets AS "plannedSets", planned_reps AS "plannedReps", youtube, current_weight AS "currentWeight", completed, position', [val, Number(workoutId)]);
      const r = res.rows[0]; if (!r) return null; return { id: r.id, day_id: r.day_id, name: r.name, plannedSets: r.plannedsets, plannedReps: r.plannedreps, youtube: r.youtube, currentWeight: r.currentweight === null ? null : Number(r.currentweight), completed: r.completed, position: r.position };
    }
    const db = loadFile(); const w = db.workouts.find(x => x.id === Number(workoutId)); if (!w) return null; w.currentWeight = weight === null ? null : Number(weight); saveFile(db); return w;
  },

  async updateWorkout(workoutId, payload) {
    // signature: updateWorkout(workoutId, { name, plannedSets, plannedReps, youtube }, userId?)
    const args = Array.from(arguments);
    const userId = args.length>2 ? args[2] : null;
    const { name, plannedSets, plannedReps, youtube } = payload || {};
    if (usePg) {
      const pool = await ensurePg();
      if (userId) {
        const res = await pool.query('UPDATE workouts SET name=$1, planned_sets=$2, planned_reps=$3, youtube=$4 WHERE id=$5 AND user_id=$6 RETURNING id, day_id AS "day_id", user_id AS "userId", name, planned_sets AS "plannedSets", planned_reps AS "plannedReps", youtube, current_weight AS "currentWeight", completed, position', [name, Number(plannedSets||0), Number(plannedReps||0), youtube||null, Number(workoutId), Number(userId)]);
        const r = res.rows[0]; if (!r) return null; return { id: r.id, day_id: r.day_id, name: r.name, plannedSets: r.plannedsets, plannedReps: r.plannedreps, youtube: r.youtube, currentWeight: r.currentweight === null ? null : Number(r.currentweight), completed: r.completed, position: r.position };
      }
      const res = await pool.query('UPDATE workouts SET name=$1, planned_sets=$2, planned_reps=$3, youtube=$4 WHERE id=$5 RETURNING id, day_id AS "day_id", user_id AS "userId", name, planned_sets AS "plannedSets", planned_reps AS "plannedReps", youtube, current_weight AS "currentWeight", completed, position', [name, Number(plannedSets||0), Number(plannedReps||0), youtube||null, Number(workoutId)]);
      const r = res.rows[0]; if (!r) return null; return { id: r.id, day_id: r.day_id, name: r.name, plannedSets: r.plannedsets, plannedReps: r.plannedreps, youtube: r.youtube, currentWeight: r.currentweight === null ? null : Number(r.currentweight), completed: r.completed, position: r.position };
    }
    const db = loadFile(); const w = db.workouts.find(x => x.id === Number(workoutId)); if (!w) return null; if (name !== undefined) w.name = name; if (plannedSets !== undefined) w.plannedSets = Number(plannedSets||0); if (plannedReps !== undefined) w.plannedReps = Number(plannedReps||0); if (youtube !== undefined) w.youtube = youtube || null; saveFile(db); return w;
  },

  async addLog(workoutId, { series, reps, weight, date }) {
    // signature: addLog(workoutId, payload, userId?)
    const args = Array.from(arguments);
    const userId = args.length>2 ? args[2] : null;
    if (usePg) {
      const pool = await ensurePg();
      const d = date || new Date().toISOString();
      const res = await pool.query('INSERT INTO logs(workout_id, user_id, series, reps, weight, date) VALUES($1,$2,$3,$4,$5,$6) RETURNING id, workout_id AS "workout_id", user_id AS "userId", series, reps, weight, date', [Number(workoutId), userId||null, Number(series), Number(reps), Number(weight), d]);
      return res.rows[0];
    }
    const db = loadFile(); db._ids.logs += 1; const l = { id: db._ids.logs, workout_id: Number(workoutId), series: Number(series), reps: Number(reps), weight: Number(weight), date: date||new Date().toISOString() }; db.logs.push(l); saveFile(db); return l;
  },

  async getLogsByWorkout(workoutId) {
    // signature: getLogsByWorkout(workoutId, userId?)
    const args = Array.from(arguments);
    const userId = args.length>1 ? args[1] : null;
    if (usePg) {
      const pool = await ensurePg();
      if (userId) {
        const res = await pool.query('SELECT id, workout_id AS "workout_id", series, reps, weight, date FROM logs WHERE workout_id=$1 AND user_id=$2 ORDER BY date DESC', [Number(workoutId), Number(userId)]);
        return res.rows.map(r => ({ id: r.id, workout_id: r.workout_id, series: r.series, reps: r.reps, weight: Number(r.weight), date: r.date }));
      }
      const res = await pool.query('SELECT id, workout_id AS "workout_id", series, reps, weight, date FROM logs WHERE workout_id=$1 ORDER BY date DESC', [Number(workoutId)]);
      return res.rows.map(r => ({ id: r.id, workout_id: r.workout_id, series: r.series, reps: r.reps, weight: Number(r.weight), date: r.date }));
    }
    const db = loadFile(); return db.logs.filter(l => l.workout_id === Number(workoutId)).sort((a,b)=> new Date(b.date)-new Date(a.date));
  },

  // small helper
  async getWorkout(id) {
    // signature: getWorkout(id, userId?)
    const args = Array.from(arguments);
    const userId = args.length>1 ? args[1] : null;
    if (usePg) {
      const pool = await ensurePg();
      const res = userId ? await pool.query('SELECT id, day_id AS "day_id", user_id AS "userId", name, planned_sets AS "plannedSets", planned_reps AS "plannedReps", youtube, current_weight AS "currentWeight", completed, position FROM workouts WHERE id=$1 AND user_id=$2', [Number(id), Number(userId)]) : await pool.query('SELECT id, day_id AS "day_id", user_id AS "userId", name, planned_sets AS "plannedSets", planned_reps AS "plannedReps", youtube, current_weight AS "currentWeight", completed, position FROM workouts WHERE id=$1', [Number(id)]);
      return res.rows[0] || null;
    }
    const db = loadFile(); return db.workouts.find(w=>w.id===Number(id))||null;
  },

  async deleteWorkout(workoutId) {
    // signature: deleteWorkout(workoutId, userId?)
    const args = Array.from(arguments);
    const userId = args.length>1 ? args[1] : null;
    if (usePg) {
      const pool = await ensurePg(); const res = userId ? await pool.query('DELETE FROM workouts WHERE id=$1 AND user_id=$2', [Number(workoutId), Number(userId)]) : await pool.query('DELETE FROM workouts WHERE id=$1', [Number(workoutId)]); return res.rowCount>0;
    }
    const db = loadFile(); const wid = Number(workoutId); const idx = db.workouts.findIndex(w => w.id === wid); if (idx === -1) return false; db.workouts.splice(idx, 1); db.logs = db.logs.filter(l => l.workout_id !== wid); saveFile(db); return true;
  },

  async updateWorkoutPositions(dayId, orderedIds) {
    // signature: updateWorkoutPositions(dayId, orderedIds, userId?)
    const args = Array.from(arguments);
    const userId = args.length>2 ? args[2] : null;
    if (usePg) {
      const pool = await ensurePg(); if (!Array.isArray(orderedIds)) return false; const client = await pool.connect(); try { await client.query('BEGIN'); for (let i=0;i<orderedIds.length;i++){ const wid = Number(orderedIds[i]); if (userId) { await client.query('UPDATE workouts SET position=$1 WHERE id=$2 AND day_id=$3 AND user_id=$4', [i+1, wid, Number(dayId), Number(userId)]); } else { await client.query('UPDATE workouts SET position=$1 WHERE id=$2 AND day_id=$3', [i+1, wid, Number(dayId)]); } } await client.query('COMMIT'); return true; } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    }
    const db = loadFile(); const did = Number(dayId); if (!Array.isArray(orderedIds)) return false; let changed=false; orderedIds.forEach((wid, idx)=>{ const w = db.workouts.find(x=>x.id===Number(wid)&&x.day_id===did); if (w && w.position!==idx+1){ w.position=idx+1; changed=true;} }); if (changed) saveFile(db); return true;
  },

  async deleteDay(dayId) {
    // signature: deleteDay(dayId, userId?)
    const args = Array.from(arguments);
    const userId = args.length>1 ? args[1] : null;
    if (usePg) {
      const pool = await ensurePg(); const res = userId ? await pool.query('DELETE FROM days WHERE id=$1 AND user_id=$2', [Number(dayId), Number(userId)]) : await pool.query('DELETE FROM days WHERE id=$1', [Number(dayId)]); return res.rowCount>0;
    }
    const db = loadFile(); const did = Number(dayId); const idx = db.days.findIndex(d => d.id === did); if (idx === -1) return false; db.days.splice(idx, 1); const workoutsToRemove = db.workouts.filter(w => w.day_id === did).map(w => w.id); db.workouts = db.workouts.filter(w => w.day_id !== did); db.logs = db.logs.filter(l => !workoutsToRemove.includes(l.workout_id)); saveFile(db); return true;
  },

  // start/complete a day
  async startDay(dayId) {
    // signature: startDay(dayId, userId?)
    const args = Array.from(arguments);
    const userId = args.length>1 ? args[1] : null;
    if (usePg) {
      const pool = await ensurePg(); const now = new Date().toISOString(); const res = userId ? await pool.query('UPDATE days SET completed=false, started_at=$1, finished_at=NULL, duration_seconds=NULL WHERE id=$2 AND user_id=$3 RETURNING id, user_id AS "userId", name, subtitle, completed, started_at AS "startedAt", finished_at AS "finishedAt", duration_seconds AS "durationSeconds"', [now, Number(dayId), Number(userId)]) : await pool.query('UPDATE days SET completed=false, started_at=$1, finished_at=NULL, duration_seconds=NULL WHERE id=$2 RETURNING id, user_id AS "userId", name, subtitle, completed, started_at AS "startedAt", finished_at AS "finishedAt", duration_seconds AS "durationSeconds"', [now, Number(dayId)]);
      // also mark workouts not completed (scoped)
      if (userId) await pool.query('UPDATE workouts SET completed=false WHERE day_id=$1 AND user_id=$2', [Number(dayId), Number(userId)]);
      else await pool.query('UPDATE workouts SET completed=false WHERE day_id=$1', [Number(dayId)]);
      return res.rows[0] || null;
    }
    const db = loadFile(); const did = Number(dayId); const day = db.days.find(d => d.id === did); if (!day) return false; day.completed = false; day.startedAt = new Date().toISOString(); day.finishedAt = null; day.durationSeconds = null; db.workouts.forEach(w => { if (w.day_id === did) w.completed = false; }); saveFile(db); return day;
  },

  async completeDay(dayId) {
    // signature: completeDay(dayId, userId?)
    const args = Array.from(arguments);
    const userId = args.length>1 ? args[1] : null;
    if (usePg) {
      const pool = await ensurePg(); const now = new Date(); // compute duration if started_at exists
      // fetch started_at
      const sres = userId ? await pool.query('SELECT started_at FROM days WHERE id=$1 AND user_id=$2', [Number(dayId), Number(userId)]) : await pool.query('SELECT started_at FROM days WHERE id=$1', [Number(dayId)]);
      if (sres.rowCount===0) return false;
      const startedAt = sres.rows[0].started_at;
      let duration = null;
      if (startedAt) {
        const started = new Date(startedAt).getTime();
        duration = Math.max(0, Math.round((now.getTime() - started)/1000));
      }
      const fres = userId ? await pool.query('UPDATE days SET completed=true, finished_at=$1, duration_seconds=COALESCE($2,duration_seconds), started_at=NULL WHERE id=$3 AND user_id=$4 RETURNING id, user_id AS "userId", name, subtitle, completed, started_at AS "startedAt", finished_at AS "finishedAt", duration_seconds AS "durationSeconds"', [now.toISOString(), duration, Number(dayId), Number(userId)]) : await pool.query('UPDATE days SET completed=true, finished_at=$1, duration_seconds=COALESCE($2,duration_seconds), started_at=NULL WHERE id=$3 RETURNING id, name, subtitle, completed, started_at AS "startedAt", finished_at AS "finishedAt", duration_seconds AS "durationSeconds"', [now.toISOString(), duration, Number(dayId)]);
      if (userId) await pool.query('UPDATE workouts SET completed=true WHERE day_id=$1 AND user_id=$2', [Number(dayId), Number(userId)]);
      else await pool.query('UPDATE workouts SET completed=true WHERE day_id=$1', [Number(dayId)]);
      return fres.rows[0] || null;
    }
    const db = loadFile(); const did = Number(dayId); const day = db.days.find(d => d.id === did); if (!day) return false; day.completed = true; const now = new Date(); if (day.startedAt) { const started = new Date(day.startedAt).getTime(); day.durationSeconds = Math.max(0, Math.round((now.getTime() - started)/1000)); day.finishedAt = now.toISOString(); day.startedAt = null; } else { day.durationSeconds = day.durationSeconds || 0; day.finishedAt = now.toISOString(); } db.workouts.forEach(w => { if (w.day_id === did) w.completed = true; }); saveFile(db); return day;
  }
};
