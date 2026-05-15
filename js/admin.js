// ============================================
// ALS eCargoWorld — Admin Panel Controller
// ============================================

(function() {
    'use strict';

    // ============ AUTH CHECK ============
    async function checkAdminAccess() {
        try {
            var userResult = await window.supabase.auth.getUser();
            if (!userResult.data || !userResult.data.user) {
                window.location.href = 'login.html';
                return false;
            }
            var profileResult = await window.supabase
                .from('profiles')
                .select('role, is_admin')
                .eq('id', userResult.data.user.id)
                .single();
            
            var isManager = profileResult.data && (profileResult.data.role === 'manager' || profileResult.data.is_admin);
            if (!isManager) {
                window.location.href = 'app.html';
                return false;
            }
            return true;
        } catch(e) {
            window.location.href = 'login.html';
            return false;
        }
    }

    // ============ ADMIN PANEL CLASS ============
    class AdminPanel {
        constructor() {
            this.db = window.supabase;
            this.pendingUploads = new Map();
            this.init();
        }

        async init() {
            var allowed = await checkAdminAccess();
            if (!allowed) return;

            this.bindNavigation();
            this.bindImageUploads();
            this.bindSaveButtons();
            await this.loadCurrentSettings();
        }

        bindNavigation() {
            var self = this;
            document.querySelectorAll('.admin-nav-item').forEach(function(item) {
                item.addEventListener('click', function() {
                    var section = item.dataset.section;
                    document.querySelectorAll('.admin-nav-item').forEach(function(n) { n.classList.remove('active'); });
                    item.classList.add('active');
                    document.querySelectorAll('.admin-section').forEach(function(s) { s.classList.remove('active'); });
                    var sectionEl = document.getElementById('section' + section.charAt(0).toUpperCase() + section.slice(1));
                    if (sectionEl) sectionEl.classList.add('active');
                });
            });
        }

        bindImageUploads() {
            var self = this;
            document.querySelectorAll('input[type="file"]').forEach(function(input) {
                input.addEventListener('change', function(e) {
                    var file = e.target.files[0];
                    var slot = input.dataset.slot;
                    if (file && slot) self.handleImageSelected(slot, file);
                });
            });

            document.querySelectorAll('.upload-trigger').forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var input = btn.closest('.image-upload-card')?.querySelector('input[type="file"]');
                    if (input) input.click();
                });
            });

            document.querySelectorAll('.image-upload-card').forEach(function(card) {
                card.addEventListener('click', function() {
                    var input = card.querySelector('input[type="file"]');
                    if (input) input.click();
                });
            });

            document.querySelectorAll('.remove-image').forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    self.handleImageRemoved(btn.dataset.slot);
                });
            });
        }

        handleImageSelected(slot, file) {
            if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
                alert('Please upload a PNG, JPEG, WebP, or SVG file.');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                alert('File size must be under 5MB.');
                return;
            }

            this.pendingUploads.set(slot, file);

            var reader = new FileReader();
            var self = this;
            reader.onload = function(e) {
                var previewId = self.getPreviewId(slot);
                var placeholderId = self.getPlaceholderId(slot);
                var preview = document.getElementById(previewId);
                var placeholder = document.getElementById(placeholderId);
                if (preview) { preview.src = e.target.result; preview.style.display = 'block'; }
                if (placeholder) placeholder.style.display = 'none';
                var card = preview?.closest('.image-upload-card');
                if (card) { card.classList.add('has-image'); card.querySelector('.remove-image').style.display = 'inline-flex'; }
            };
            reader.readAsDataURL(file);
        }

        handleImageRemoved(slot) {
            this.pendingUploads.set(slot, null);
            var preview = document.getElementById(this.getPreviewId(slot));
            var placeholder = document.getElementById(this.getPlaceholderId(slot));
            if (preview) { preview.src = ''; preview.style.display = 'none'; }
            if (placeholder) placeholder.style.display = 'block';
            var card = preview?.closest('.image-upload-card');
            if (card) { card.classList.remove('has-image'); card.querySelector('.remove-image').style.display = 'none'; }
        }

        getPreviewId(slot) {
            var map = { 
                logo_ecw: 'logoEcwPreview', logo_als: 'logoAlsPreview', 
                hero_image: 'heroImagePreview', why_us_image: 'whyUsImagePreview', 
                service_air: 'serviceAirPreview', service_sea: 'serviceSeaPreview',
                cert_iata: 'certIataPreview', cert_piffa: 'certPiffaPreview',
                cert_aac: 'certAacPreview', cert_lcci: 'certLcciPreview',
                cert_naplcc: 'certNaplccPreview'
            };
            return map[slot] || '';
        }

        getPlaceholderId(slot) {
            var map = { 
                logo_ecw: 'logoEcwPlaceholder', logo_als: 'logoAlsPlaceholder', 
                hero_image: 'heroImagePlaceholder', why_us_image: 'whyUsImagePlaceholder', 
                service_air: 'serviceAirPlaceholder', service_sea: 'serviceSeaPlaceholder',
                cert_iata: 'certIataPlaceholder', cert_piffa: 'certPiffaPlaceholder',
                cert_aac: 'certAacPlaceholder', cert_lcci: 'certLcciPlaceholder',
                cert_naplcc: 'certNaplccPlaceholder'
            };
            return map[slot] || '';
        }

        bindSaveButtons() {
            var self = this;
            var saveBrandingBtn = document.getElementById('saveBranding');
            var saveSettingsBtn = document.getElementById('saveSettings');
            if (saveBrandingBtn) saveBrandingBtn.addEventListener('click', function() { self.saveBranding(); });
            if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', function() { self.saveSettings(); });
        }

        async saveBranding() {
            var saveBtn = document.getElementById('saveBranding');
            var originalText = saveBtn.textContent;
            saveBtn.textContent = 'Uploading...';
            saveBtn.disabled = true;

            try {
                var updates = {};

                for (var entry of this.pendingUploads.entries()) {
                    var slot = entry[0];
                    var file = entry[1];

                    if (file === null) {
                        updates[slot + '_url'] = '';
                    } else if (file instanceof File) {
                        var fileExt = file.name.split('.').pop();
                        var filePath = slot + '.' + fileExt;
                        
                        var uploadResult = await this.db.storage
                            .from('assets')
                            .upload(filePath, file, { cacheControl: '3600', upsert: true });

                        if (uploadResult.error) throw uploadResult.error;

                        var urlResult = this.db.storage
                            .from('assets')
                            .getPublicUrl(filePath);

                        updates[slot + '_url'] = urlResult.data.publicUrl;
                    }
                }

                if (Object.keys(updates).length > 0) {
                    updates.updated_at = new Date().toISOString();
                    var settingsResult = await this.db
                        .from('settings')
                        .upsert({ id: 1, ...updates }, { onConflict: 'id' });

                    if (settingsResult.error) throw settingsResult.error;

                    this.pendingUploads.clear();
                    this.showToast('Images saved successfully!');
                    await this.loadCurrentSettings();
                } else {
                    this.showToast('No changes to save.');
                }
            } catch (error) {
                console.error('Failed to save images:', error);
                this.showToast('Error: ' + (error.message || 'Unknown error'), 'error');
            } finally {
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }
        }

        async saveSettings() {
            var saveBtn = document.getElementById('saveSettings');
            var originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saving...';
            saveBtn.disabled = true;

            try {
                var settings = {
                    company_name: document.getElementById('settingCompanyName')?.value || '',
                    company_email: document.getElementById('settingCompanyEmail')?.value || '',
                    company_phone: document.getElementById('settingCompanyPhone')?.value || '',
                    company_address: document.getElementById('settingCompanyAddress')?.value || '',
                    usd_pkr_rate: parseFloat(document.getElementById('settingUsdPkr')?.value) || 278.50,
                    updated_at: new Date().toISOString()
                };

                var result = await this.db
                    .from('settings')
                    .upsert({ id: 1, ...settings }, { onConflict: 'id' });

                if (result.error) throw result.error;
                this.showToast('Settings saved successfully!');
            } catch (error) {
                console.error('Failed to save settings:', error);
                this.showToast('Error: ' + (error.message || 'Unknown error'), 'error');
            } finally {
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }
        }

        async loadCurrentSettings() {
            try {
                var result = await this.db.from('settings').select('*').single();
                if (result.error || !result.data) return;
                var settings = result.data;

                var fieldMap = {
                    settingCompanyName: 'company_name',
                    settingCompanyEmail: 'company_email',
                    settingCompanyPhone: 'company_phone',
                    settingCompanyAddress: 'company_address',
                    settingUsdPkr: 'usd_pkr_rate'
                };

                for (var elementId in fieldMap) {
                    var el = document.getElementById(elementId);
                    var key = fieldMap[elementId];
                    if (el && settings[key] !== undefined && settings[key] !== null) {
                        el.value = settings[key];
                    }
                }

                var imageSlots = [
                    'logo_ecw', 'logo_als', 'hero_image', 'why_us_image', 
                    'service_air', 'service_sea',
                    'cert_iata', 'cert_piffa', 'cert_aac', 'cert_lcci', 'cert_naplcc'
                ];
                var self = this;
                imageSlots.forEach(function(slot) {
                    var url = settings[slot + '_url'];
                    if (url) {
                        var preview = document.getElementById(self.getPreviewId(slot));
                        var placeholder = document.getElementById(self.getPlaceholderId(slot));
                        if (preview) { preview.src = url; preview.style.display = 'block'; }
                        if (placeholder) placeholder.style.display = 'none';
                        var card = preview?.closest('.image-upload-card');
                        if (card) { card.classList.add('has-image'); card.querySelector('.remove-image').style.display = 'inline-flex'; }
                    }
                });
            } catch (error) {
                console.error('Failed to load settings:', error);
            }
        }

        showToast(message, type) {
            type = type || 'success';
            var toast = document.createElement('div');
            toast.textContent = message;
            toast.style.cssText = 'position:fixed;bottom:30px;right:30px;background:' + (type === 'error' ? '#ef4444' : '#22c55e') + ';color:white;padding:14px 24px;border-radius:10px;font-family:Inter,sans-serif;font-weight:500;font-size:0.9rem;z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,0.4);animation:toastIn 0.3s ease-out;';
            document.body.appendChild(toast);
            setTimeout(function() { 
                toast.style.animation = 'toastOut 0.3s ease-in'; 
                setTimeout(function() { toast.remove(); }, 300); 
            }, 3500);
        }
    }

    document.addEventListener('DOMContentLoaded', function() { 
        new AdminPanel(); 
    });

})();
