// api/whatsapp-catalog.js
export default async function handler(req, res) {
  const bust = req.query.bust === '1';
  if (bust) {
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
  } else {
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  }

  const API_KEY = req.query.api_key || process.env.TWOCHAT_API_KEY || '';
  const PHONE = req.query.phone || process.env.TWOCHAT_PHONE || '';

  if (!API_KEY || !PHONE) {
    return res.status(500).json({
      step: 'config_missing',
      error: 'API anahtarı veya telefon tanımlı değil.'
    });
  }

  const headers = { 'X-User-API-Key': API_KEY };

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
    // ── 1. Ürünleri çek ──
    const productsUrl = `https://api.p.2chat.io/open/whatsapp/catalog/products?from_number=${PHONE}`;
    const productsRes = await fetch(productsUrl, { headers });
    const productsData = await productsRes.json();

    if (req.query.debug === '1') {
      return res.status(200).json({ step: 'debug_products', data: productsData });
    }

    if (productsRes.status !== 200) {
      return res.status(500).json({
        step: '2chat_products',
        status: productsRes.status,
        message: productsData?.detail || 'Ürünler çekilemedi',
        raw: productsData
      });
    }

    const rawProducts = productsData.products || productsData.data || productsData.items || [];

    // ── 2. Koleksiyonları çek ──
    let collections = [];
    try {
      const colUrl = `https://api.p.2chat.io/open/whatsapp/catalog/collection?from_number=${PHONE}`;
      const colRes = await fetch(colUrl, { headers });
      const colData = await colRes.json();

      if (req.query.debug === '2') {
        return res.status(200).json({ step: 'debug_collections', data: colData });
      }

      if (colRes.status === 200) {
        collections = colData.collections || colData.data || colData.items || [];
      }
    } catch (e) {
      console.warn('Koleksiyonlar çekilemedi:', e.message);
    }

    // ── 3. Her koleksiyonun ürünlerini çek ve eşleştir ──
    // productId -> [collectionId, ...] haritası
    const productCollectionMap = new Map();

    for (const col of collections) {
      const colId = col.id || col.collection_id;
      if (!colId) continue;

      try {
        // Koleksiyon ürünlerini getiren endpoint (2Chat dokümanına göre)
        const colProductsUrl = `https://api.p.2chat.io/open/whatsapp/catalog/collection/${colId}/products?from_number=${PHONE}`;
        const cpRes = await fetch(colProductsUrl, { headers });
        const cpData = await cpRes.json();

        const colProducts = cpData.products || cpData.data || cpData.items || [];
        for (const cp of colProducts) {
          const pid = String(cp.retailer_id || cp.id || '');
          if (!pid) continue;
          if (!productCollectionMap.has(pid)) {
            productCollectionMap.set(pid, []);
          }
          productCollectionMap.get(pid).push({
            id: colId,
            name_ar: col.name || col.collection_name || '',
            name_tr: col.name || col.collection_name || ''
          });
        }
      } catch (e) {
        console.warn(`Koleksiyon ${colId} ürünleri çekilemedi:`, e.message);
      }
    }

    // ── 4. Ürünleri oluştur ──
    const products = rawProducts.map((p, index) => {
      const name = pickName(p);
      const pid = String(p.retailer_id || p.retailerId || p.id || index + 1);
      return {
        id: pid,
        name_ar: name,
        name_tr: name,
        price: pickPrice(p),
        desc_ar: pickDesc(p),
        desc_tr: pickDesc(p),
        img: pickImg(p),
        groups: productCollectionMap.get(pid) || []
      };
    });

    // ── 5. Benzersiz grupları çıkar ──
    const groupMap = new Map();
    products.forEach(p => {
      (p.groups || []).forEach(g => {
        if (!groupMap.has(g.id)) groupMap.set(g.id, g);
      });
    });
    const groups = Array.from(groupMap.values());

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
      groups,
      settings,
      source: 'whatsapp',
      count: products.length,
      collectionsCount: collections.length,
      cachedAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ step: 'unhandled', error: err.message });
  }
}
