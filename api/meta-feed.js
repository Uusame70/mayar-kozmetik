import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Önbellek Başlığı: Cevabı 1 saat hafızada tutar, veritabanını yormaz
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  try {
    const supabaseUrl = 'https://xmrdqepjtfycvtgcbkyy.supabase.co';
    const supabaseKey = 'sb_publishable_MgJhvhCdIg9oC40t--FZxQ_04A8dWkU';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Sadece gerekli sütunları çekiyoruz (Performans optimizasyonu)
    const [{ data: products, error: pErr }, { data: productGroups }, { data: groups }] = await Promise.all([
      supabase.from('products').select('id, name_ar, name_tr, desc_ar, desc_tr, price, img'),
      supabase.from('product_groups').select('product_id, group_id'),
      supabase.from('groups').select('id, name_ar, name_tr')
    ]);

    if (pErr) throw pErr;

    const groupMap = new Map((groups || []).map(g => [g.id, g.name_ar || g.name_tr]));

    const productCategoryMap = new Map();
    (productGroups || []).forEach(pg => {
      const catName = groupMap.get(pg.group_id);
      if (catName) {
        if (!productCategoryMap.has(pg.product_id)) {
          productCategoryMap.set(pg.product_id, []);
        }
        productCategoryMap.get(pg.product_id).push(catName);
      }
    });

    let xml = `<?xml version="1.0" encoding="UTF-8" ?>`;
    xml += `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">`;
    xml += `<channel>`;
    xml += `<title>Mayar Kozmetik Catalog</title>`;
    xml += `<link>https://mayarkozmetik.vercel.app</link>`;
    xml += `<description>WhatsApp ve Meta Katalog Ürün Akışı</description>`;

    if (products && products.length > 0) {
      products.forEach(p => {
        let imgUrl = p.img || '';
        const supabaseStorageBase = 'https://xmrdqepjtfycvtgcbkyy.supabase.co/storage/v1/object/public/product-images';
        if (imgUrl.startsWith(supabaseStorageBase)) {
          imgUrl = imgUrl.replace(supabaseStorageBase, 'https://mayarkozmetik.vercel.app/storage-img');
        }

        const title = p.name_ar || p.name_tr || 'منتج';
        const description = p.desc_ar || p.desc_tr || title;

        const categories = productCategoryMap.get(p.id) || [];
        const category = categories.length > 0 ? categories.join(', ') : 'عام';
        const productLink = `https://mayarkozmetik.vercel.app/?product=${p.id}`;

        xml += `<item>`;
        xml += `<g:id>${p.id}</g:id>`;
        xml += `<g:title><![CDATA[${title}]]></g:title>`;
        xml += `<g:description><![CDATA[${description}]]></g:description>`;
        xml += `<g:link>${productLink}</g:link>`;
        xml += `<g:image_link>${imgUrl}</g:image_link>`;
        xml += `<g:availability>in stock</g:availability>`;
        xml += `<g:price>${p.price} TRY</g:price>`;
        xml += `<g:brand>Mayar Kozmetik</g:brand>`;
        xml += `<g:product_type><![CDATA[${category}]]></g:product_type>`;
        xml += `<g:custom_label_0><![CDATA[${category}]]></g:custom_label_0>`;
        xml += `</item>`;
      });
    }

    xml += `</channel>`;
    xml += `</rss>`;

    return res.status(200).send(xml);
  } catch (err) {
    return res.status(500).send(`<error>${err.message}</error>`);
  }
}
