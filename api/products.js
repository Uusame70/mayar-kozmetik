// api/products.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xmrdqepjtfycvtgcbkyy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MgJhvhCdIg9oC40t--FZxQ_04A8dWkU';

export default async function handler(req, res) {
  const bust = req.query.bust === '1';
  if (bust) {
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
  } else {
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data, error } = await supabase
      .from('whatsapp_products')
      .select('*')
      .order('id', { ascending: false });

    if (error) throw error;

    // Frontend formatına dönüştür
    const products = (data || []).map(p => ({
      id: p.id,
      name_ar: p.name || '',
      name_tr: p.name || '',
      price: parseFloat(p.price) || 0,
      desc_ar: p.description || '',
      desc_tr: p.description || '',
      img: p.img || '',
      groups: []
    }));

    // Son sync zamanı
    const { data: logData } = await supabase
      .from('whatsapp_sync_log')
      .select('synced_at, total_count, success')
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    res.status(200).json({
      products,
      groups: [],
      count: products.length,
      lastSync: logData || null,
      source: 'supabase'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
