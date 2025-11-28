const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'data.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    const init = { days: [], workouts: [], logs: [], _ids: { days: 0, workouts: 0, logs: 0 } };
    fs.writeFileSync(FILE, JSON.stringify(init, null, 2), 'utf8');
    return init;
  }
}

function save(db) {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2), 'utf8');
}

const db = load();

module.exports = {
  getDays() { return db.days.slice(); },
  addDay(name, subtitle) {
    db._ids.days += 1;
    const d = { id: db._ids.days, name, subtitle: subtitle || null, completed: false };
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
    db.workouts.forEach(w => { if (w.day_id === did) w.completed = false; });
    save(db);
    return true;
  },
  completeDay(dayId) {
    const did = Number(dayId);
    const day = db.days.find(d => d.id === did);
    if (!day) return false;
    day.completed = true;
    db.workouts.forEach(w => { if (w.day_id === did) w.completed = true; });
    save(db);
    return true;
  }
}
