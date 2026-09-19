// api/whatsapp-catalog.js
export default async function handler(req, res) {
  const bust = req.query.bust === '1';
  if (bust) {
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
  } else {
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  }

  // ═══════════════════════════════════════════════════════
  //  VARSAYILAN DEĞERLER — buradan değiştir
  //  Admin panelden yeni değer girilirse o öncelik kazanır
  // ═══════════════════════════════════════════════════════
  const DEFAULT_API_KEY = 'UAK6f703c42-c939-4575-89cc-35922b2faca9';
  const DEFAULT_PHONE = '905388444275';
  // ═══════════════════════════════════════════════════════

  const API_KEY = req.query.api_key || DEFAULT_API_KEY;
  const PHONE = req.query.phone || DEFAULT_PHONE;

  function pickName(p) {
    return p.name || p.name_ar || p.name_tr || '';
  }
  function pickDesc(p) {
    return p.description || p.desc_ar || p.desc_tr || '';
  }
  function pickPrice(p) {
    const raw = p.price ?? 0;
    if (typeof raw === 'string') return parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
    return parseFloat(raw) || 0;
  }
  function pickImg(p) {
    if (Array.isArray(p.images) && p.images.length > 0) {
      const f = p.images[0];
      return typeof f === 'string' ? f : (f.url || '');
    }
    if (p.image_url) return p.image_url;
    if (p.img) return p.img;
    return '';
  }

  try {
    const apiUrl = `https://api.p.2chat.io/open/whatsapp/catalog/products?from_number=${PHONE}`;
    const apiRes = await fetch(apiUrl, {
      headers: { 'X-User-API-Key': API_KEY }
    });

    const status = apiRes.status;
    let data;
    try {
      data = await apiRes.json();
    } catch (jsonErr) {
      return res.status(500).json({ step: '2chat_json_parse', status, error: 'API cevabı JSON değil' });
    }

    if (req.query.debug === '1') {
      return res.status(200).json({ step: 'debug', status, data });
    }

    if (status !== 200) {
      return res.status(500).json({
        step: '2chat_api',
        status,
        message: data?.detail || data?.error?.message || data?.message || 'Bilinmeyen 2Chat hatası',
        raw: data
      });
    }

    const rawProducts =
      data.products || data.data || data.items || data.result?.products || [];

    const products = rawProducts.map((p, index) => {
      const name = pickName(p);
      return {
        id: String(p.retailer_id || p.retailerId || p.id || index + 1),
        name_ar: name,
        name_tr: name,
        price: pickPrice(p),
        desc_ar: pickDesc(p),
        desc_tr: pickDesc(p),
        img: pickImg(p),
        groups: []
      };
    });

    const settings = {
      id: 1,
      lang: 'ar',
      phone: PHONE,
      wa_header: 'طلب جديد',
      custom_app_title: '',
      custom_delete_text: '',
      custom_add_text: '',
      custom_checkout_text: ''
    };

    res.status(200).json({
      products,
      groups: [],
      settings,
      source: 'whatsapp',
      count: products.length,
      cachedAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ step: 'unhandled', error: err.message });
  }
}
