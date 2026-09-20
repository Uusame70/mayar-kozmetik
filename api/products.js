// api/products.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xmrdqepjtfycvtgcbkyy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MgJhvhCdIg9oC40t--FZxQ_04A8dWkU';

export default async function handler(req, res) {
  const bust = req.query.bust === '1';

  if (bust) {
    // Admin cache bypass: taze veri
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  } else {
    // Müşteri: 5 dakika Vercel edge cache
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600');
    res.setHeader('CDN-Cache-Control', 'public, s-maxage=300');
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=300');
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data, error } = await supabase
      .from('whatsapp_products')
      .select('id, name, price, original_price, description, category, img, synced_at')
      .order('id', { ascending: false });

    if (error) throw error;

    const products = (data || []).map(p => {
      const cats = (p.category || '')
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);

      return {
        id: p.id,
        name_ar: p.name || '',
        name_tr: p.name || '',
        price: parseFloat(p.price) || 0,
        original_price: parseFloat(p.original_price) || 0,
        desc_ar: p.description || '',
        desc_tr: p.description || '',
        category: p.category || '',
        categories: cats,
        img: p.img || '',
        groups: []
      };
    });

    const categorySet = new Set();
    products.forEach(p => {
      p.categories.forEach(c => categorySet.add(c));
    });
    const categories = Array.from(categorySet).sort();

    const { data: logData } = await supabase
      .from('whatsapp_sync_log')
      .select('synced_at, total_count, success')
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    res.status(200).json({
      products,
      categories,
      groups: [],
      count: products.length,
      lastSync: logData || null,
      source: 'supabase',
      cachedAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
