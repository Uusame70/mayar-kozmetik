import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS ve XML başlığı
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');

  try {
    const supabaseUrl = 'https://xmrdqepjtfycvtgcbkyy.supabase.co';
    const supabaseKey = 'sb_publishable_MgJhvhCdIg9oC40t--FZxQ_04A8dWkU'; // Anon/Public key
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Ürünleri Supabase'den çekiyoruz
    const { data: products, error } = await supabase.from('products').select('*');

    if (error) {
      throw error;
    }

    // Meta'nın beklediği XML yapısını oluşturuyoruz
    let xml = `<?xml version="1.0" encoding="UTF-8" ?>`;
    xml += `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">`;
    xml += `<channel>`;
    xml += `<title>Mayar Kozmetik Katalog</title>`;
    xml += `<link>https://mayarkozmetik.vercel.app</link>`;
    xml += `<description>WhatsApp ve Meta Katalog Ürün Akışı</description>`;

    if (products && products.length > 0) {
      products.forEach(p => {
        // Görsel linkini düzenleme
        let imgUrl = p.img || '';
        const supabaseStorageBase = 'https://xmrdqepjtfycvtgcbkyy.supabase.co/storage/v1/object/public/product-images';
        if (imgUrl.startsWith(supabaseStorageBase)) {
          imgUrl = imgUrl.replace(supabaseStorageBase, 'https://mayarkozmetik.vercel.app/storage-img');
        }

        const title = p.name_tr || p.name_ar || 'Ürün';
        const description = p.desc_tr || p.desc_ar || title;
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
        xml += `</item>`;
      });
    }

    xml += `</channel>`;
    xml += `</rss>`;

    return res.status(200).send(xml);
  } catch (err) {
    console.error(err);
    return res.status(500).send(`<error>${err.message}</error>`);
  }
}
