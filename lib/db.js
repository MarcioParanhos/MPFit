const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_FILE = path.join(process.cwd(), 'data.json');
let FILE = DEFAULT_FILE;
let _usingTmp = false;

function load() {
  // try primary file, then fallback to tmp if needed
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    // if primary failed and we are not yet using tmp, try tmp location
    try {
      const tmp = path.join(os.tmpdir(), 'mpfit-data.json');
      if (FILE !== tmp) {
        FILE = tmp; _usingTmp = true;
      }
      return JSON.parse(fs.readFileSync(FILE, 'utf8'));
    } catch (e2) {
      // initialize fresh DB in whichever FILE we're using
      const init = { days: [], workouts: [], logs: [], _ids: { days: 0, workouts: 0, logs: 0 } };
      try {
        fs.writeFileSync(FILE, JSON.stringify(init, null, 2), 'utf8');
      } catch (e3) {
        // last resort: write to tmp and continue in-memory
        try {
          const tmp2 = path.join(os.tmpdir(), 'mpfit-data.json');
          FILE = tmp2; _usingTmp = true;
          fs.writeFileSync(FILE, JSON.stringify(init, null, 2), 'utf8');
        } catch (e4) {
          console.error('lib/db.js: failed to initialize any data file, continuing in-memory only', e4);
        }
      }
      return init;
    }
  }
}

function save(dbObj) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(dbObj, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('lib/db.js: failed to write to', FILE, err && err.stack ? err.stack : err);
    // attempt fallback to tmp dir if we haven't already
    if (!_usingTmp) {
      try {
        const tmp = path.join(os.tmpdir(), 'mpfit-data.json');
        fs.writeFileSync(tmp, JSON.stringify(dbObj, null, 2), 'utf8');
        FILE = tmp; _usingTmp = true;
        console.warn('lib/db.js: falling back to tmp file', tmp);
        return true;
      } catch (err2) {
        console.error('lib/db.js: fallback write also failed', err2 && err2.stack ? err2.stack : err2);
      }
    }
    // at this point, we cannot persist to disk; continue in-memory but do not throw
    return false;
  }
}

const db = load();

module.exports = {
  getDays() { return db.days.slice(); },
  addDay(name, subtitle) {
    db._ids.days += 1;
    const d = { id: db._ids.days, name, subtitle: subtitle || null, completed: false, startedAt: null, finishedAt: null, durationSeconds: null };
    db.days.push(d);
    save(db);
    return d;
  },
  getWorkoutsByDay(dayId) { return db.workouts.filter(w => w.day_id === Number(dayId)).slice().sort((a,b)=> (a.position||0) - (b.position||0)); },
  addWorkout(dayId, { name, plannedSets, plannedReps, youtube }) {
    db._ids.workouts += 1;
    // determine next position for the day
    const dayNum = Number(dayId);
    const positions = db.workouts.filter(w => w.day_id === dayNum).map(w => w.position || 0);
    const nextPos = positions.length ? Math.max(...positions) + 1 : 1;
    const w = { id: db._ids.workouts, day_id: dayNum, name, plannedSets: Number(plannedSets||0), plannedReps: Number(plannedReps||0), youtube: youtube||null, currentWeight: null, completed: false, position: nextPos };
    db.workouts.push(w); save(db); return w;
  },
  setCompleted(workoutId, completed) {
    const w = db.workouts.find(x => x.id === Number(workoutId));
    if (!w) return null;
    w.completed = !!completed;
    save(db);
    return w;
  },
  setCurrentWeight(workoutId, weight) {
    const w = db.workouts.find(x => x.id === Number(workoutId));
    if (!w) return null;
    w.currentWeight = weight === null ? null : Number(weight);
    save(db);
    return w;
  },
  addLog(workoutId, { series, reps, weight, date }) {
    db._ids.logs += 1; const l = { id: db._ids.logs, workout_id: Number(workoutId), series: Number(series), reps: Number(reps), weight: Number(weight), date: date||new Date().toISOString() };
    db.logs.push(l); save(db); return l;
  },
  getLogsByWorkout(workoutId) { return db.logs.filter(l => l.workout_id === Number(workoutId)).sort((a,b)=> new Date(b.date)-new Date(a.date)); },
  // small helpers
  getWorkout(id) { return db.workouts.find(w=>w.id===Number(id))||null; }
  ,
  deleteWorkout(workoutId) {
    const wid = Number(workoutId);
    const idx = db.workouts.findIndex(w => w.id === wid);
    if (idx === -1) return false;
    // remove workout
    db.workouts.splice(idx, 1);
    // remove associated logs
    db.logs = db.logs.filter(l => l.workout_id !== wid);
    save(db);
    return true;
  }
  ,
  updateWorkoutPositions(dayId, orderedIds) {
    const did = Number(dayId);
    // orderedIds: array of workout ids in desired order
    if (!Array.isArray(orderedIds)) return false;
    let changed = false;
    orderedIds.forEach((wid, idx) => {
      const w = db.workouts.find(x => x.id === Number(wid) && x.day_id === did);
      if (w && (w.position !== idx+1)) { w.position = idx+1; changed = true; }
    });
    if (changed) save(db);
    return true;
  }
  ,
  deleteDay(dayId) {
    const did = Number(dayId);
    const idx = db.days.findIndex(d => d.id === did);
    if (idx === -1) return false;
    // remove the day
    db.days.splice(idx, 1);
    // find workouts for this day
    const workoutsToRemove = db.workouts.filter(w => w.day_id === did).map(w => w.id);
    // remove workouts
    db.workouts = db.workouts.filter(w => w.day_id !== did);
    // remove associated logs
    db.logs = db.logs.filter(l => !workoutsToRemove.includes(l.workout_id));
    save(db);
    return true;
  }
  ,
  // start/complete a day: control completed flag on day and its workouts
  startDay(dayId) {
    const did = Number(dayId);
    const day = db.days.find(d => d.id === did);
    if (!day) return false;
    day.completed = false;
    day.startedAt = new Date().toISOString();
    day.finishedAt = null;
    day.durationSeconds = null;
    db.workouts.forEach(w => { if (w.day_id === did) w.completed = false; });
    save(db);
    return day;
  },
  completeDay(dayId) {
    const did = Number(dayId);
    const day = db.days.find(d => d.id === did);
    if (!day) return false;
    day.completed = true;
    const now = new Date();
    if (day.startedAt) {
      const started = new Date(day.startedAt).getTime();
      day.durationSeconds = Math.max(0, Math.round((now.getTime() - started)/1000));
      day.finishedAt = now.toISOString();
      day.startedAt = null;
    } else {
      day.durationSeconds = day.durationSeconds || 0;
      day.finishedAt = now.toISOString();
    }
    db.workouts.forEach(w => { if (w.day_id === did) w.completed = true; });
    save(db);
    return day;
  }
}
