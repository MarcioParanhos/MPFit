const fs = require('fs');
const path = require('path');
const db = require('../../../lib/db');
const { requireAuth } = require('../../../lib/auth');

function ensureExercisesDir() {
  const dir = path.join(process.cwd(), 'public', 'images', 'exercises');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res, db);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!user.admin) return res.status(403).json({ error: 'forbidden' });

  if (req.method === 'POST') {
    const { name, targetMuscle, equipment, description, imageBase64 } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
      let imagePath = null;
      if (imageBase64 && String(imageBase64).startsWith('data:')) {
        const matches = String(imageBase64).match(/^data:(image\/[a-zA-Z0-9+.]+);base64,(.*)$/);
        if (matches) {
          const mime = matches[1];
          const ext = mime.split('/')[1].split('+')[0];
          const base64 = matches[2];
          const buf = Buffer.from(base64, 'base64');
          const fname = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
          const dir = ensureExercisesDir();
          const outPath = path.join(dir, fname);
          fs.writeFileSync(outPath, buf);
          imagePath = `/images/exercises/${fname}`;
        }
      }
      const e = await db.addExercise({ name, targetMuscle, equipment, imagePath, description });
      return res.status(201).json(e);
    } catch (err) { console.error(err); return res.status(500).json({ error: String(err && err.message ? err.message : err) }); }
  }

  res.status(405).end();
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // allow larger base64 GIF uploads in dev
    },
  },
};
