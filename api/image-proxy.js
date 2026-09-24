// api/image-proxy.js
export default async function handler(req, res) {
  const url = req.query.url;

  if (!url) return res.status(400).send('Missing url');

  if (!url.includes('2chat-user-data.s3') && !url.includes('2chat.io')) {
    return res.status(403).send('Forbidden');
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return res.status(upstream.status).send('Upstream error');
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get('content-type') || 'image/jpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=604800');
    res.setHeader('CDN-Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Vercel-CDN-Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(buffer);
  } catch (err) {
    console.error('Image proxy error:', err);
    res.status(500).send('Proxy error: ' + err.message);
  }
}