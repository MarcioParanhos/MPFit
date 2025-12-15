const { requireAuth } = require('../../../lib/auth');
const db = require('../../../lib/db');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const user = await requireAuth(req, res, db);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  try {
    const body = req.body || {};
    const weight = body.weight == null ? null : Number(body.weight);
    const height = body.height == null ? null : Number(body.height);
    const muscle = (body.muscle || '').trim() || null;

    function computeImc(w, h){ if (!w || !h) return null; return w / ((h/100)*(h/100)); }
    const imc = computeImc(weight, height);

    // require muscle and ensure it exists in DB's target_muscle values
    if (!muscle) return res.status(400).json({ error: 'Músculo alvo é obrigatório' });
    const allExercises = await db.getExercises();
    const musclesSet = new Set((allExercises || []).map(e => (e.targetMuscle || '').toLowerCase()).filter(Boolean));
    if (!musclesSet.has(muscle.toLowerCase())) return res.status(400).json({ error: `Músculo "${muscle}" não encontrado no banco de dados` });

    // filter exercises by targetMuscle (case-insensitive include)
    const matched = (allExercises || []).filter(e => e.targetMuscle && String(e.targetMuscle).toLowerCase().includes(String(muscle).toLowerCase()));
    // choose up to 10 exercises
    const count = Math.min(10, matched.length);
    const chosen = matched.slice(0, count);

    // determine sets/reps based on imc and muscle
    const sets = imc && imc >= 30 ? 2 : 3;
    const reps = (muscle && muscle.toLowerCase().includes('perna')) ? 6 : 10;

    const dayName = `Exercicio Personalizado`;
    const subtitle = imc ? `IMC ${imc.toFixed(1)}` : 'Gerado pelo assistente'

    const day = await db.addDay(dayName, subtitle, user.id);
    const createdWorkouts = [];
    for (const ex of chosen) {
      const w = await db.addWorkout(day.id, { name: ex.name, plannedSets: sets, plannedReps: reps, exerciseId: ex.id }, user.id);
      createdWorkouts.push(w);
    }

    const ws = await db.getWorkoutsByDay(day.id, user.id);
    return res.status(200).json({ day, workouts: ws });
  } catch (e) {
    console.error('assistant generate error', e);
    return res.status(500).json({ error: e.message || 'Erro inesperado' });
  }
}
