const db = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');

function startOfDayTs(d) {
  const dt = new Date(d);
  dt.setHours(0,0,0,0);
  return dt.getTime();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }

  try {
    const user = await requireAuth(req, res, db);
    if (!user) return res.status(401).json({ error: 'unauthorized' });

    const days = await db.getDays(user.id) || [];
    const totalDays = days.length;
    const completedDays = days.filter(d => !!d.completed).length;

    // fetch workouts for all days in parallel
    const workoutsNested = await Promise.all(days.map(d => db.getWorkoutsByDay(d.id, user.id)));
    const workouts = [].concat(...workoutsNested).filter(Boolean);
    const totalWorkouts = workouts.length;

    // fetch logs for all workouts
    const logsNested = await Promise.all(workouts.map(w => db.getLogsByWorkout(w.id)));
    const logs = [].concat(...logsNested).filter(Boolean);

    // compute total volume = sum(weight * reps)
    let totalVolume = 0;
    let lastWorkoutDate = null;
    for (const l of logs) {
      const w = Number(l.weight) || 0;
      const r = Number(l.reps) || 0;
      totalVolume += w * r;
      const d = new Date(l.date);
      if (!lastWorkoutDate || d.getTime() > new Date(lastWorkoutDate).getTime()) lastWorkoutDate = d.toISOString();
    }

    // weekly summary (last 7 days)
    const now = Date.now();
    const oneDay = 24 * 3600 * 1000;
    const daysMap = {};
    for (let i = 6; i >= 0; i--) {
      const ts = startOfDayTs(now - i * oneDay);
      daysMap[ts] = { date: new Date(ts).toISOString().slice(0,10), volume: 0, sessions: 0 };
    }
    for (const l of logs) {
      const t = new Date(l.date).getTime();
      const dayTs = startOfDayTs(t);
      if (dayTs in daysMap) {
        daysMap[dayTs].volume += (Number(l.weight) || 0) * (Number(l.reps) || 0);
        daysMap[dayTs].sessions += 1;
      }
    }
    const weekly = Object.values(daysMap);

    // recent days (last 6)
    const recentDays = days.slice().sort((a,b)=>{
      const ta = a.startedAt ? new Date(a.startedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const tb = b.startedAt ? new Date(b.startedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return tb - ta;
    }).slice(0,6).map(d=>({ id: d.id, name: d.name, subtitle: d.subtitle, completed: !!d.completed }));

    // average duration (seconds) — consider days that have durationSeconds or finishedAt/startedAt
    const durations = [];
    for (const d of days) {
      if (d.durationSeconds || d.durationSeconds === 0) {
        durations.push(Number(d.durationSeconds));
      } else if (d.startedAt && d.finishedAt) {
        const s = new Date(d.startedAt).getTime();
        const f = new Date(d.finishedAt).getTime();
        if (!isNaN(s) && !isNaN(f) && f > s) durations.push(Math.round((f - s) / 1000));
      }
    }
    const avgDurationSeconds = durations.length ? Math.round(durations.reduce((a,b)=>a+b,0) / durations.length) : null;

    return res.status(200).json({
      totalDays, completedDays, totalWorkouts, totalVolume, lastWorkoutDate, weekly, recentDays, avgDurationSeconds
    });
  } catch (e) {
    console.error('dashboard error', e);
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
