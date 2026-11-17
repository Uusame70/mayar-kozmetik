(function() {
    const SUPABASE_URL = 'https://mbzwxfyjqlfxdzadofbf.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_JmjCfGzzpAraLjHB0AaoHQ_xKfZI6lY';
    
    const B2_UPLOAD_URL = 'https://b2-upload.usameismail70.workers.dev'; 
    const B2_IMAGE_PROXY_URL = 'https://b2-image.usameismail70.workers.dev';

    let _supabase = null;
    let isAdmin = false;
    let sessionToken = null;
    let currentProducts = [];
    let currentPerfumes = [];
    let perfumeGroups = [];
    let intensities = [];
    let bottles = [];
    let prices = [];
    let siteSettings = {
        logo_url: '', slider_images: [], hero_title: 'متجر ميار للتسوق',
        hero_subtitle: 'جمالك يبدأ من هنا', free_shipping_text: 'احصل على شحن مجاني عند طلبك بقيمة 800 وأكثر',
        free_shipping_min: 800, whatsapp_number: '905388444275',
        custom_categories_order: [], pricing_lists: []
    };
    let currentSlide = 0;
    let sliderAutoplayTimer = null;
    let selectedCategory = 'ALL';
    let searchQuery = '';
    let cart = JSON.parse(localStorage.getItem('catalog_cart')) || [];
    let modalHistoryStack = [];
    let currentPerfumeSelection = { intensityId: null, bottleId: null, perfumeId: null };
    let currentProductImageUrl = '';
    let settingLogoFile = null;
    let settingSliderFiles = [];
    let currentPriceTagPerfumes = [];
    let currentPriceTagBulkPrices = {};
    let deviceId = localStorage.getItem('mayar_device_id');

    if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('mayar_device_id', deviceId);
    }

    window.showToast = function(message) {
        let toast = document.getElementById('globalToast');
        if (!toast) {
            toast = document.createElement('div'); toast.id = 'globalToast'; toast.className = 'toast'; document.body.appendChild(toast);
        }
        toast.innerHTML = `<svg class="icon" viewBox="0 0 24 24" style="color:var(--gold); width:1.2em; height:1.2em;"><path d="M20 6 9 17l-5-5"/></svg> <span>${message}</span>`;
        void toast.offsetWidth; toast.classList.add('show');
        clearTimeout(toast._t); toast._t = setTimeout(() => toast.classList.remove('show'), 2200);
    };

    function normalizeArabic(str) {
        if (!str) return '';
        return String(str).toLowerCase().replace(/[\u064B-\u065F\u0670]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/\s+/g, ' ').trim();
    }

    window.togglePasswordVisibility = function() {
        const inp = document.getElementById('login-password');
        const icon = document.getElementById('eye-icon');
        if (inp.type === 'password') {
            inp.type = 'text';
            icon.innerHTML = '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>';
        } else {
            inp.type = 'password';
            icon.innerHTML = '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>';
        }
    };

    window.pasteImage = async function(inputId, previewFuncName) {
        try {
            if (!navigator.clipboard || !navigator.clipboard.read) return alert('متصفحك لا يدعم خاصية اللصق.');
            const items = await navigator.clipboard.read();
            for (const item of items) {
                const type = item.types.find(t => t.startsWith('image/'));
                if (type) {
                    const blob = await item.getType(type);
                    const file = new File([blob], "pasted_image.png", { type });
                    const dt = new DataTransfer(); dt.items.add(file);
                    const input = document.getElementById(inputId); input.files = dt.files;
                    if (window[previewFuncName]) window[previewFuncName](input);
                    return;
                }
            }
            alert('لم يتم العثور على صورة في الحافظة.');
        } catch (err) { alert('يرجى السماح بالوصول إلى الحافظة.'); }
    };

    document.addEventListener('paste', function(e) {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file' && item.type.includes('image')) {
                const blob = item.getAsFile();
                const file = new File([blob], "yapistirilan_resim.png", { type: blob.type });
                if (document.getElementById('perfumeFormModal')) {
                    const input = document.getElementById('perfume-form-image');
                    if(input) { const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files; window.previewPerfumeImage(input); return; }
                }
                if (document.getElementById('productFormModal') && document.getElementById('productFormModal').classList.contains('open')) {
                    const input = document.getElementById('pf-image-file');
                    if(input) { const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files; window.previewProductImage(input); return; }
                }
                if (document.getElementById('bottleFormModal')) {
                    const input = document.getElementById('bottle-form-image');
                    if(input) { const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files; window.previewBottleImage(input); return; }
                }
                if (document.getElementById('adminModal') && document.getElementById('adminModal').classList.contains('open')) {
                    const settingsLogoInput = document.getElementById('setting-logo-file');
                    if(settingsLogoInput) { const dt = new DataTransfer(); dt.items.add(file); settingsLogoInput.files = dt.files; window.previewSettingLogo(settingsLogoInput); return; }
                }
            }
        }
    });

    function initSupabase() {
        if (typeof supabase !== 'undefined' && supabase.createClient) {
            _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            
            // OTURUM DURUMUNU DİNLE (Admin panelinden atmasını engeller)
            _supabase.auth.onAuthStateChange((event, session) => {
                if (session) {
                    isAdmin = true;
                    sessionToken = session.access_token;
                    const adminBar = document.getElementById('adminBar');
                    if (adminBar) adminBar.style.display = 'flex';
                } else {
                    isAdmin = false;
                    sessionToken = null;
                    const adminBar = document.getElementById('adminBar');
                    if (adminBar) adminBar.style.display = 'none';
                }
                if (typeof window.applyLocalFilter === 'function') window.applyLocalFilter();
            });
        }
    }

    window.loadSiteSettings = async function() {
        if (!_supabase) return;
        try {
            const { data } = await _supabase.from('site_settings').select('*').eq('id', 1).maybeSingle();
            if (data) {
                siteSettings.logo_url = data.logo_url || ''; siteSettings.hero_title = data.hero_title || 'متجر ميار للتسوق'; siteSettings.hero_subtitle = data.hero_subtitle || 'جمالك يبدأ من هنا';
                siteSettings.free_shipping_text = data.free_shipping_text || 'احصل على شحن مجاني عند طلبك بقيمة 800 وأكثر'; siteSettings.free_shipping_min = parseFloat(data.free_shipping_min) || 800;
                siteSettings.whatsapp_number = data.whatsapp_number || '905388444275'; siteSettings.slider_images = Array.isArray(data.slider_images) ? data.slider_images : [];
                siteSettings.custom_categories_order = Array.isArray(data.custom_categories_order) ? data.custom_categories_order : []; siteSettings.pricing_lists = Array.isArray(data.pricing_lists) ? data.pricing_lists : [];
                localStorage.setItem('cached_settings', JSON.stringify(siteSettings));
            }
            window.applySiteSettingsToUI();
        } catch(e) { console.warn(e); }
    };

    window.loadAllData = async function() {
        if (_supabase) {
            try {
                const [pProducts, pGroups, pItems, pIntensities, pBottles, pPrices] = await Promise.all([
                    _supabase.from('whatsapp_products').select('*'), _supabase.from('categories').select('*').eq('type', 'gender').eq('active', true).order('sort_order'),
                    _supabase.from('perfumes').select('*'), _supabase.from('perfume_intensities').select('*').eq('active', true).order('sort_order'),
                    _supabase.from('perfume_bottles').select('*').eq('active', true).order('sort_order'), _supabase.from('perfume_prices').select('*')
                ]);
                currentProducts = pProducts.data || []; perfumeGroups = pGroups.data || []; currentPerfumes = pItems.data || [];
                intensities = pIntensities.data || []; bottles = pBottles.data || []; prices = pPrices.data || [];
                localStorage.setItem('cached_products', JSON.stringify(currentProducts));
            } catch(e) { console.warn(e); }
        }
    };

    window.uploadToB2 = async function(file) {
        const base64 = await new Promise((resolve) => {
            const reader = new FileReader(); reader.onload = e => resolve(e.target.result); reader.readAsDataURL(file);
        });
        const res = await fetch(B2_UPLOAD_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base64: base64, contentType: file.type })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Yükleme hatası (B2)');
        if (data.key) return data.key.startsWith('http') ? data.key : '/api/b2-image?key=' + encodeURIComponent(data.key);
        return '';
    };

    window.imageUrl = function(url) {
        if (!url || url.trim() === '') {
            return 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22200%22><rect width=%22300%22 height=%22200%22 fill=%22%23f8fafc%22/><text x=%2250%25%22 y=%2250%25%22 fill=%22%23D4AF37%22 font-family=%22sans-serif%22 font-size=%2216%22 font-weight=%22bold%22 text-anchor=%22middle%22 dy=%22.3em%22>لا صورة</text></svg>';
        }
        if (url.includes('/api/b2-image')) {
            const key = url.split('key=')[1];
            if (key) {
                return B2_IMAGE_PROXY_URL + '?key=' + key;
            }
        }
        if (url.startsWith('http')) return url; 
        return url;
    };

    window.applySiteSettingsToUI = function() {
        if (siteSettings.logo_url) {
            const logoEl = document.getElementById('heroLogo'); logoEl.src = window.imageUrl(siteSettings.logo_url); logoEl.style.display = 'block';
            logoEl.onerror = function() { this.style.display = 'none'; };
        }
        document.getElementById('heroTitle').innerText = siteSettings.hero_title;
        document.getElementById('heroSubtitle').innerText = siteSettings.hero_subtitle;
        document.getElementById('shipping-text').innerText = siteSettings.free_shipping_text;
        window.renderSlider();
    };

    function getUniqueCosmeticCats() {
        const cats = new Set();
        currentProducts.forEach(p => { if (p.category) p.category.split(/[,;\/|]+/).forEach(c => { const trimmed = c.trim(); if (trimmed) cats.add(trimmed); }); });
        return Array.from(cats);
    }

    function getAllCategoriesUnified() {
        let unified = [];
        perfumeGroups.forEach(g => unified.push({ id: 'group_' + g.id, label: g.label, type: 'perfume_group', originalId: g.id }));
        getUniqueCosmeticCats().forEach(cat => unified.push({ id: 'cat_' + cat, label: cat, type: 'cosmetic', originalId: cat }));
        return unified;
    }

    window.renderCategories = function() {
        const bar = document.getElementById('categoriesBar'); bar.innerHTML = '';
        let unifiedCats = getAllCategoriesUnified();
        const customOrder = siteSettings.custom_categories_order || [];
        unifiedCats.sort((a, b) => { let idxA = customOrder.indexOf(a.id); let idxB = customOrder.indexOf(b.id); if (idxA === -1) idxA = 99999; if (idxB === -1) idxB = 99999; return idxA - idxB; });
        unifiedCats.forEach(item => {
            const btn = document.createElement('button');
            const isSelected = (item.type === 'perfume_group' && selectedCategory === 'perfume_group_' + item.originalId) || (item.type === 'cosmetic' && selectedCategory === item.originalId);
            btn.className = 'cat-btn' + (isSelected ? ' active' : '');
            btn.innerHTML = item.type === 'perfume_group' ? `<svg class="icon" viewBox="0 0 24 24" style="color:#e91e63;"><path d="M12 2a3 3 0 0 0-3 3c0 1.3.8 2.4 2 2.8V10h2V7.8c1.2-.4 2-1.5 2-2.8a3 3 0 0 0-3-3z"/><path d="M12 22a3 3 0 0 0 3-3c0-1.3-.8-2.4-2-2.8V14h-2v2.2c-1.2.4-2 1.5-2 2.8a3 3 0 0 0 3 3z"/><path d="M5.5 5.5a3 3 0 0 0-3 3c0 1.3.8 2.4 2 2.8V13h2v-1.7c1.2-.4 2-1.5 2-2.8a3 3 0 0 0-3-3z"/><path d="M18.5 18.5a3 3 0 0 0 3-3c0-1.3-.8-2.4-2-2.8V11h-2v1.7c-1.2.4-2 1.5-2 2.8a3 3 0 0 0 3 3z"/><circle cx="12" cy="12" r="2.5"/></svg> ${item.label}` : item.label;
            btn.onclick = () => { selectedCategory = item.type === 'perfume_group' ? 'perfume_group_' + item.originalId : item.originalId; window.renderCategories(); window.applyLocalFilter(); };
            bar.appendChild(btn);
        });
        const allBtn = document.createElement('button'); allBtn.className = 'cat-btn' + (selectedCategory === 'ALL' ? ' active' : ''); allBtn.innerHTML = 'الكل';
        allBtn.onclick = () => { selectedCategory = 'ALL'; window.renderCategories(); window.applyLocalFilter(); };
        bar.appendChild(allBtn);
    };

    window.applyLocalFilter = function() {
        const grid = document.getElementById('productsGrid'); const list = document.getElementById('perfumesList');
        let filteredCosmetics = []; let filteredPerfumes = []; let showPerfumeHeader = false;
        const activeCosmetics = currentProducts.filter(p => p.active !== false); const activePerfumes = currentPerfumes.filter(p => p.active !== false);

        if (searchQuery) {
            const q = normalizeArabic(searchQuery);
            filteredCosmetics = activeCosmetics.filter(p => normalizeArabic(p.name_ar || p.name || '').includes(q));
            filteredPerfumes = activePerfumes.filter(p => normalizeArabic(p.name || '').includes(q));
            showPerfumeHeader = true;
            const bothEmpty = filteredCosmetics.length === 0 && filteredPerfumes.length === 0;
            grid.style.display = (filteredCosmetics.length > 0 || bothEmpty) ? 'grid' : 'none';
            list.style.display = filteredPerfumes.length > 0 ? 'flex' : 'none';
            list.style.flexDirection = 'column'; list.style.gap = '12px'; list.style.marginTop = filteredCosmetics.length > 0 ? '30px' : '0';
        } else {
            if (typeof selectedCategory === 'string' && selectedCategory.startsWith('perfume_group_')) {
                grid.style.display = 'none'; list.style.display = 'flex'; list.style.flexDirection = 'column'; list.style.gap = '12px'; list.style.marginTop = '0';
                const groupId = parseInt(selectedCategory.replace('perfume_group_', ''));
                filteredPerfumes = activePerfumes.filter(p => p.gender_id === groupId).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
                list.innerHTML = filteredPerfumes.map(p => `
                    <div class="perfume-row" style="display:flex; justify-content:space-between; align-items:center;">
                        <div class="info" onclick="window.openPerfumeDetail('${p.id}')" style="flex:1; cursor:pointer;"><div class="name">${p.name}</div></div>
                        <div style="display:flex; gap:6px; align-items:center;">
                            <button onclick="window.copyProductLink('${p.id}')" style="background:#f39c12; color:#fff; padding:8px; border-radius:8px; min-height:38px; min-width:38px;"><svg class="icon" viewBox="0 0 24 24" style="margin:0;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>
                            <button onclick="window.sendProductMessage('${p.id}')" style="background:#25d366; color:#fff; padding:8px; border-radius:8px; min-height:38px; min-width:38px;"><svg class="icon" viewBox="0 0 24 24" style="margin:0;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></button>
                            <button onclick="window.openPerfumeDetail('${p.id}')" style="background:var(--navy); color:var(--gold); padding:8px 16px; border-radius:8px; font-weight:800; min-height:38px;">عرض</button>
                        </div>
                    </div>
                `).join(''); return;
            }
            grid.style.display = 'grid'; list.style.display = 'none';
            filteredCosmetics = activeCosmetics;
            if (selectedCategory !== 'ALL') filteredCosmetics = filteredCosmetics.filter(p => p.category && p.category.split(/[,;\/|]+/).map(c => c.trim()).includes(selectedCategory));
            if (selectedCategory === 'ALL') { filteredPerfumes = activePerfumes; if (filteredPerfumes.length > 0) { list.style.display = 'flex'; list.style.flexDirection = 'column'; list.style.gap = '12px'; list.style.marginTop = '30px'; showPerfumeHeader = true; } }
        }

        if (filteredCosmetics.length === 0 && filteredPerfumes.length === 0) {
            grid.style.display = 'grid';
            grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><p style="font-size: 1.15rem; font-weight: 800; color: var(--navy); margin-bottom: 4px;">لا توجد نتائج</p><p style="font-size: 0.9rem;">جرب البحث بكلمة أخرى أو تصفح قسماً مختلفاً</p></div>`;
        } else {
            filteredCosmetics.sort((a, b) => (a.name_ar || a.name || '').localeCompare(b.name_ar || b.name || '', 'ar'));
            grid.innerHTML = filteredCosmetics.map(p => {
                const imgSrc = window.imageUrl(p.img); const productName = p.name_ar || p.name || 'بدون اسم';
                let actionsHtml = '';
                if (isAdmin) {
                    actionsHtml = `<div class="admin-actions" style="margin-top:10px; display:flex; gap:6px; flex-wrap:wrap;">
                        <button onclick="window.copyProductLink('${p.id}')" style="background:#f39c12; color:#fff; flex:1; padding:8px; border-radius:8px; min-height:38px;"><svg class="icon" viewBox="0 0 24 24" style="margin:0;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>
                        <button onclick="window.sendProductMessage('${p.id}')" style="background:#25d366; color:#fff; flex:1; padding:8px; border-radius:8px; min-height:38px;"><svg class="icon" viewBox="0 0 24 24" style="margin:0;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></button>
                        <button onclick="window.toggleProductActive('${p.id}', event)" style="background:${p.active !== false ? '#f39c12' : '#27ae60'}; color:#fff; flex:1; padding:8px; border-radius:8px; min-height:38px;"><svg class="icon" viewBox="0 0 24 24"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg></button>
                        <button onclick="window.openProductForm('${p.id}')" style="background:#f1c40f; color:#fff; flex:1; padding:8px; border-radius:8px; min-height:38px;"><svg class="icon" viewBox="0 0 24 24"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
                        <button onclick="window.deleteProduct('${p.id}')" style="background:#e74c3c; color:#fff; flex:1; padding:8px; border-radius:8px; min-height:38px;"><svg class="icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                        <button onclick="window.addToCart('${p.id}')" style="background:#25d366; color:#fff; flex:2; font-weight:800; display:flex; align-items:center; justify-content:center; gap:6px; border-radius:8px; min-height:38px; min-width:100%;"><svg class="icon" viewBox="0 0 24 24" style="margin:0;"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg> إضافة</button></div>`;
                } else {
                    actionsHtml = `<div class="admin-actions" style="margin-top:10px; display:flex; gap:6px;">
                        <button onclick="window.copyProductLink('${p.id}')" style="background:#f39c12; color:#fff; flex:0 0 42px; padding:8px; border-radius:8px; min-height:38px;"><svg class="icon" viewBox="0 0 24 24" style="margin:0;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>
                        <button onclick="window.sendProductMessage('${p.id}')" style="background:#25d366; color:#fff; flex:0 0 42px; padding:8px; border-radius:8px; min-height:38px;"><svg class="icon" viewBox="0 0 24 24" style="margin:0;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></button>
                        <button onclick="window.addToCart('${p.id}')" style="background:#25d366; color:#fff; flex:1; font-weight:800; display:flex; align-items:center; justify-content:center; gap:6px; border-radius:8px; min-height:38px;"><svg class="icon" viewBox="0 0 24 24" style="margin:0;"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg> إضافة</button></div>`;
                }
                const hasDiscount = p.original_price && p.original_price > p.price;
                const discountPercent = hasDiscount ? Math.round(((p.original_price - p.price) / p.original_price) * 100) : 0;
                return `<div class="product-card">${hasDiscount ? `<div class="discount-badge">-%${discountPercent}</div>` : ''}<img src="${imgSrc}" onclick="window.openProductDetail('${p.id}')" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22200%22><rect width=%22300%22 height=%22200%22 fill=%22%23f8fafc%22/><text x=%2250%25%22 y=%2250%25%22 fill=%22%23D4AF37%22 font-family=%22sans-serif%22 font-size=%2216%22 font-weight=%22bold%22 text-anchor=%22middle%22 dy=%22.3em%22>لا صورة</text></svg>'"><div class="product-info"><div><div class="product-title" onclick="window.openProductDetail('${p.id}')">${productName}</div><div class="product-price-row"><span class="product-price">${p.price} ₺</span>${hasDiscount ? `<span class="product-price-old">${p.original_price} ₺</span>` : ''}</div></div>${actionsHtml}</div></div>`}).join('');
        }

        if (filteredPerfumes.length > 0 && (searchQuery || !selectedCategory.startsWith('perfume_group_'))) {
            list.style.display = 'flex'; filteredPerfumes.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
            let headerHtml = showPerfumeHeader ? `<h3 style="text-align:center; color:var(--navy); margin-bottom: 10px; font-weight: 900; font-size: 1.5rem;">قسم العطور</h3>` : '';
            list.innerHTML = headerHtml + filteredPerfumes.map(p => {
                let adminActions = '';
                if (isAdmin) {
                    adminActions = `<button onclick="window.togglePerfumeActive('${p.id}')" style="background:${p.active !== false ? '#f39c12' : '#27ae60'}; color:#fff; padding:8px; border-radius:8px; min-height:38px; min-width:38px;"><svg class="icon" viewBox="0 0 24 24" style="margin:0;"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg></button>
                    <button onclick="window.openPerfumeForm('${p.id}')" style="background:#f1c40f; color:#fff; padding:8px; border-radius:8px; min-height:38px; min-width:38px;"><svg class="icon" viewBox="0 0 24 24" style="margin:0;"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
                    <button onclick="window.deletePerfume('${p.id}')" style="background:#e74c3c; color:#fff; padding:8px; border-radius:8px; min-height:38px; min-width:38px;"><svg class="icon" viewBox="0 0 24 24" style="margin:0;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>`;
                }
                return `<div class="perfume-row" style="display:flex; justify-content:space-between; align-items:center;"><div class="info" onclick="window.openPerfumeDetail('${p.id}')" style="flex:1; cursor:pointer;"><div class="name">${p.name}</div></div><div style="display:flex; gap:6px; align-items:center;"><button onclick="window.copyProductLink('${p.id}')" style="background:#f39c12; color:#fff; padding:8px; border-radius:8px; min-height:38px; min-width:38px;"><svg class="icon" viewBox="0 0 24 24" style="margin:0;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button><button onclick="window.sendProductMessage('${p.id}')" style="background:#25d366; color:#fff; padding:8px; border-radius:8px; min-height:38px; min-width:38px;"><svg class="icon" viewBox="0 0 24 24" style="margin:0;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></button>${adminActions}<button onclick="window.openPerfumeDetail('${p.id}')" style="background:var(--navy); color:var(--gold); padding:8px 16px; border-radius:8px; font-weight:800; min-height:38px;">عرض</button></div></div>`}).join('');
        } else { if (searchQuery || !selectedCategory.startsWith('perfume_group_')) list.style.display = 'none'; }
    };

    window.copyProductLink = function(id) { let url = window.location.origin + '/?product=' + id; navigator.clipboard.writeText(url).then(() => { window.showToast('✓ تم نسخ رابط المنتج'); }).catch(err => { alert('فشل نسخ الرابط: ' + err); }); };
    window.sendProductMessage = function(id) { let item = currentProducts.find(x => String(x.id) === String(id)) || currentPerfumes.find(x => String(x.id) === String(id)); if (!item) return; let name = item.name_ar || item.name; let url = window.location.origin + '/?product=' + id; let msg = `مرحباً، أريد الاستفسار عن هذا المنتج:\n*${name}*\nالرابط: ${url}`; window.open('https://wa.me/' + siteSettings.whatsapp_number.replace(/[^0-9]/g, '') + '?text=' + encodeURIComponent(msg), '_blank'); };

    window.togglePerfumeActive = async function(id) { if (!confirm('تغيير حالة ظهور العطر؟')) return; const perfume = currentPerfumes.find(p => String(p.id) === String(id)); if (!perfume) return; const newState = perfume.active !== false ? false : true; try { const { error } = await _supabase.from('perfumes').update({ active: newState }).eq('id', id); if (error) throw error; perfume.active = newState; window.applyLocalFilter(); if (document.getElementById('adminModal').classList.contains('open')) window.switchAdminTab('perfumes'); window.showToast('تم تحديث حالة العطر'); } catch (err) { alert('Hata: ' + err.message); } };

    window.openPerfumeDetail = function(perfumeId) {
        const p = currentPerfumes.find(x => String(x.id) === String(perfumeId)); if (!p) return;
        currentPerfumeSelection = { intensityId: null, bottleId: null, perfumeId: p.id };
        document.getElementById('pd-name').innerText = p.name;
        if (p.image_url) { document.getElementById('pd-image-container').style.display = 'block'; document.getElementById('pd-image').src = window.imageUrl(p.image_url); } else document.getElementById('pd-image-container').style.display = 'none';
        
        const activeIntensities = intensities.filter(i => i.active !== false);
        document.getElementById('pd-intensity-options').innerHTML = activeIntensities.map((i, index) => {
            const isSelected = index === 0 ? 'active' : '';
            if (index === 0) currentPerfumeSelection.intensityId = i.id;
            return `<div class="option-btn ${isSelected}" onclick="window.selectIntensity(${i.id})" id="int-btn-${i.id}">${i.name}</div>`;
        }).join('');

        const activeBottles = bottles.filter(b => b.size_id === 2 && b.active !== false);
        const lastBottleIndex = activeBottles.length - 1; 
        document.getElementById('pd-bottle-options').innerHTML = activeBottles.map((b, index) => {
            const isSelected = index === lastBottleIndex ? 'active' : '';
            if (index === lastBottleIndex) currentPerfumeSelection.bottleId = b.id; 
            return `<div class="option-btn ${isSelected}" onclick="window.selectBottle(${b.id})" id="bot-btn-${b.id}">${b.image_url ? `<img src="${window.imageUrl(b.image_url)}" onerror="this.style.display='none'">` : ''}<div>${b.name}</div><div style="font-size:0.7rem; color:#666;">${b.price_diff > 0 ? '+' + b.price_diff + ' ₺' : 'مجاناً'}</div></div>`;
        }).join('');
        
        window.updatePerfumeTotal(); 
        window.openModal('perfumeDetailModal');
    };

    window.selectIntensity = function(id) { currentPerfumeSelection.intensityId = id; document.querySelectorAll('#pd-intensity-options .option-btn').forEach(el => el.classList.remove('active')); document.getElementById(`int-btn-${id}`).classList.add('active'); window.updatePerfumeTotal(); };
    window.selectBottle = function(id) { currentPerfumeSelection.bottleId = id; document.querySelectorAll('#pd-bottle-options .option-btn').forEach(el => el.classList.remove('active')); document.getElementById(`bot-btn-${id}`).classList.add('active'); window.updatePerfumeTotal(); };
    window.updatePerfumeTotal = function() { 
        const btn = document.getElementById('pd-btn-add'); const totalEl = document.getElementById('pd-total'); 
        if (!currentPerfumeSelection.intensityId || !currentPerfumeSelection.bottleId) { totalEl.innerText = '0 ₺'; btn.disabled = true; return; } 
        const basePriceRow = prices.find(p => p.perfume_id === currentPerfumeSelection.perfumeId && p.intensity_id === currentPerfumeSelection.intensityId && p.size_id === 2); 
        const basePrice = basePriceRow ? basePriceRow.price : 0; 
        const bottle = bottles.find(b => b.id === currentPerfumeSelection.bottleId); 
        totalEl.innerText = (basePrice + (bottle ? bottle.price_diff : 0)) + ' ₺'; 
        btn.disabled = false; 
    };
    window.addPerfumeToCart = function() { const p = currentPerfumes.find(x => x.id === currentPerfumeSelection.perfumeId); const intLabel = intensities.find(i => i.id === currentPerfumeSelection.intensityId).name; const bottle = bottles.find(b => b.id === currentPerfumeSelection.bottleId); const group = perfumeGroups.find(g => g.id === p.gender_id); const totalTxt = document.getElementById('pd-total').innerText; cart.push({ type: 'perfume', id: p.id, name: p.name, details: `${intLabel} - ${bottle.name} - ${group ? group.label : ''}`, price: parseFloat(totalTxt.replace(' ₺', '')), qty: 1 }); window.saveCart(); window.updateCartUI(); window.showToast('تمت إضافة العطر للسلة'); window.triggerCartBadgePop(); window.closeModalAndPopHistory('perfumeDetailModal'); };
    window.openProductDetail = function(id) { const p = currentProducts.find(x => String(x.id) === String(id)); if (!p) return; document.getElementById('detail-img').src = window.imageUrl(p.img); document.getElementById('detail-img').onerror = function() { this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22200%22><rect width=%22300%22 height=%22200%22 fill=%22%23f8fafc%22/></svg>'; }; document.getElementById('detail-title').innerText = p.name_ar || p.name || 'بدون اسم'; const hasDiscount = p.original_price && p.original_price > p.price; const priceRow = document.getElementById('detail-price-row'); if (hasDiscount) priceRow.innerHTML = `<span style="color:var(--danger); font-size:1.4rem;">${p.price} ₺</span> <span style="font-size:1rem; color:#888; text-decoration:line-through; margin-inline-start:10px;">${p.original_price} ₺</span>`; else priceRow.innerHTML = `${p.price} ₺`; const descEl = document.getElementById('detail-desc'); if (p.description && p.description.trim() !== '') { descEl.innerText = p.description; descEl.style.display = 'block'; } else { descEl.style.display = 'none'; } document.getElementById('detail-add-btn').onclick = () => { window.addToCart(p.id); window.closeModalAndPopHistory('productDetailModal'); }; window.openModal('productDetailModal'); };
    window.addToCart = function(id) { const p = currentProducts.find(x => String(x.id) === String(id)); if (!p) return; const existing = cart.find(c => c.type === 'kozmetik' && c.id === p.id); if (existing) existing.qty++; else cart.push({ type: 'kozmetik', id: p.id, name: p.name_ar || p.name || 'منتج', price: p.price, qty: 1 }); window.saveCart(); window.updateCartUI(); window.showToast('تمت الإضافة للسلة'); window.triggerCartBadgePop(); };
    window.triggerCartBadgePop = function() { const btn = document.getElementById('cartBtn'); if (btn) { btn.classList.remove('badge-pop'); void btn.offsetWidth; btn.classList.add('badge-pop'); } };
    window.saveCart = function() { localStorage.setItem('catalog_cart', JSON.stringify(cart)); };
    window.updateCartUI = function() {
        let totalQty = 0; let totalPrice = 0; cart.forEach(c => { totalQty += c.qty; totalPrice += c.price * c.qty; });
        document.getElementById('cart-count').innerText = totalQty; document.getElementById('cart-total-price').innerText = totalPrice;
        const clearBtn = document.getElementById('clearCartBtn'); if (clearBtn) clearBtn.style.display = cart.length === 0 ? 'none' : 'inline-flex';
        const cartList = document.getElementById('cartList');
        if (cart.length === 0) { cartList.innerHTML = `<div class="empty-state" style="padding: 40px 20px;"><svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg><p style="font-size: 1.1rem; font-weight: 800; color: var(--navy); margin-bottom: 6px;">سلتك فارغة</p><p style="font-size: 0.9rem;">تصفح منتجاتنا وأضف ما يعجبك</p></div>`; }
        else { let itemsHtml = cart.map((c, idx) => { const itemTotal = c.price * c.qty; return `<div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #eee;"><div style="flex-grow:1;"><strong style="color:var(--navy); font-size:0.95rem;">${c.name}</strong>${c.details ? `<br><small style="color:#888;">${c.details}</small>` : ''}<div style="margin-top:5px; font-size:0.9rem; font-weight:700; color:var(--gold-dark);">${c.qty} × ${c.price} = ${itemTotal} ₺</div></div><div style="display:flex; align-items:center; gap:8px; margin-inline-start:10px;"><button onclick="window.changeQty(${idx}, -1)" style="padding:4px 10px; background:#f0f0f0; color:#333; border-radius:6px; font-weight:bold; min-height: unset;">-</button><span style="font-weight:800; color:var(--navy); min-width:20px; text-align:center; font-size:1.1rem;">${c.qty}</span><button onclick="window.changeQty(${idx}, 1)" style="padding:4px 10px; background:#f0f0f0; color:#333; border-radius:6px; font-weight:bold; min-height: unset;">+</button></div></div>`; }).join(''); itemsHtml += `<div style="margin-top: 20px; padding-top: 15px; border-top: 2px dashed #ccc; display:flex; justify-content:space-between; align-items:center;"><span style="font-size:1.1rem; font-weight:800; color:var(--navy);">الإجمالي:</span><span style="font-size:1.4rem; font-weight:900; color:var(--gold-dark);">${totalPrice} ₺</span></div>`; cartList.innerHTML = itemsHtml; }
    };
    window.changeQty = function(idx, delta) { cart[idx].qty += delta; if (cart[idx].qty <= 0) cart.splice(idx, 1); window.saveCart(); window.updateCartUI(); };
    window.clearCart = function() { cart = []; window.saveCart(); window.updateCartUI(); };
    window.completeOrder = function() { if (cart.length === 0) { window.showToast('سلتك فارغة، أضف منتجات أولاً'); return; } let msg = 'طلب جديد:\n\n'; let total = 0; cart.forEach(c => { msg += `• ${c.name}${c.details ? ` (${c.details})` : ''}\n  ${c.price} ₺ × ${c.qty} = ${c.price * c.qty} ₺\n`; total += c.price * c.qty; }); msg += `\nالإجمالي: ${total} ₺`; window.open('https://wa.me/' + siteSettings.whatsapp_number.replace(/[^0-9]/g, '') + '?text=' + encodeURIComponent(msg), '_blank'); };

    document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.shiftKey && e.key === 'A') { e.preventDefault(); if (isAdmin) window.openAdmin(); else window.openModal('loginModal'); } });

    window.doLogin = async function() {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        if (!email || !password) return alert('البريد وكلمة المرور مطلوبان');
        const btn = document.getElementById('login-btn');
        const oldText = btn.innerText;
        btn.innerText = 'Giriş Yapılıyor...';
        btn.disabled = true;
        const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) { alert('خطأ: ' + error.message); btn.innerText = oldText; btn.disabled = false; return; }
        sessionToken = data.session?.access_token || null;
        isAdmin = true;
        window.closeModalAndPopHistory('loginModal');
        document.getElementById('adminBar').style.display = 'flex';
        window.showToast('تم تسجيل الدخول بنجاح');
        window.openAdmin();
        btn.innerText = oldText;
        btn.disabled = false;
    };

    window.handleSupabaseLogout = async function() { await _supabase.auth.signOut(); isAdmin = false; sessionToken = null; document.getElementById('adminBar').style.display = 'none'; location.reload(); };
    window.openAdmin = function() { document.getElementById('adminBar').style.display = 'flex'; window.openModal('adminModal'); window.switchAdminTab('products'); };

    window.renderSlider = function() {
        const container = document.getElementById('sliderContainer'); const track = document.getElementById('sliderTrack'); const dots = document.getElementById('sliderDots');
        const images = siteSettings.slider_images || [];
        if (!images || images.length === 0) { container.style.display = 'none'; return; }
        container.style.display = 'block'; track.innerHTML = ''; dots.innerHTML = '';
        images.forEach((url, i) => {
            const slide = document.createElement('div'); slide.className = 'slider-slide';
            slide.innerHTML = '<img src="' + window.imageUrl(url) + '" alt="Banner ' + (i+1) + '" loading="lazy" onerror="this.parentElement.style.display=\'none\'; document.getElementById(\'sliderContainer\').style.display=\'none\';">';
            track.appendChild(slide);
            const dot = document.createElement('div'); dot.className = 'slider-dot' + (i === 0 ? ' active' : ''); dot.onclick = () => window.goToSlide(i); dots.appendChild(dot);
        });
        currentSlide = 0; window.updateSlider(); window.startSliderAutoplay();
    };

    window.updateSlider = function() { const track = document.getElementById('sliderTrack'); if (!track) return; track.style.transform = 'translateX(' + (currentSlide * 100) + '%)'; document.querySelectorAll('.slider-dot').forEach((d, i) => { d.classList.toggle('active', i === currentSlide); }); };
    window.goToSlide = function(idx) { const images = siteSettings.slider_images || []; if (images.length === 0) return; currentSlide = idx % images.length; if (currentSlide < 0) currentSlide = images.length - 1; window.updateSlider(); };
    window.sliderNext = function() { window.goToSlide(currentSlide + 1); window.startSliderAutoplay(); };
    window.sliderPrev = function() { window.goToSlide(currentSlide - 1); window.startSliderAutoplay(); };
    window.startSliderAutoplay = function() { if (sliderAutoplayTimer) clearInterval(sliderAutoplayTimer); const images = siteSettings.slider_images || []; if (images.length < 2) return; sliderAutoplayTimer = setInterval(() => { currentSlide = (currentSlide + 1) % images.length; window.updateSlider(); }, 5000); };

    window.setDefaultCategory = function() { if (selectedCategory !== 'ALL' || searchQuery) return; let unifiedCats = getAllCategoriesUnified(); const customOrder = siteSettings.custom_categories_order || []; unifiedCats.sort((a, b) => { let idxA = customOrder.indexOf(a.id); let idxB = customOrder.indexOf(b.id); if (idxA === -1) idxA = 99999; if (idxB === -1) idxB = 99999; return idxA - idxB; }); if (unifiedCats.length > 0) { const firstCat = unifiedCats[0]; selectedCategory = firstCat.type === 'perfume_group' ? 'perfume_group_' + firstCat.originalId : firstCat.originalId; } };
    window.showLoadingScreen = function() { document.getElementById('loadingScreen').style.display = 'flex'; };
    window.hideLoadingScreen = function() { document.getElementById('loadingScreen').style.opacity = '0'; setTimeout(() => document.getElementById('loadingScreen').style.display = 'none', 400); };
    window.handleSearch = function(val) { if (val.trim() === 'mayar.') { document.getElementById('search-input').value = ''; searchQuery = ''; window.applyLocalFilter(); window.openModal('loginModal'); return; } searchQuery = val.trim(); window.applyLocalFilter(); };
    window.openWhatsAppChat = function() { const num = siteSettings.whatsapp_number.replace(/[^0-9]/g, ''); window.open('https://wa.me/' + num, '_blank'); };

    window.openModal = function(id) { document.getElementById(id).style.display = 'flex'; document.getElementById(id).classList.add('open'); modalHistoryStack.push(id); history.pushState({ modal: id }, ''); };
    window.closeModalAndPopHistory = function(id) { document.getElementById(id).classList.remove('open'); document.getElementById(id).style.display = 'none'; const idx = modalHistoryStack.lastIndexOf(id); if (idx !== -1) modalHistoryStack.splice(idx, 1); if (history.state && history.state.modal === id) history.back(); };
    window.closeModalOnBackdrop = function(event, modalId) { if (event.target.id === modalId) window.closeModalAndPopHistory(modalId); };

    window.addEventListener('popstate', function() { if (modalHistoryStack.length > 0) { const modalId = modalHistoryStack.pop(); document.getElementById(modalId).classList.remove('open'); } else { history.pushState({ root: true }, ''); } });
    history.replaceState({ root: true }, '');

    // --- ADMIN İŞLEMLERİ ---
    window.switchAdminTab = function(tab, btn) {
        document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active')); if (btn) btn.classList.add('active');
        const c = document.getElementById('adminContent');
        
        if (tab === 'products') {
            const activeProducts = [...currentProducts].filter(p => p.active !== false).sort((a, b) => (a.name_ar || '').localeCompare(b.name_ar || '', 'ar'));
            c.innerHTML = `<button class="btn-gold" style="margin-bottom:15px; width:100%; padding:12px;" onclick="window.openProductForm()">+ إضافة منتج جديد (كوزمتيك)</button>${activeProducts.map(p => `<div class="admin-item"><div style="display:flex; align-items:center; gap:10px; flex-grow:1;"><img src="${window.imageUrl(p.img)}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22><rect width=%2250%22 height=%2250%22 fill=%22%23eee%22/></svg>'"><div><strong>${p.name_ar || p.name || 'بدون اسم'}</strong><br><small style="color:var(--gold-dark); font-weight:bold;">${p.price} ₺</small></div></div><div style="display:flex; gap:5px;"><button onclick="window.toggleProductActive('${p.id}', event)" style="background:#f39c12; padding:6px 10px;" title="إخفاء"><svg class="icon" viewBox="0 0 24 24"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg></button><button class="btn-gold" onclick="window.openProductForm('${p.id}')" style="padding:6px 10px;"><svg class="icon" viewBox="0 0 24 24"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg> تعديل</button><button class="btn-danger" onclick="window.deleteProduct('${p.id}')" style="padding:6px 10px;"><svg class="icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> حذف</button></div></div>`).join('')}`;
        } else if (tab === 'hidden_products') {
            const hiddenProducts = [...currentProducts].filter(p => p.active === false).sort((a, b) => (a.name_ar || '').localeCompare(b.name_ar || '', 'ar'));
            c.innerHTML = `
                <h3 style="margin-bottom:10px; color:var(--navy);">المنتجات المخفية (Gizli Ürünler)</h3>
                <p style="color:#888; font-size:0.85rem; margin-bottom:15px;">هذه المنتجات لا تظهر للزبائن. اضغط على "إظهار" لإعادتها إلى المتجر.</p>
                ${hiddenProducts.length === 0 ? '<p style="text-align:center; color:#888; padding:20px;">لا توجد منتجات مخفية حالياً.</p>' : ''}
                ${hiddenProducts.map(p => `
                    <div class="admin-item" style="opacity: 0.8; background: #f0f0f0;">
                        <div style="display:flex; align-items:center; gap:10px; flex-grow:1;">
                            <img src="${window.imageUrl(p.img)}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22><rect width=%2250%22 height=%2250%22 fill=%22%23eee%22/></svg>'">
                            <div><strong>${p.name_ar || p.name || 'بدون اسم'}</strong><br><small style="color:var(--gold-dark); font-weight:bold;">${p.price} ₺</small></div>
                        </div>
                        <div style="display:flex; gap:5px;">
                            <button onclick="window.toggleProductActive('${p.id}', event)" style="background:#27ae60; color:#fff; padding:6px 10px;" title="إظهار المنتج"><svg class="icon" viewBox="0 0 24 24"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg> إظهار</button>
                            <button class="btn-gold" onclick="window.openProductForm('${p.id}')" style="padding:6px 10px;"><svg class="icon" viewBox="0 0 24 24"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg> تعديل</button>
                            <button class="btn-danger" onclick="window.deleteProduct('${p.id}')" style="padding:6px 10px;"><svg class="icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> حذف</button>
                        </div>
                    </div>
                `).join('')}
            `;
        } else if (tab === 'perfumes') {
            const sortedPerfumes = [...currentPerfumes].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
            c.innerHTML = `<button class="btn-info" style="margin-bottom:15px; width:100%; padding:12px; background: #2980b9;" onclick="window.downloadPerfumesAsWord()"><svg class="icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> تحميل قائمة العطور (Excel)</button><button class="btn-gold" style="margin-bottom:15px; width:100%; padding:12px;" onclick="window.openPerfumeForm()">+ إضافة عطر جديد</button>${sortedPerfumes.map(p => `<div class="admin-item" style="${p.active === false ? 'opacity:0.6;' : ''}"><div style="display:flex; align-items:center; gap:10px;"><strong>${p.name} ${p.active === false ? '(مخفي)' : ''}</strong></div><div style="display:flex; gap:5px;"><button onclick="window.togglePerfumeActive('${p.id}')" style="background:${p.active !== false ? '#f39c12' : '#27ae60'}; padding:6px 10px;"><svg class="icon" viewBox="0 0 24 24"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg></button><button class="btn-gold" onclick="window.openPerfumeForm('${p.id}')" style="padding:6px 10px;"><svg class="icon" viewBox="0 0 24 24"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg> تعديل</button><button class="btn-danger" onclick="window.deletePerfume('${p.id}')" style="padding:6px 10px;"><svg class="icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> حذف</button></div></div>`).join('')}`;
        } else if (tab === 'price_tags') {
            window.renderPriceTagsTab();
        } else if (tab === 'groups') {
            let unifiedCats = getAllCategoriesUnified();
            const customOrder = siteSettings.custom_categories_order || [];
            unifiedCats.sort((a, b) => {
                let idxA = customOrder.indexOf(a.id); let idxB = customOrder.indexOf(b.id);
                if (idxA === -1) idxA = 99999; if (idxB === -1) idxB = 99999; return idxA - idxB;
            });
            c.innerHTML = `
                <h3 style="margin-bottom:10px; color:var(--navy);">ترتيب الأقسام (جميع الأقسام)</h3>
                <p style="color:#888; font-size:0.85rem; margin-bottom:15px;">يمكنك خلط وترتيب جميع الأقسام كما تشاء.</p>
                ${unifiedCats.map((item, index) => `
                    <div class="admin-item">
                        <strong>${item.type === 'perfume_group' ? `<svg class="icon" viewBox="0 0 24 24" style="color:#e91e63;"><path d="M12 2a3 3 0 0 0-3 3c0 1.3.8 2.4 2 2.8V10h2V7.8c1.2-.4 2-1.5 2-2.8a3 3 0 0 0-3-3z"/><path d="M12 22a3 3 0 0 0 3-3c0-1.3-.8-2.4-2-2.8V14h-2v2.2c-1.2.4-2 1.5-2 2.8a3 3 0 0 0 3 3z"/><path d="M5.5 5.5a3 3 0 0 0-3 3c0 1.3.8 2.4 2 2.8V13h2v-1.7c1.2-.4 2-1.5 2-2.8a3 3 0 0 0-3-3z"/><path d="M18.5 18.5a3 3 0 0 0 3-3c0-1.3-.8-2.4-2-2.8V11h-2v1.7c-1.2.4-2 1.5-2 2.8a3 3 0 0 0 3 3z"/><circle cx="12" cy="12" r="2.5"/></svg>` : ''} ${item.label}</strong>
                        <div style="display:flex; gap:5px; align-items:center;">
                            ${index > 0 ? `<button class="btn-gold" onclick="window.moveCategory('${item.id}', -1)" style="padding:6px 10px; font-weight:bold;"><svg class="icon" viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg></button>` : ''}
                            ${index < unifiedCats.length - 1 ? `<button class="btn-gold" onclick="window.moveCategory('${item.id}', 1)" style="padding:6px 10px; font-weight:bold;"><svg class="icon" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button>` : ''}
                            <button class="btn-info" onclick="window.editCategoryName('${item.originalId}', '${item.type}')" style="padding:6px 10px;" title="تعديل الاسم"><svg class="icon" viewBox="0 0 24 24"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
                            <button class="btn-danger" onclick="window.deleteCategoryByName('${item.originalId}', '${item.type}')" style="padding:6px 10px;"><svg class="icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                        </div>
                    </div>
                `).join('')}
            `;
        } else if (tab === 'bottles') {
            const sortedBottles = [...bottles].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
            c.innerHTML = `
                <button class="btn-gold" style="margin-bottom:15px; width:100%; padding:12px;" onclick="window.openBottleForm()">+ إضافة زجاجة جديدة</button>
                <p style="color:#888; text-align:center; margin-bottom:15px;">قائمة الزجاجات الحالية</p>
                ${sortedBottles.map(b => `
                    <div class="admin-item">
                        <div style="display:flex; align-items:center; gap:10px;">
                            ${b.image_url ? `<img src="${window.imageUrl(b.image_url)}" style="width:40px; height:40px; object-fit:cover; border-radius:6px;" onerror="this.style.display='none'">` : '<div style="width:40px; height:40px; background:#eee; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:0.7rem; color:#aaa;">لا صورة</div>'}
                            <div><strong>${b.name}</strong> <br><small style="color:var(--gold-dark); font-weight:bold;">(+${b.price_diff} ₺)</small></div>
                        </div>
                        <div style="display:flex; gap:5px;">
                            <button class="btn-gold" onclick="window.openBottleForm('${b.id}')" style="padding:6px 10px;"><svg class="icon" viewBox="0 0 24 24"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg> تعديل</button>
                            <button class="btn-danger" onclick="window.deleteBottle('${b.id}')" style="padding:6px 10px;"><svg class="icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> حذف</button>
                        </div>
                    </div>
                `).join('')}
            `;
        } else if (tab === 'settings') { c.innerHTML = window.renderSettingsTab(); }
        else if (tab === 'analytics') { window.loadAnalyticsTab(); }
    };

    window.loadAnalyticsTab = async function() {
        const c = document.getElementById('adminContent');
        c.innerHTML = '<div style="text-align:center; padding:30px; color:#888;">جاري التحميل...</div>';
        try {
            const { data: analytics, error } = await _supabase.from('site_analytics').select('*').order('created_at', { ascending: false }).limit(5000); 
            if (error) throw error;
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const dayOfWeek = now.getDay(); const diffToMonday = (dayOfWeek === 0 ? 7 : dayOfWeek) - 1;
            const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday).getTime();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            let totalVisits = 0, totalProductViews = 0, productViews = {};
            let dailyDevices = new Set(), weeklyDevices = new Set(), monthlyDevices = new Set(), totalUniqueDevices = new Set();
            let deviceStats = { Mobile: 0, Desktop: 0, Tablet: 0 };

            analytics.forEach(item => {
                if (item.event_type === 'visit') {
                    totalVisits++; const itemTime = new Date(item.created_at).getTime();
                    if (item.device_id) {
                        totalUniqueDevices.add(item.device_id);
                        if (itemTime >= todayStart) dailyDevices.add(item.device_id);
                        if (itemTime >= weekStart) weeklyDevices.add(item.device_id);
                        if (itemTime >= monthStart) monthlyDevices.add(item.device_id);
                    }
                    if (item.device_type && deviceStats[item.device_type] !== undefined) deviceStats[item.device_type]++;
                } else if (item.event_type === 'product_view') {
                    totalProductViews++; productViews[item.product_id] = (productViews[item.product_id] || 0) + 1;
                }
            });

            const topProducts = Object.entries(productViews).sort((a, b) => b[1] - a[1]).slice(0, 5);
            const getProductName = (id) => (currentProducts.find(p => String(p.id) === String(id)) || currentPerfumes.find(x => String(x.id) === String(id)) || {name_ar: 'منتج محذوف', name: 'منتج محذوف'}).name_ar || (currentPerfumes.find(x => String(x.id) === String(id)) || {}).name;

            let html = `
                <button class="btn-danger" style="margin-bottom: 20px; width: 100%; padding: 12px; font-size: 1rem;" onclick="window.resetAnalytics()"><svg class="icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> تصفير جميع الإحصائيات</button>
                <div class="stats-grid">
                    <div class="stat-box"><h3>إجمالي الزيارات</h3><div class="number">${totalVisits}</div></div>
                    <div class="stat-box" style="background: linear-gradient(135deg, var(--gold-dark), var(--gold));"><h3>مشاهدات المنتجات</h3><div class="number">${totalProductViews}</div></div>
                </div>
                <h3 style="color:var(--navy); font-weight:800; margin-bottom:15px; margin-top:30px; display:flex; align-items:center; gap:8px;"><svg class="icon" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> الأجهزة الفريدة</h3>
                <div style="background:#faf8f3; padding:15px; border-radius:10px; margin-bottom:20px; display:grid; grid-template-columns:1fr 1fr; gap:15px; text-align:center;">
                    <div style="background:#fff; padding:10px; border-radius:8px; border:1px solid #ddd;"><span style="font-size:0.8rem; color:#888;">اليوم</span><br><strong style="font-size:1.3rem; color:var(--navy);">${dailyDevices.size}</strong></div>
                    <div style="background:#fff; padding:10px; border-radius:8px; border:1px solid #ddd;"><span style="font-size:0.8rem; color:#888;">هذا الأسبوع</span><br><strong style="font-size:1.3rem; color:var(--navy);">${weeklyDevices.size}</strong></div>
                    <div style="background:#fff; padding:10px; border-radius:8px; border:1px solid #ddd;"><span style="font-size:0.8rem; color:#888;">هذا الشهر</span><br><strong style="font-size:1.3rem; color:var(--navy);">${monthlyDevices.size}</strong></div>
                    <div style="background:#fff; padding:10px; border-radius:8px; border:1px solid #ddd;"><span style="font-size:0.8rem; color:#888;">الإجمالي</span><br><strong style="font-size:1.3rem; color:var(--gold-dark);">${totalUniqueDevices.size}</strong></div>
                </div>
                <h3 style="color:var(--navy); font-weight:800; margin-bottom:15px; margin-top:20px; display:flex; align-items:center; gap:8px;"><svg class="icon" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> الأجهزة المستخدمة</h3>
                <div style="display:flex; justify-content:space-between; background:#faf8f3; padding:15px; border-radius:10px; margin-bottom:20px;">
                    <div style="text-align:center;"><svg class="icon" viewBox="0 0 24 24" style="width:2rem;height:2rem;color:var(--navy);margin-bottom:5px;"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg><br><strong>هاتف</strong><br>${deviceStats.Mobile}</div>
                    <div style="text-align:center;"><svg class="icon" viewBox="0 0 24 24" style="width:2rem;height:2rem;color:var(--navy);margin-bottom:5px;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg><br><strong>كمبيوتر</strong><br>${deviceStats.Desktop}</div>
                    <div style="text-align:center;"><svg class="icon" viewBox="0 0 24 24" style="width:2rem;height:2rem;color:var(--navy);margin-bottom:5px;"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/></svg><br><strong>تابلت</strong><br>${deviceStats.Tablet}</div>
                </div>
                <h3 style="color:var(--navy); font-weight:800; margin-bottom:15px; margin-top:30px; display:flex; align-items:center; gap:8px;"><svg class="icon" viewBox="0 0 24 24" style="color:var(--danger);"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg> الأكثر مشاهدة</h3>
            `;
            if (topProducts.length === 0) html += `<p style="text-align:center; color:#888;">لا توجد بيانات كافية بعد.</p>`;
            else {
                topProducts.forEach(([pid, count], index) => {
                    const name = getProductName(pid);
                    let rankColor = index === 0 ? 'var(--gold)' : index === 1 ? '#bdc3c7' : index === 2 ? '#cd7f32' : '#eee';
                    html += `<div class="admin-item" style="border-right: 5px solid ${rankColor};"><div style="display:flex; align-items:center; gap:10px;"><span style="font-weight:900; color:${rankColor}; font-size:1.2rem;">#${index+1}</span><strong>${name}</strong></div><div style="font-weight:900; color:var(--navy);">${count} <span style="font-size:0.8rem; font-weight:normal;">مشاهدة</span></div></div>`;
                });
            }
            html += `<p style="text-align:center; color:#aaa; font-size:0.8rem; margin-top:20px;">* يتم عرض آخر 5000 إحصائية بناءً عليها.</p>`;
            c.innerHTML = html;
        } catch (err) { c.innerHTML = `<p style="text-align:center; color:red;">خطأ في تحميل الإحصائيات: ${err.message}</p>`; }
    };

    window.resetAnalytics = async function() {
        if (!confirm('هل أنت متأكد من تصفير جميع الإحصائيات؟ لا يمكن التراجع عن هذا الإجراء.')) return;
        try {
            const { error } = await _supabase.rpc('truncate_analytics');
            if (error) {
                const { error: deleteError } = await _supabase.from('site_analytics').delete().neq('event_type', 'xyz');
                if (deleteError) throw deleteError;
            }
            window.showToast('تم تصفير جميع الإحصائيات بنجاح'); window.loadAnalyticsTab(); 
        } catch (err) { alert('Hata: ' + err.message); }
    };

    // --- FİYAT LİSTELERİ (TOPU FİYAT) ---
    window.renderPriceTagsTab = function() {
        const c = document.getElementById('adminContent'); const lists = siteSettings.pricing_lists || [];
        c.innerHTML = `
            <h3 style="margin-bottom:10px; color:var(--navy);">قوائم الأسعار (Toplu Fiyatlandırma)</h3>
            <p style="color:#888; font-size:0.85rem; margin-bottom:15px;">يمكنك إنشاء قوائم لأسعار معينة وتطبيقها على العطور بضغطة زر.</p>
            <button class="btn-gold" style="margin-bottom:15px; width:100%; padding:12px;" onclick="window.openPriceTagForm()">+ إنشاء قائمة أسعار جديدة</button>
            ${lists.length === 0 ? '<p style="text-align:center; color:#888; padding:20px;">لا توجد قوائم أسعار بعد.</p>' : ''}
            ${lists.map(list => `
                <div class="admin-item" style="padding:15px; align-items:flex-start; flex-direction:column; gap:10px;">
                    <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                        <strong style="font-size:1.1rem; color:var(--navy);">${list.name}</strong>
                        <span style="font-size:0.8rem; color:#888;">${(list.perfume_ids || []).length} عطر</span>
                    </div>
                    <div style="display:flex; gap:8px; width:100%; justify-content:flex-end; margin-top:5px;">
                        <button class="btn-success" onclick="window.applyPriceTag('${list.id}')" style="flex:1; font-size:0.9rem;"><svg class="icon" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> تطبيق الأسعار</button>
                        <button class="btn-gold" onclick="window.openPriceTagForm('${list.id}')" style="padding:6px 12px;"><svg class="icon" viewBox="0 0 24 24"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
                        <button class="btn-danger" onclick="window.deletePriceTag('${list.id}')" style="padding:6px 12px;"><svg class="icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                    </div>
                </div>
            `).join('')}
        `;
    };

    window.renderPriceTagBulkPrices = function() {
        const container = document.getElementById('pt-bulk-prices-container');
        if (intensities.length === 0) { container.innerHTML = '<p style="color:#888;">لا توجد تركيزات مضافة.</p>'; return; }
        container.innerHTML = intensities.map(inten => {
            const val = currentPriceTagBulkPrices[inten.id] || '';
            return `<div style="display:flex; flex-direction:column;"><label style="font-size:0.8rem; color:#555; margin-bottom:4px; font-weight:bold;">${inten.name}</label><input type="number" value="${val}" placeholder="₺" onchange="window.updateBulkPrice(${inten.id}, this.value)" style="padding:8px; text-align:center; border:1px solid #ccc; border-radius:6px;"></div>`;
        }).join('');
    };

    window.updateBulkPrice = function(intensityId, value) {
        const price = parseFloat(value);
        if (!isNaN(price) && price > 0) currentPriceTagBulkPrices[intensityId] = price;
        else delete currentPriceTagBulkPrices[intensityId];
    };

    window.openPriceTagForm = function(id = null) {
        document.getElementById('priceTagFormTitle').innerText = id ? 'تعديل قائمة الأسعار' : 'إنشاء قائمة أسعار جديدة';
        document.getElementById('pt-name').value = ''; currentPriceTagPerfumes = []; currentPriceTagBulkPrices = {};
        if (id) {
            const list = siteSettings.pricing_lists.find(l => l.id === id);
            if (list) {
                document.getElementById('pt-name').value = list.name;
                if (list.items && !list.perfume_ids) {
                    currentPriceTagPerfumes = list.items.map(i => i.perfume_id);
                    if (list.items.length > 0 && list.items[0].prices) currentPriceTagBulkPrices = { ...list.items[0].prices };
                } else {
                    currentPriceTagPerfumes = list.perfume_ids || []; currentPriceTagBulkPrices = list.bulk_prices || {};
                }
            }
            document.getElementById('priceTagFormModal').setAttribute('data-edit-id', id);
        } else document.getElementById('priceTagFormModal').removeAttribute('data-edit-id');
        window.renderPriceTagBulkPrices(); window.renderPriceTagItems(); window.openModal('priceTagFormModal');
    };

    window.renderPriceTagItems = function() {
        const listEl = document.getElementById('pt-items-list');
        if (currentPriceTagPerfumes.length === 0) { listEl.innerHTML = '<p style="text-align:center; color:#888; font-size:0.9rem;">لم يتم إضافة أي عطر بعد.</p>'; return; }
        listEl.innerHTML = currentPriceTagPerfumes.map((perfumeId, index) => {
            const perfume = currentPerfumes.find(p => p.id === perfumeId);
            if (!perfume) return '';
            return `<div style="background:#fff; padding:10px; border-radius:8px; border:1px solid #ddd; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;"><strong style="color:var(--navy); font-size:0.95rem;">${perfume.name}</strong><button onclick="window.removePerfumeFromPriceTag(${index})" class="btn-danger" style="padding:4px 10px; min-height:unset; font-size:0.8rem;">✕</button></div>`;
        }).join('');
    };

    window.removePerfumeFromPriceTag = function(index) { currentPriceTagPerfumes.splice(index, 1); window.renderPriceTagItems(); };

    window.openPriceTagSelectModal = function() {
        const selectEl = document.getElementById('pt-gender-select');
        selectEl.innerHTML = perfumeGroups.map(g => `<option value="${g.id}">${g.label}</option>`).join('');
        window.renderPriceTagPerfumeCheckboxes(); window.openModal('priceTagSelectModal');
    };

    window.renderPriceTagPerfumeCheckboxes = function() {
        const genderId = document.getElementById('pt-gender-select').value;
        const container = document.getElementById('pt-perfume-checkboxes');
        if (!genderId) { container.innerHTML = '<p style="text-align:center; color:#888;">يرجى اختيار مجموعة أولاً.</p>'; return; }
        const filteredPerfumes = currentPerfumes.filter(p => p.gender_id == genderId && !currentPriceTagPerfumes.includes(p.id));
        if (filteredPerfumes.length === 0) { container.innerHTML = '<p style="text-align:center; color:#888;">لا توجد عطور متاحة في هذه المجموعة (أو تمت إضافتها بالفعل).</p>'; return; }
        container.innerHTML = filteredPerfumes.map(p => `<label style="display:flex; align-items:center; gap:10px; padding:8px; border-bottom:1px solid #eee; cursor:pointer;"><input type="checkbox" value="${p.id}" class="pt-perfume-checkbox" style="width:18px; height:18px; accent-color:var(--gold);"><span style="font-weight:700; color:var(--navy); font-size:0.95rem;">${p.name}</span></label>`).join('');
    };

    window.confirmAddPerfumesToPriceTag = function() {
        const checkboxes = document.querySelectorAll('.pt-perfume-checkbox:checked');
        if (checkboxes.length === 0) { alert('لم تقم باختيار أي عطر.'); return; }
        checkboxes.forEach(cb => { if (!currentPriceTagPerfumes.includes(cb.value)) currentPriceTagPerfumes.push(cb.value); });
        window.closeModalAndPopHistory('priceTagSelectModal'); window.renderPriceTagItems(); window.showToast('تمت إضافة العطور للقائمة');
    };

    window.savePriceTag = async function() {
        const name = document.getElementById('pt-name').value.trim();
        if (!name) return alert('Lütfen bir liste adı girin.');
        if (currentPriceTagPerfumes.length === 0) return alert('Lütfen en az bir parfüm ekleyin.');
        if (Object.keys(currentPriceTagBulkPrices).length === 0) return alert('Lütfen en az bir toplu fiyat girin.');
        const editId = document.getElementById('priceTagFormModal').getAttribute('data-edit-id');
        let newList = { id: editId || 'list_' + Date.now(), name: name, perfume_ids: [...currentPriceTagPerfumes], bulk_prices: { ...currentPriceTagBulkPrices } };
        const btn = document.getElementById('pt-save-btn'); const oldText = btn.innerText; btn.innerText = 'Kaydediliyor...'; btn.disabled = true;
        try {
            let updatedLists = [...siteSettings.pricing_lists];
            if (editId) { const idx = updatedLists.findIndex(l => l.id === editId); if (idx !== -1) updatedLists[idx] = newList; }
            else updatedLists.push(newList);
            const { error } = await _supabase.from('site_settings').update({ pricing_lists: updatedLists }).eq('id', 1);
            if (error) throw error;
            siteSettings.pricing_lists = updatedLists; window.closeModalAndPopHistory('priceTagFormModal'); window.showToast('Liste kaydedildi.'); window.renderPriceTagsTab();
        } catch (err) { alert('Hata: ' + err.message); } finally { btn.innerText = oldText; btn.disabled = false; }
    };

    window.deletePriceTag = async function(id) {
        if (!confirm('Bu fiyat listesini silmek istediğinize emin misiniz?')) return;
        try {
            const updatedLists = siteSettings.pricing_lists.filter(l => l.id !== id);
            const { error } = await _supabase.from('site_settings').update({ pricing_lists: updatedLists }).eq('id', 1);
            if (error) throw error;
            siteSettings.pricing_lists = updatedLists; window.showToast('Liste silindi.'); window.renderPriceTagsTab();
        } catch (err) { alert('Hata: ' + err.message); }
    };

    window.applyPriceTag = async function(id) {
        const list = siteSettings.pricing_lists.find(l => l.id === id);
        if (!list) return;
        if (!confirm(`"${list.name}" listesindeki fiyatları tüm ürünlere uygulamak istediğinize emin misiniz?`)) return;
        try {
            const perfumeIds = list.perfume_ids || (list.items ? list.items.map(i => i.perfume_id) : []);
            const bulkPrices = list.bulk_prices || (list.items && list.items.length > 0 ? list.items[0].prices : {});
            for (const perfumeId of perfumeIds) {
                for (const intensityId in bulkPrices) {
                    const priceVal = bulkPrices[intensityId];
                    const existing = prices.find(pr => pr.perfume_id === perfumeId && pr.intensity_id == intensityId && pr.size_id === 2);
                    if (existing) await _supabase.from('perfume_prices').update({ price: priceVal }).eq('id', existing.id);
                    else await _supabase.from('perfume_prices').insert([{ perfume_id: perfumeId, intensity_id: intensityId, size_id: 2, price: priceVal }]);
                }
            }
            await window.loadAllData(); window.applyLocalFilter(); window.showToast('Fiyatlar başarıyla uygulandı!');
        } catch (err) { alert('Hata oluştu: ' + err.message); }
    };

    window.moveCategory = async function(id, direction) {
        let currentOrder = siteSettings.custom_categories_order || [];
        const allCats = getAllCategoriesUnified().map(item => item.id);
        if (currentOrder.length === 0) currentOrder = [...allCats];
        allCats.forEach(cId => { if (!currentOrder.includes(cId)) currentOrder.push(cId); });
        const index = currentOrder.indexOf(id);
        if (index === -1) return;
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= currentOrder.length) return;
        [currentOrder[index], currentOrder[targetIndex]] = [currentOrder[targetIndex], currentOrder[index]];
        try {
            const { error } = await _supabase.from('site_settings').update({ custom_categories_order: currentOrder }).eq('id', 1);
            if (error) throw error;
            siteSettings.custom_categories_order = currentOrder; window.switchAdminTab('groups'); window.renderCategories();
        } catch(err) { alert('Hata: ' + err.message); }
    };

    window.editCategoryName = async function(originalId, type) {
        if (type === 'perfume_group') {
            window.openGroupForm(originalId);
        } else {
            const currentName = originalId;
            const newName = prompt('اسم القسم الجديد:', currentName);
            if (!newName || newName.trim() === '' || newName === currentName) return;
            if (!confirm('سيتم تغيير اسم القسم في جميع المنتجات المرتبطة به. متابعة؟')) return;
            try {
                const productsToUpdate = currentProducts.filter(p => p.category && p.category.split(/[,;\/|]+/).map(c=>c.trim()).includes(currentName));
                for (const p of productsToUpdate) {
                    const cats = p.category.split(/[,;\/|]+/).map(c => c.trim());
                    const newCats = cats.map(c => c === currentName ? newName.trim() : c);
                    await _supabase.from('whatsapp_products').update({ category: newCats.join(', ') }).eq('id', p.id);
                }
                let customOrder = siteSettings.custom_categories_order || [];
                const oldId = 'cat_' + currentName;
                const newId = 'cat_' + newName.trim();
                const idx = customOrder.indexOf(oldId);
                if (idx !== -1) {
                    customOrder[idx] = newId;
                    await _supabase.from('site_settings').update({ custom_categories_order: customOrder }).eq('id', 1);
                    siteSettings.custom_categories_order = customOrder;
                }
                if (selectedCategory === currentName) selectedCategory = newName.trim();
                await window.loadAllData(); window.renderCategories(); window.applyLocalFilter(); window.switchAdminTab('groups'); window.showToast('تم تعديل اسم القسم بنجاح');
            } catch (err) { alert('Hata: ' + err.message); }
        }
    };

    window.deleteCategoryByName = async function(originalId, type) {
        if (!confirm('تأكيد حذف هذا القسم/المجموعة؟\n\nملاحظة: سيتم إزالة هذا القسم من جميع المنتجات المرتبطة به.')) return;
        try {
            if (type === 'perfume_group') { await window.deleteGroup(originalId); }
            else {
                const catName = originalId;
                const productsToUpdate = currentProducts.filter(p => p.category && p.category.includes(catName));
                for (const p of productsToUpdate) {
                    const newCat = p.category.split(/[,;\/|]+/).map(c=>c.trim()).filter(c => c !== catName).join(', ');
                    await _supabase.from('whatsapp_products').update({ category: newCat }).eq('id', p.id);
                }
                let customOrder = siteSettings.custom_categories_order || [];
                customOrder = customOrder.filter(id => id !== 'cat_' + catName);
                await _supabase.from('site_settings').update({ custom_categories_order: customOrder }).eq('id', 1);
                siteSettings.custom_categories_order = customOrder;
                await window.loadAllData(); window.renderCategories(); window.applyLocalFilter(); window.switchAdminTab('groups'); window.showToast('تم حذف القسم بنجاح');
            }
        } catch (err) { alert('Hata: ' + err.message); }
    };

    window.downloadPerfumesAsWord = function() {
        if (currentPerfumes.length === 0) return alert("Listelenecek parfüm bulunamadı.");
        let html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="UTF-8">
            <style>
                table { border-collapse: collapse; width: 100%; font-family: 'Tajawal', Arial, sans-serif; }
                th, td { border: 1px solid #aaa; padding: 8px; text-align: right; }
                th { background-color: #D4AF37; color: #1a2942; font-weight: bold; }
            </style>
        </head>
        <body>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>المجموعة (Grup)</th>
                        <th>اسم العطر (Parfüm Adı)</th>
                    </tr>
                </thead>
                <tbody>`;

        const targetGroups = ['عطور رجالية', 'عطور نسائية', 'عطور للجنسين'];
        let counter = 1;

        targetGroups.forEach(groupName => {
            const groupPerfumes = currentPerfumes.filter(p => {
                const group = perfumeGroups.find(g => g.id === p.gender_id);
                return group && group.label === groupName;
            }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));

            groupPerfumes.forEach(p => {
                html += `
                    <tr>
                        <td>${counter++}</td>
                        <td>${groupName}</td>
                        <td>${p.name}</td>
                    </tr>`;
            });
        });

        const otherPerfumes = currentPerfumes.filter(p => {
            const group = perfumeGroups.find(g => g.id === p.gender_id);
            return !group || !targetGroups.includes(group.label);
        }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));

        otherPerfumes.forEach(p => {
            const group = perfumeGroups.find(g => g.id === p.gender_id);
            html += `
                <tr>
                    <td>${counter++}</td>
                    <td>${group ? group.label : 'غير محدد'}</td>
                    <td>${p.name}</td>
                </tr>`;
        });

        html += `</tbody></table></body></html>`;

        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Parfum_Listesi.xls';
        a.click();
        URL.revokeObjectURL(url);
    };

    // --- PARFÜM EKLEME / DÜZENLEME VE FİYAT FONKSİYONLARI ---
    window.previewPerfumeImage = function(input) {
        const preview = document.getElementById('perfume-form-image-preview');
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(input.files[0]);
        }
    };

    window.openPerfumeForm = function(id = null) {
        const modal = document.getElementById('perfumeFormModal');
        const title = document.getElementById('perfume-form-title');
        const idInput = document.getElementById('perfume-form-id');
        const nameInput = document.getElementById('perfume-form-name');
        const genderSelect = document.getElementById('perfume-form-gender');
        const pricesContainer = document.getElementById('perfume-prices-container');
        const imageInput = document.getElementById('perfume-form-image');
        const imagePreview = document.getElementById('perfume-form-image-preview');

        imageInput.value = '';
        imagePreview.src = '';
        imagePreview.style.display = 'none';

        genderSelect.innerHTML = perfumeGroups.map(g => `<option value="${g.id}">${g.label}</option>`).join('');

        if (id) {
            title.innerText = "تعديل العطر";
            const p = currentPerfumes.find(x => String(x.id) === String(id));
            if (p) {
                idInput.value = p.id;
                nameInput.value = p.name || '';
                if (p.gender_id) genderSelect.value = p.gender_id;
                if (p.image_url) {
                    imagePreview.src = window.imageUrl(p.image_url);
                    imagePreview.style.display = 'block';
                }
            }
        } else {
            title.innerText = "إضافة عطر جديد";
            idInput.value = '';
            nameInput.value = '';
        }

        pricesContainer.innerHTML = '';
        
        const activeIntensities = intensities.filter(i => i.active !== false);
        
        if (activeIntensities.length === 0) {
            pricesContainer.innerHTML = '<p style="color:red; font-size:0.9rem; text-align:center;">لم يتم إضافة أي تركيز في النظام بعد. يرجى إضافتها من الإعدادات.</p>';
        } else {
            activeIntensities.forEach(inten => {
                const existingPrice = id ? prices.find(pr => String(pr.perfume_id) === String(id) && pr.intensity_id === inten.id && pr.size_id == 2) : null;
                const priceVal = existingPrice ? existingPrice.price : '';
                
                window.addPriceRow(inten.id, inten.name, priceVal);
            });
        }

        window.openModal('perfumeFormModal');
    };

    window.addPriceRow = function(intensityId, intensityName, price = '') {
        const container = document.getElementById('perfume-prices-container');
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '10px';
        row.style.marginBottom = '10px';
        row.className = 'price-row';
        row.setAttribute('data-intensity-id', intensityId);

        row.innerHTML = `
            <div style="flex:1; padding:10px; background:#fff; border:1px solid #e0dcd0; border-radius:8px; font-weight:bold; color:var(--navy); text-align:center;">${intensityName}</div>
            <input type="number" class="price-value" value="${price}" placeholder="السعر (₺)" style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc; font-family:inherit;">
        `;
        container.appendChild(row);
    };

    window.savePerfume = async function() {
        const id = document.getElementById('perfume-form-id').value;
        const name = document.getElementById('perfume-form-name').value.trim();
        const genderId = document.getElementById('perfume-form-gender').value;
        const imageFile = document.getElementById('perfume-form-image').files[0];
        
        if (!name || !genderId) {
            window.showToast('يرجى ملء اسم العطر والمجموعة');
            return;
        }

        const btn = document.querySelector('#perfumeFormModal .btn-success');
        const oldText = btn.innerText;
        btn.innerText = 'جاري الحفظ...';
        btn.disabled = true;

        try {
            let perfumeId = id;
            let imageUrl = null;

            if (imageFile) {
                imageUrl = await window.uploadToB2(imageFile);
            }

            const perfumeData = { name: name, gender_id: genderId };
            if (imageUrl) perfumeData.image_url = imageUrl;

            if (id) {
                const { error } = await _supabase.from('perfumes').update(perfumeData).eq('id', id);
                if (error) throw error;
            } else {
                const { data, error } = await _supabase.from('perfumes').insert([perfumeData]).select();
                if (error) throw error;
                perfumeId = data[0].id;
            }

            const { error: delError } = await _supabase.from('perfume_prices').delete().eq('perfume_id', perfumeId).eq('size_id', 2);
            if (delError) throw delError;

            const priceRows = document.querySelectorAll('.price-row');
            const newPrices = [];
            
            priceRows.forEach(row => {
                const intId = row.getAttribute('data-intensity-id');
                const priceVal = parseFloat(row.querySelector('.price-value').value);

                if (intId && !isNaN(priceVal) && priceVal > 0) { 
                    newPrices.push({
                        perfume_id: perfumeId,
                        intensity_id: intId,
                        size_id: 2, 
                        price: priceVal
                    });
                }
            });

            if (newPrices.length > 0) {
                const { error: insError } = await _supabase.from('perfume_prices').insert(newPrices);
                if (insError) throw insError;
            }

            await window.loadAllData(); 
            window.closeModalAndPopHistory('perfumeFormModal');
            window.switchAdminTab('perfumes');
            window.showToast('تم حفظ العطر بنجاح');
            
        } catch (err) {
            alert('Hata: ' + err.message);
        } finally {
            btn.innerText = oldText;
            btn.disabled = false;
        }
    };

    window.deletePerfume = async function(id) {
        if (!confirm('هل أنت متأكد من حذف هذا العطر نهائياً؟')) return;
        try {
            await _supabase.from('perfume_prices').delete().eq('perfume_id', id);
            const { error } = await _supabase.from('perfumes').delete().eq('id', id);
            if (error) throw error;
            window.showToast('تم حذف العطر');
            await window.loadAllData();
            window.applyLocalFilter();
            window.switchAdminTab('perfumes');
        } catch (err) {
            alert('Hata: ' + err.message);
        }
    };

    // --- DİĞER EKSİK FONKSİYONLAR (ÜRÜN, ŞİŞE, AYARLAR) ---
    window.previewProductImage = function(input) {
        const preview = document.getElementById('pf-image-preview');
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(input.files[0]);
        }
    };

    window.openProductForm = function(id = null) {
        const modal = document.getElementById('productFormModal');
        const title = document.getElementById('pf-title');
        const idInput = document.getElementById('pf-id');
        const nameInput = document.getElementById('pf-name');
        const priceInput = document.getElementById('pf-price');
        const oldPriceInput = document.getElementById('pf-old-price');
        const catInput = document.getElementById('pf-category');
        const descInput = document.getElementById('pf-description');
        const imgInput = document.getElementById('pf-image-file');
        const imgPreview = document.getElementById('pf-image-preview');
        
        imgInput.value = ''; imgPreview.style.display = 'none'; imgPreview.src = '';

        if (id) {
            title.innerText = "تعديل المنتج";
            const p = currentProducts.find(x => String(x.id) === String(id));
            if (p) {
                idInput.value = p.id;
                nameInput.value = p.name_ar || p.name || '';
                priceInput.value = p.price;
                oldPriceInput.value = p.original_price || '';
                catInput.value = p.category || '';
                descInput.value = p.description || '';
                if (p.img) { imgPreview.src = window.imageUrl(p.img); imgPreview.style.display = 'block'; }
            }
        } else {
            title.innerText = "إضافة منتج جديد";
            idInput.value = ''; nameInput.value = ''; priceInput.value = ''; oldPriceInput.value = ''; catInput.value = ''; descInput.value = '';
        }
        window.openModal('productFormModal');
    };

    window.saveProduct = async function() {
        const id = document.getElementById('pf-id').value;
        const name = document.getElementById('pf-name').value.trim();
        const price = parseFloat(document.getElementById('pf-price').value);
        const oldPrice = parseFloat(document.getElementById('pf-old-price').value) || null;
        const category = document.getElementById('pf-category').value.trim();
        const description = document.getElementById('pf-description').value.trim();
        const imageFile = document.getElementById('pf-image-file').files[0];

        if (!name || isNaN(price)) return alert('الاسم والسعر مطلوبان');

        const btn = document.getElementById('pf-save-btn'); const oldText = btn.innerText; btn.innerText = '...'; btn.disabled = true;

        try {
            let imgUrl = null;
            if (imageFile) imgUrl = await window.uploadToB2(imageFile);

            const dataToSave = { name: name, name_ar: name, price: price, original_price: oldPrice, category: category, description: description };
            if (imgUrl) dataToSave.img = imgUrl;

            if (id) await _supabase.from('whatsapp_products').update(dataToSave).eq('id', id);
            else await _supabase.from('whatsapp_products').insert([dataToSave]);

            await window.loadAllData(); window.applyLocalFilter(); window.closeModalAndPopHistory('productFormModal'); window.showToast('تم الحفظ بنجاح');
            if (document.getElementById('adminModal').classList.contains('open')) window.switchAdminTab('products');
        } catch (err) { alert('Hata: ' + err.message); } finally { btn.innerText = oldText; btn.disabled = false; }
    };

    window.deleteProduct = async function(id) {
        if (!confirm('تأكيد الحذف؟')) return;
        try { await _supabase.from('whatsapp_products').delete().eq('id', id); await window.loadAllData(); window.applyLocalFilter(); window.switchAdminTab('products'); window.showToast('تم الحذف'); } catch (err) { alert('Hata: ' + err.message); }
    };

    window.toggleProductActive = async function(id, event) {
        if(event) event.stopPropagation();
        const p = currentProducts.find(x => String(x.id) === String(id)); if (!p) return;
        const newState = p.active !== false ? false : true;
        try { await _supabase.from('whatsapp_products').update({ active: newState }).eq('id', id); p.active = newState; window.applyLocalFilter(); window.switchAdminTab(newState ? 'products' : 'hidden_products'); } catch (err) { alert('Hata: ' + err.message); }
    };

    window.previewBottleImage = function(input) {
        const preview = document.getElementById('bottle-form-image-preview');
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) { preview.src = e.target.result; preview.style.display = 'block'; };
            reader.readAsDataURL(input.files[0]);
        }
    };

    window.openBottleForm = function(id = null) {
        const modal = document.getElementById('bottleFormModal');
        const title = document.getElementById('bottle-form-title');
        const idInput = document.getElementById('bottle-form-id');
        const nameInput = document.getElementById('bottle-form-name');
        const priceInput = document.getElementById('bottle-form-price');
        const imgInput = document.getElementById('bottle-form-image');
        const imgPreview = document.getElementById('bottle-form-image-preview');
        
        imgInput.value = ''; imgPreview.style.display = 'none'; imgPreview.src = '';

        if (id) {
            title.innerText = "تعديل الزجاجة";
            const b = bottles.find(x => String(x.id) === String(id));
            if (b) {
                idInput.value = b.id; nameInput.value = b.name; priceInput.value = b.price_diff;
                if (b.image_url) { imgPreview.src = window.imageUrl(b.image_url); imgPreview.style.display = 'block'; }
            }
        } else {
            title.innerText = "إضافة زجاجة جديدة";
            idInput.value = ''; nameInput.value = ''; priceInput.value = '';
        }
        window.openModal('bottleFormModal');
    };

    window.saveBottle = async function() {
        const id = document.getElementById('bottle-form-id').value;
        const name = document.getElementById('bottle-form-name').value.trim();
        const priceDiff = parseFloat(document.getElementById('bottle-form-price').value) || 0;
        const imageFile = document.getElementById('bottle-form-image').files[0];
        if (!name) return alert('اسم الزجاجة مطلوب');

        const btn = document.querySelector('#bottleFormModal .btn-success'); const oldText = btn.innerText; btn.innerText = '...'; btn.disabled = true;
        try {
            let imgUrl = null; if (imageFile) imgUrl = await window.uploadToB2(imageFile);
            const dataToSave = { name: name, price_diff: priceDiff, size_id: 2 };
            if (imgUrl) dataToSave.image_url = imgUrl;

            if (id) await _supabase.from('perfume_bottles').update(dataToSave).eq('id', id);
            else await _supabase.from('perfume_bottles').insert([dataToSave]);

            await window.loadAllData(); window.closeModalAndPopHistory('bottleFormModal'); window.switchAdminTab('bottles'); window.showToast('تم الحفظ');
        } catch (err) { alert('Hata: ' + err.message); } finally { btn.innerText = oldText; btn.disabled = false; }
    };

    window.deleteBottle = async function(id) {
        if (!confirm('تأكيد الحذف؟')) return;
        try { await _supabase.from('perfume_bottles').delete().eq('id', id); await window.loadAllData(); window.switchAdminTab('bottles'); window.showToast('تم الحذف'); } catch (err) { alert('Hata: ' + err.message); }
    };

    window.previewSettingLogo = function(input) {
        if (input.files && input.files[0]) settingLogoFile = input.files[0];
        const preview = document.getElementById('setting-logo-preview');
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) { preview.src = e.target.result; preview.style.display = 'block'; };
            reader.readAsDataURL(input.files[0]);
        }
    };

    window.renderSettingsTab = function() {
        return `
            <div class="form-group">
                <label>شعار المتجر (Logo)</label>
                <input type="file" id="setting-logo-file" accept="image/*" onchange="window.previewSettingLogo(this)" style="display:none;">
                <button type="button" class="btn-gold" onclick="document.getElementById('setting-logo-file').click()" style="width:100%;">اختيار شعار</button>
                <img id="setting-logo-preview" src="${siteSettings.logo_url ? window.imageUrl(siteSettings.logo_url) : ''}" style="display:${siteSettings.logo_url ? 'block' : 'none'}; max-height:100px; margin:10px auto; object-fit:contain;">
            </div>
            <div class="form-group">
                <label>العنوان الرئيسي</label>
                <input type="text" id="setting-hero-title" value="${siteSettings.hero_title}">
            </div>
            <div class="form-group">
                <label>العنوان الفرعي</label>
                <input type="text" id="setting-hero-subtitle" value="${siteSettings.hero_subtitle}">
            </div>
            <div class="form-group">
                <label>نص الشحن المجاني</label>
                <input type="text" id="setting-shipping-text" value="${siteSettings.free_shipping_text}">
            </div>
            <div class="form-group">
                <label>رقم الواتساب (بدون +)</label>
                <input type="text" id="setting-whatsapp" value="${siteSettings.whatsapp_number}">
            </div>
            <button class="btn-success" style="width:100%; padding:12px;" onclick="window.saveSettings()">حفظ الإعدادات</button>
        `;
    };

    window.saveSettings = async function() {
        const title = document.getElementById('setting-hero-title').value;
        const subtitle = document.getElementById('setting-hero-subtitle').value;
        const shipping = document.getElementById('setting-shipping-text').value;
        const whatsapp = document.getElementById('setting-whatsapp').value;

        const btn = document.querySelector('#adminContent .btn-success'); const oldText = btn.innerText; btn.innerText = '...'; btn.disabled = true;

        try {
            let logoUrl = siteSettings.logo_url;
            if (settingLogoFile) logoUrl = await window.uploadToB2(settingLogoFile);

            const { error } = await _supabase.from('site_settings').update({
                hero_title: title, hero_subtitle: subtitle, free_shipping_text: shipping, whatsapp_number: whatsapp, logo_url: logoUrl
            }).eq('id', 1);
            if (error) throw error;

            await window.loadSiteSettings(); window.switchAdminTab('settings'); window.showToast('تم الحفظ بنجاح'); settingLogoFile = null;
        } catch (err) { alert('Hata: ' + err.message); } finally { btn.innerText = oldText; btn.disabled = false; }
    };

    // --- BAŞLATMA (INIT) ---
    document.addEventListener('DOMContentLoaded', async () => {
        initSupabase();
        
        if (_supabase) {
            await window.loadSiteSettings();
            await window.loadAllData();
            
            // SAYFA YENİLENDİĞİNDE OTURUMU KONTROL ET
            const { data: { session } } = await _supabase.auth.getSession();
            if (session) {
                isAdmin = true;
                sessionToken = session.access_token;
                const adminBar = document.getElementById('adminBar');
                if (adminBar) adminBar.style.display = 'flex';
            } else {
                isAdmin = false;
                sessionToken = null;
                const adminBar = document.getElementById('adminBar');
                if (adminBar) adminBar.style.display = 'none';
            }
        }
        
        window.renderCategories();
        window.applyLocalFilter();
        window.updateCartUI();
        window.hideLoadingScreen();
    });

})();
