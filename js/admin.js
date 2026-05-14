// ============================================
// ALS eCargoWorld — Admin Panel Controller
// ============================================

class AdminPanel {
    constructor() {
        this.db = window.supabase;
        this.pendingUploads = new Map();
        this.init();
    }

    async init() {
        this.bindNavigation();
        this.bindImageUploads();
        this.bindSaveButtons();
        await this.loadCurrentSettings();
    }

    bindNavigation() {
        document.querySelectorAll('.admin-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                document.querySelectorAll('.admin-nav-item').forEach(n => n.classList.remove('active'));
                item.classList.add('active');
                document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
                document.getElementById('section' + section.charAt(0).toUpperCase() + section.slice(1))?.classList.add('active');
            });
        });
    }

    bindImageUploads() {
        document.querySelectorAll('input[type="file"]').forEach(input => {
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                const slot = input.dataset.slot;
                if (file && slot) this.handleImageSelected(slot, file);
            });
        });

        document.querySelectorAll('.upload-trigger').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                btn.closest('.image-upload-card')?.querySelector('input[type="file"]')?.click();
            });
        });

        document.querySelectorAll('.image-upload-card').forEach(card => {
            card.addEventListener('click', () => card.querySelector('input[type="file"]')?.click());
        });

        document.querySelectorAll('.remove-image').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleImageRemoved(btn.dataset.slot);
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

        const reader = new FileReader();
        reader.onload = (e) => {
            const previewId = this.getPreviewId(slot);
            const placeholderId = this.getPlaceholderId(slot);
            const preview = document.getElementById(previewId);
            const placeholder = document.getElementById(placeholderId);
            if (preview) { preview.src = e.target.result; preview.style.display = 'block'; }
            if (placeholder) placeholder.style.display = 'none';
            const card = preview?.closest('.image-upload-card');
            if (card) { card.classList.add('has-image'); card.querySelector('.remove-image').style.display = 'inline-flex'; }
        };
        reader.readAsDataURL(file);
    }

    handleImageRemoved(slot) {
        this.pendingUploads.set(slot, null);
        const preview = document.getElementById(this.getPreviewId(slot));
        const placeholder = document.getElementById(this.getPlaceholderId(slot));
        if (preview) { preview.src = ''; preview.style.display = 'none'; }
        if (placeholder) placeholder.style.display = 'block';
        const card = preview?.closest('.image-upload-card');
        if (card) { card.classList.remove('has-image'); card.querySelector('.remove-image').style.display = 'none'; }
    }

    getPreviewId(slot) {
        var map = { logo_ecw: 'logoEcwPreview', logo_als: 'logoAlsPreview', hero_image: 'heroImagePreview', why_us_image: 'whyUsImagePreview', service_air: 'serviceAirPreview', service_sea: 'serviceSeaPreview' };
        return map[slot] || '';
    }

    getPlaceholderId(slot) {
        var map = { logo_ecw: 'logoEcwPlaceholder', logo_als: 'logoAlsPlaceholder', hero_image: 'heroImagePlaceholder', why_us_image: 'whyUsImagePlaceholder', service_air: 'serviceAirPlaceholder', service_sea: 'serviceSeaPlaceholder' };
        return map[slot] || '';
    }

    bindSaveButtons() {
        document.getElementById('saveBranding')?.addEventListener('click', () => this.saveBranding());
        document.getElementById('saveSettings')?.addEventListener('click', () => this.saveSettings());
    }

    async saveBranding() {
        var saveBtn = document.getElementById('saveBranding');
        var originalText = saveBtn.textContent;
        saveBtn.textContent = 'Uploading...';
        saveBtn.disabled = true;

        try {
            var updates = {};
            var self = this;

            for (var [slot, file] of this.pendingUploads.entries()) {
                if (file === null) {
                    updates[slot + '_url'] = '';
                } else if (file instanceof File) {
                    var fileExt = file.name.split('.').pop();
                    var filePath = slot + '.' + fileExt;
                    
                    var uploadResult = await self.db.storage
                        .from('assets')
                        .upload(filePath, file, { cacheControl: '3600', upsert: true });

                    if (uploadResult.error) throw uploadResult.error;

                    var urlResult = self.db.storage
                        .from('assets')
                        .getPublicUrl(filePath);

                    updates[slot + '_url'] = urlResult.data.publicUrl;
                }
            }

            if (Object.keys(updates).length > 0) {
                updates.updated_at = new Date().toISOString();
                var settingsResult = await self.db
                    .from('settings')
                    .upsert({ id: 1, ...updates });

                if (settingsResult.error) throw settingsResult.error;

                self.pendingUploads.clear();
                self.showToast('Images saved successfully!');
            } else {
                self.showToast('No changes to save.');
            }
        } catch (error) {
            console.error('Failed to save images:', error);
            this.showToast('Error saving images: ' + error.message, 'error');
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
                company_name: document.getElementById('settingCompanyName')?.value,
                company_email: document.getElementById('settingCompanyEmail')?.value,
                company_phone: document.getElementById('settingCompanyPhone')?.value,
                company_address: document.getElementById('settingCompanyAddress')?.value,
                usd_pkr_rate: parseFloat(document.getElementById('settingUsdPkr')?.value) || 278.50,
                updated_at: new Date().toISOString()
            };

            var result = await this.db
                .from('settings')
                .upsert({ id: 1, ...settings });

            if (result.error) throw result.error;
            this.showToast('Settings saved successfully!');
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showToast('Error saving settings: ' + error.message, 'error');
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
                if (el && settings[key] !== undefined) el.value = settings[key];
            }

            var imageSlots = ['logo_ecw', 'logo_als', 'hero_image', 'why_us_image', 'service_air', 'service_sea'];
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
        setTimeout(function() { toast.style.animation = 'toastOut 0.3s ease-in'; setTimeout(function() { toast.remove(); }, 300); }, 3500);
    }
}

document.addEventListener('DOMContentLoaded', function() { new AdminPanel(); });
