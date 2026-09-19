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

  const headers = { 'X-User-API-Key': API_KEY };

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
    // ── 1. Koleksiyonları çek ──
    const colUrl = `https://api.p.2chat.io/open/whatsapp/catalog/collections?from_number=${PHONE}`;
    const colRes = await fetch(colUrl, { headers });
    const colData = await colRes.json();

    if (req.query.debug === '1') {
      return res.status(200).json({ step: 'debug_collections', status: colRes.status, data: colData });
    }

    if (colRes.status !== 200) {
      return res.status(500).json({
        step: '2chat_collections',
        status: colRes.status,
        message: colData?.detail || 'Koleksiyonlar çekilemedi',
        raw: colData
      });
    }

    const collections = colData.collections || [];

    // ── 2. Ürünleri koleksiyonlardan çıkar ──
    const productMap = new Map();
    const productGroupsMap = new Map();

    for (const col of collections) {
      const colInfo = {
        id: col.id,
        name_ar: col.name || '',
        name_tr: col.name || ''
      };

      const colProducts = col.products || [];
      for (const cp of colProducts) {
        const pid = String(cp.retailer_id || cp.id || '');
        if (!pid) continue;

        if (!productMap.has(pid)) {
          productMap.set(pid, {
            id: pid,
            name_ar: pickName(cp),
            name_tr: pickName(cp),
            price: pickPrice(cp),
            desc_ar: pickDesc(cp),
            desc_tr: pickDesc(cp),
            img: pickImg(cp),
            groups: []
          });
        }

        if (!productGroupsMap.has(pid)) {
          productGroupsMap.set(pid, []);
        }
        const groupsList = productGroupsMap.get(pid);
        if (!groupsList.some(g => g.id === colInfo.id)) {
          groupsList.push(colInfo);
        }
      }
    }

    // ── 3. Ürünlere grupları bağla ──
    const products = Array.from(productMap.values()).map(p => {
      p.groups = productGroupsMap.get(p.id) || [];
      return p;
    });

    // ── 4. Benzersiz grupları çıkar ──
    const groupMap = new Map();
    products.forEach(p => {
      (p.groups || []).forEach(g => {
        if (!groupMap.has(g.id)) groupMap.set(g.id, g);
      });
    });
    const groups = Array.from(groupMap.values());

    // ── 5. Hiç koleksiyon yoksa eski yönteme düş ──
    let finalProducts = products;
    if (products.length === 0) {
      const prodUrl = `https://api.p.2chat.io/open/whatsapp/catalog/products?from_number=${PHONE}`;
      const prodRes = await fetch(prodUrl, { headers });
      const prodData = await prodRes.json();
      const rawProducts = prodData.products || prodData.data || prodData.items || [];
      finalProducts = rawProducts.map((p, index) => {
        const name = pickName(p);
        return {
          id: String(p.retailer_id || p.id || index + 1),
          name_ar: name,
          name_tr: name,
          price: pickPrice(p),
          desc_ar: pickDesc(p),
          desc_tr: pickDesc(p),
          img: pickImg(p),
          groups: []
        };
      });
    }

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
      products: finalProducts,
      groups,
      settings,
      source: 'whatsapp',
      count: finalProducts.length,
      collectionsCount: collections.length,
      cachedAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ step: 'unhandled', error: err.message });
  }
}
