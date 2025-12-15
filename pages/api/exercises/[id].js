const db = require('../../../lib/db');
const { requireAuth } = require('../../../lib/auth');

export default async function handler(req, res) {
  const user = await requireAuth(req, res, db);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const id = req.query && req.query.id ? Number(req.query.id) : null;
  if (!id) return res.status(400).json({ error: 'id required' });

  if (req.method === 'GET') {
    try { const exs = await db.getExercises(); const ex = exs.find(x=>x.id===id) || null; return res.status(200).json(ex); } catch (e) { console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
  }

  // Only admin can update/delete
  if (!user.admin) return res.status(403).json({ error: 'forbidden' });

  if (req.method === 'PUT') {
    const { name, targetMuscle, equipment, imagePath, description, imageBase64 } = req.body || {};
    try {
      let finalImagePath = imagePath || null;
      // if imageBase64 provided, upload to cloud (prod) or save to disk in dev
      if (imageBase64 && String(imageBase64).startsWith('data:')) {
        const matches = String(imageBase64).match(/^data:(image\/[a-zA-Z0-9+.]+);base64,(.*)$/);
        if (matches) {
          // try Cloudinary unsigned upload if configured
          async function uploadToCloudinary(dataUrl) {
            const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
            const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
            if (!cloudName || !uploadPreset) return null;
            const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
            const form = new FormData();
            form.append('file', dataUrl);
            form.append('upload_preset', uploadPreset);
            const r = await fetch(url, { method: 'POST', body: form });
            if (!r.ok) {
              const t = await r.text().catch(()=>null);
              throw new Error(`Cloudinary upload failed: ${r.status} ${t}`);
            }
            const j = await r.json();
            return j.secure_url || j.url || null;
          }

          if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_UPLOAD_PRESET) {
            try {
              const url = await uploadToCloudinary(String(imageBase64));
              if (url) {
                finalImagePath = url;
              }
            } catch (errUpload) {
              console.error('[api/exercises/[id]] cloud upload failed', errUpload);
              return res.status(500).json({ error: 'image upload failed' });
            }
          }

          // fallback to local write only in dev
          if (!finalImagePath) {
            if (process.env.NODE_ENV === 'production') {
              return res.status(500).json({ error: 'cannot save files to disk in production; configure CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET' });
            }
            const fs = require('fs');
            const path = require('path');
            function ensureExercisesDir() { const dir = path.join(process.cwd(), 'public', 'images', 'exercises'); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); return dir; }
            const mime = matches[1];
            const ext = mime.split('/')[1].split('+')[0];
            const base64 = matches[2];
            const buf = Buffer.from(base64, 'base64');
            const fname = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
            const dir = ensureExercisesDir();
            const outPath = path.join(dir, fname);
            fs.writeFileSync(outPath, buf);
            finalImagePath = `/images/exercises/${fname}`;
          }
        }
      }
      const updated = await db.updateExercise(id, { name, targetMuscle, equipment, imagePath: finalImagePath, description });
      return res.status(200).json(updated);
    } catch (e) { console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
  }

  if (req.method === 'DELETE') {
    try { const ok = await db.deleteExercise(id); if (!ok) return res.status(404).json({ error: 'not found' }); return res.status(200).json({ success: true }); } catch (e) { console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
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
