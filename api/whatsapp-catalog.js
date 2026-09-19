// api/whatsapp-catalog.js
import { TWOCHAT_API_KEY as FALLBACK_KEY, TWOCHAT_PHONE as FALLBACK_PHONE } from './config.js';

export default async function handler(req, res) {
  const bust = req.query.bust === '1';
  if (bust) {
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
  } else {
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  }

  // Öncelik: query param (Supabase settings'ten gelir) > config.js fallback
  const API_KEY = req.query.api_key || FALLBACK_KEY;
  const PHONE = req.query.phone || FALLBACK_PHONE;

  if (!API_KEY || !PHONE) {
    return res.status(500).json({
      step: 'config_missing',
      error: 'API anahtarı veya telefon tanımlı değil. Admin panelden ayarlayın (mayar. yazıp giriş yapın).'
    });
  }

  function pickName(p) {
    return p.name_ar || p.name_tr || p.name || p.product_name || p.productName || p.title || '';
  }
  function pickDesc(p) {
    return p.desc_ar || p.desc_tr || p.description || p.product_description || p.desc || p.caption || '';
  }
  function pickPrice(p) {
    const raw = p.price ?? p.product_price ?? p.productPrice ?? p.amount ?? 0;
    if (typeof raw === 'string') return parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
    return parseFloat(raw) || 0;
  }
  function pickImg(p) {
    if (Array.isArray(p.images) && p.images.length > 0) {
      const f = p.images[0];
      return typeof f === 'string' ? f : (f.url || f.link || f.src || '');
    }
    if (p.img) return typeof p.img === 'string' ? p.img : (p.img.url || '');
    if (p.image) return typeof p.image === 'string' ? p.image : (p.image.url || '');
    if (p.image_url) return p.image_url;
    if (p.imageUrl) return p.imageUrl;
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
        id: p.retailer_id || p.retailerId || p.id || index + 1,
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
