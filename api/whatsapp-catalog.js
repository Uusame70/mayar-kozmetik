// api/whatsapp-catalog.js
export default async function handler(req, res) {
  // Cache: 1 saat boyunca Vercel'de tut
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  const API_KEY = 'SENIN_2CHAT_API_KEYIN';
  const PHONE = '905074444502'; // Başına 90 ekleyerek yaz

  try {
    const url = `https://api.p.2chat.io/open/whatsapp/catalog/products?from_number=${PHONE}`;
    const response = await fetch(url, {
      headers: { 'X-User-API-Key': API_KEY }
    });
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error?.message || 'Katalog çekilemedi');
    }

    // WhatsApp ürünlerini sitendeki formata dönüştür
    const products = (data.products || []).map((p, index) => ({
      id: p.retailer_id || index + 1,        // WhatsApp'taki retailer_id
      name_ar: p.name || '',
      name_tr: p.name || '',
      price: parseFloat(p.price) || 0,
      desc_ar: p.description || '',
      desc_tr: p.description || '',
      img: p.images?.[0]?.url || '',          // İlk resmin URL'si
      groups: []                              // Grupları elle atayabilirsin
    }));

    res.status(200).json({ products, source: 'whatsapp' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
