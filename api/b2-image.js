// api/b2-image.js
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const B2_KEY_ID = process.env.B2_KEY_ID;
const B2_APP_KEY = process.env.B2_APP_KEY;
const B2_BUCKET = process.env.B2_BUCKET;
const B2_ENDPOINT = process.env.B2_ENDPOINT;
const B2_REGION = process.env.B2_REGION || 'us-west-004';

const s3 = new S3Client({
  endpoint: B2_ENDPOINT,
  region: B2_REGION,
  credentials: {
    accessKeyId: B2_KEY_ID,
    secretAccessKey: B2_APP_KEY
  }
});

export default async function handler(req, res) {
  const key = req.query.key;

  if (!key) return res.status(400).send('Missing key');

  // Sadece whatsapp/ ve admin/ klasörlerine izin ver
  if (!key.startsWith('whatsapp/') && !key.startsWith('admin/')) {
    return res.status(403).send('Forbidden');
  }

  try {
    const command = new GetObjectCommand({ Bucket: B2_BUCKET, Key: key });
    const response = await s3.send(command);
    const buffer = Buffer.from(await response.Body.transformToByteArray());

    res.setHeader('Content-Type', response.ContentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=604800');
    res.setHeader('CDN-Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Vercel-CDN-Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(buffer);
  } catch (err) {
    console.error('B2 proxy error:', err);
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return res.status(404).send('Image not found');
}
  }
}
