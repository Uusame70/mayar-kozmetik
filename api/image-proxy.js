// api/image-proxy.js
export default async function handler(req, res) {
  const url = req.query.url;
  if (!url) return res.status(400).send('Missing url');

  const DEFAULT_API_KEY = 'UAK6f703c42-c939-4575-89cc-35922b2faca9';

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

  const API_KEY = req.query.api_key || DEFAULT_API_KEY;

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
