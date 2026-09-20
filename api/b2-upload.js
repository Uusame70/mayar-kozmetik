// api/b2-upload.js
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

const B2_KEY_ID = process.env.B2_KEY_ID;
const B2_APP_KEY = process.env.B2_APP_KEY;
const B2_BUCKET = process.env.B2_BUCKET;
const B2_ENDPOINT = process.env.B2_ENDPOINT;
const B2_REGION = process.env.B2_REGION;

const SUPABASE_URL = 'https://xmrdqepjtfycvtgcbkyy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MgJhvhCdIg9oC40t--FZxQ_04A8dWkU';

const s3 = new S3Client({
  endpoint: B2_ENDPOINT,
  region: B2_REGION,
  credentials: { accessKeyId: B2_KEY_ID, secretAccessKey: B2_APP_KEY }
});

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid session' });

  try {
    const { base64, contentType } = req.body;
    if (!base64) return res.status(400).json({ error: 'Missing image' });

    const buffer = Buffer.from(base64.split(',')[1] || base64, 'base64');
    const ext = (contentType || 'image/webp').split('/')[1] || 'webp';
    const fileName = `admin/admin_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

    await s3.send(new PutObjectCommand({
      Bucket: B2_BUCKET,
      Key: fileName,
      Body: buffer,
      ContentType: contentType || 'image/webp'
    }));

    res.status(200).json({ key: fileName });
  } catch (err) {
    console.error('B2 upload error:', err);
    res.status(500).json({ error: err.message });
  }
}
