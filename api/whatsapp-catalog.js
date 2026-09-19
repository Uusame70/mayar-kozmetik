// api/whatsapp-catalog.js
export default async function handler(req, res) {
  const bust = req.query.bust === '1';
  if (bust) {
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
  } else {
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  }

  const API_KEY = 'SENIN_2CHAT_API_KEYIN';
  const PHONE = '905074444502';

  try {
    const url = `https://api.p.2chat.io/open/whatsapp/catalog/products?from_number=${PHONE}`;
    const response = await fetch(url, {
      headers: { 'X-User-API-Key': API_KEY }
    });
    const data = await response.json();

    // ═══════════════════════════════════════════════════════
    //  DEBUG: Ham cevabı görmek için ?debug=1 ekle
    //  Örnek: /api/whatsapp-catalog?debug=1
    // ═══════════════════════════════════════════════════════
    if (req.query.debug === '1') {
      return res.status(200).json(data);
    }

    if (!data.success && !data.products) {
      throw new Error(data.error?.message || 'Katalog çekilemedi');
    }

    // Farklı API sürümlerinde ürünler farklı alanlarda olabilir
    const rawProducts =
      data.products ||
      data.data ||
      data.items ||
      data.result?.products ||
      [];

    const products = rawProducts.map((p, index) => {
      // Olası alan isimlerini sırayla dene
      const name =
        p.name ||
        p.product_name ||
        p.productName ||
        p.title ||
        p.productTitle ||
        '';

      const description =
        p.description ||
        p.product_description ||
        p.productDescription ||
        p.desc ||
        p.caption ||
        p.productDescriptionText ||
        '';

      let price = 0;
      const priceRaw =
        p.price ||
        p.product_price ||
        p.productPrice ||
        p.amount ||
        p.price_value ||
        p.priceValue ||
        0;
      if (typeof priceRaw === 'string') {
        price = parseFloat(priceRaw.replace(/[^0-9.]/g, '')) || 0;
      } else {
        price = parseFloat(priceRaw) || 0;
      }

      // Görsel URL'sini farklı formatlardan çıkar
      let img = '';
      if (Array.isArray(p.images) && p.images.length > 0) {
        const first = p.images[0];
        img = typeof first === 'string' ? first : (first.url || first.link || first.src || '');
      } else if (p.image) {
        img = typeof p.image === 'string' ? p.image : (p.image.url || p.image.link || '');
      } else if (p.image_url) {
        img = p.image_url;
      } else if (p.imageUrl) {
        img = p.imageUrl;
      } else if (p.photo) {
        img = typeof p.photo === 'string' ? p.photo : (p.photo.url || '');
      }

      return {
        id: p.retailer_id || p.retailerId || p.id || index + 1,
        name,
        price,
        desc: description,
        img,
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
    res.status(500).json({ error: err.message });
  }
}
