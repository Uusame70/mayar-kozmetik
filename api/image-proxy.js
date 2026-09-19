// api/image-proxy.js
import { TWOCHAT_API_KEY as FALLBACK_KEY } from './config.js';

export default async function handler(req, res) {
  const url = req.query.url;
  if (!url) return res.status(400).send('Missing url');

  const allowed = [
    '2chat-user-data.s3.amazonaws.com',
    's3.amazonaws.com',
    '2chat.io'
  ];
  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch (e) {
    return res.status(400).send('Invalid url');
  }
  if (!allowed.some(h => hostname === h || hostname.endsWith('.' + h))) {
    return res.status(403).send('Forbidden host');
  }

  const API_KEY = req.query.api_key || FALLBACK_KEY;
  if (!API_KEY) {
    return res.status(500).send('API key not configured');
  }

  try {
    const apiRes = await fetch(url, {
      headers: { 'X-User-API-Key': API_KEY }
    });

    if (!apiRes.ok) {
      return res.status(apiRes.status).send('Upstream error: ' + apiRes.status);
    }

    const contentType = apiRes.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await apiRes.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(buffer);
  } catch (err) {
    res.status(500).send('Proxy error: ' + err.message);
  }
}
