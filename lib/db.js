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
  addDay(name) {
    db._ids.days += 1; const d = { id: db._ids.days, name }; db.days.push(d); save(db); return d;
  },
  getWorkoutsByDay(dayId) { return db.workouts.filter(w => w.day_id === Number(dayId)); },
  addWorkout(dayId, { name, plannedSets, plannedReps, youtube }) {
    db._ids.workouts += 1;
    const w = { id: db._ids.workouts, day_id: Number(dayId), name, plannedSets: Number(plannedSets||0), plannedReps: Number(plannedReps||0), youtube: youtube||null, currentWeight: null };
    db.workouts.push(w); save(db); return w;
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
}
