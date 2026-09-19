import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xmrdqepjtfycvtgcbkyy.supabase.co',
  'sb_publishable_MgJhvhCdIg9oC40t--FZxQ_04A8dWkU'
);

export default async function handler(req, res) {
  // تخزين على Edge: 1 ساعة، stale-while-revalidate لـ 24 ساعة
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  try {
    const [{ data: products }, { data: productGroups }, { data: groups }, { data: settings }] =
      await Promise.all([
        supabase.from('products').select('*').order('id', { ascending: true }),
        supabase.from('product_groups').select('product_id, group_id'),
        supabase.from('groups').select('*'),
        supabase.from('settings').select('*').eq('id', 1).maybeSingle()
      ]);

    // ندمج المجموعات داخل كل منتج هنا (بدلاً من المتصفح)
    const groupById = new Map((groups || []).map(g => [g.id, g]));
    const productMap = new Map((products || []).map(p => [p.id, { ...p, groups: [] }]));
    (productGroups || []).forEach(pg => {
      const p = productMap.get(pg.product_id);
      const g = groupById.get(pg.group_id);
      if (p && g) p.groups.push(g);
    });

    res.status(200).json({
      products: Array.from(productMap.values()),
      groups: groups || [],
      settings: settings || null,
      cachedAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
