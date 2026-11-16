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
        
        // SİSTEMDEKİ TÜM AKTİF YOĞUNLUKLARI OTOMATİK LİSTELE
        const activeIntensities = intensities.filter(i => i.active !== false);
        
        if (activeIntensities.length === 0) {
            pricesContainer.innerHTML = '<p style="color:red; font-size:0.9rem; text-align:center;">لم يتم إضافة أي تركيز في النظام بعد. يرجى إضافتها من الإعدادات.</p>';
        } else {
            activeIntensities.forEach(inten => {
                // Eğer düzenleniyorsa, bu yoğunluğa ait kayıtlı fiyatı bul
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
        row.setAttribute('data-intensity-id', intensityId); // ID'yi satıra kaydediyoruz

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

            // Sadece baz fiyatları (size_id = 2) sil
            const { error: delError } = await _supabase.from('perfume_prices').delete().eq('perfume_id', perfumeId).eq('size_id', 2);
            if (delError) throw delError;

            const priceRows = document.querySelectorAll('.price-row');
            const newPrices = [];
            
            priceRows.forEach(row => {
                const intId = row.getAttribute('data-intensity-id'); // Gizli ID'yi al
                const priceVal = parseFloat(row.querySelector('.price-value').value);

                // Eğer fiyat kutusu doldurulmuşsa kaydet
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
