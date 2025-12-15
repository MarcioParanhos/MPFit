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
      console.log('[api/admin/exercises] create request received for', name);
      let imagePath = null;
          if (imageBase64 && String(imageBase64).startsWith('data:')) {
            // basic size guard: avoid writing extremely large uploads
            const MAX_BASE64_LEN = 20 * 1024 * 1024; // allow up to ~20MB dataUrl
            if (String(imageBase64).length > MAX_BASE64_LEN) {
              console.warn('[api/admin/exercises] rejected image - base64 length exceeds limit', String(imageBase64).length);
              return res.status(413).json({ error: 'image too large' });
            }

            // If Cloudinary unsigned preset configured, upload there (recommended for production)
            async function uploadToCloudinary(dataUrl) {
              const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
              const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
              if (!cloudName || !uploadPreset) return null;
              const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
              const form = new FormData();
              form.append('file', dataUrl);
              form.append('upload_preset', uploadPreset);
              const resFetch = await fetch(url, { method: 'POST', body: form });
              if (!resFetch.ok) {
                const text = await resFetch.text().catch(()=>null);
                throw new Error(`Cloudinary upload failed: ${resFetch.status} ${text}`);
              }
              const j = await resFetch.json();
              return j.secure_url || j.url || null;
            }

            const matches = String(imageBase64).match(/^data:(image\/[a-zA-Z0-9+.]+);base64,(.*)$/);
            if (matches) {
              // try cloud upload first
              if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_UPLOAD_PRESET) {
                try {
                  const url = await uploadToCloudinary(String(imageBase64));
                  if (url) {
                    imagePath = url;
                    console.log('[api/admin/exercises] uploaded image to Cloudinary', url);
                  }
                } catch (errUpload) {
                  console.error('[api/admin/exercises] cloud upload failed', errUpload);
                  return res.status(500).json({ error: 'image upload failed' });
                }
              }

              // fallback: only write to local `public` in non-production (dev) environments
              if (!imagePath) {
                if (process.env.NODE_ENV === 'production') {
                  return res.status(500).json({ error: 'server cannot save files to disk in production; configure CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET' });
                }
                const mime = matches[1];
                const ext = mime.split('/')[1].split('+')[0];
                const base64 = matches[2];
                const buf = Buffer.from(base64, 'base64');
                const fname = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
                const dir = ensureExercisesDir();
                const outPath = path.join(dir, fname);
                await fs.promises.writeFile(outPath, buf);
                imagePath = `/images/exercises/${fname}`;
                console.log('[api/admin/exercises] wrote image to', outPath);
              }
            }
          }
      const e = await db.addExercise({ name, targetMuscle, equipment, imagePath, description });
      console.log('[api/admin/exercises] exercise created id=', e && e.id);
      return res.status(201).json(e);
    } catch (err) {
      console.error('[api/admin/exercises] error creating exercise', err);
      return res.status(500).json({ error: String(err && err.message ? err.message : err) });
    }
  }

  res.status(405).end();
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb', // allow larger base64 GIF uploads in dev
    },
  },
};
