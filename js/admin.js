// ============================================
// ALS eCargoWorld — Admin Panel Controller
// ============================================

import { supabase } from './supabase.js';
import { Store } from './store.js';

class AdminPanel {
    constructor() {
        this.store = new Store(supabase);
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
                document.getElementById(`section${this.capitalize(section)}`)?.classList.add('active');
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
                const card = btn.closest('.image-upload-card');
                card?.querySelector('input[type="file"]')?.click();
            });
        });

        document.querySelectorAll('.image-upload-card').forEach(card => {
            card.addEventListener('click', () => {
                card.querySelector('input[type="file"]')?.click();
            });
        });

        document.querySelectorAll('.remove-image').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleImageRemoved(btn.dataset.slot);
            });
        });
    }

    handleImageSelected(slot, file) {
        const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
        if (!allowedTypes.includes(file.type)) {
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
            const preview = document.getElementById(this.getPreviewId(slot));
            const placeholder = document.getElementById(this.getPlaceholderId(slot));
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
        const map = { logo_ecw: 'logoEcwPreview', logo_als: 'logoAlsPreview', hero_image: 'heroImagePreview', why_us_image: 'whyUsImagePreview', service_air: 'serviceAirPreview', service_sea: 'serviceSeaPreview' };
        return map[slot] || '';
    }

    getPlaceholderId(slot) {
        const map = { logo_ecw: 'logoEcwPlaceholder', logo_als: 'logoAlsPlaceholder', hero_image: 'heroImagePlaceholder', why_us_image: 'whyUsImagePlaceholder', service_air: 'serviceAirPlaceholder', service_sea: 'serviceSeaPlaceholder' };
        return map[slot] || '';
    }

    bindSaveButtons() {
        document.getElementById('saveBranding')?.addEventListener('click', () => this.saveBranding());
        document.getElementById('saveSettings')?.addEventListener('click', () => this.saveSettings());
    }

    async saveBranding() {
        const saveBtn = document.getElementById('saveBranding');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Uploading...';
        saveBtn.disabled = true;

        try {
            const updates = {};

            for (const [slot, file] of this.pendingUploads.entries()) {
                if (file === null) {
                    updates[`${slot}_url`] = '';
                    try { await this.store.deleteImage(`${slot}`); } catch (e) { /* nothing to delete */ }
                } else if (file instanceof File) {
                    const fileExt = file.name.split('.').pop();
                    const filePath = `${slot}.${fileExt}`;
                    const publicUrl = await this.store.uploadImage(filePath, file);
                    updates[`${slot}_url`] = publicUrl;
                }
            }

            if (Object.keys(updates).length > 0) {
                await this.store.updateSettings(updates);
                this.pendingUploads.clear();
                this.showToast('Images saved successfully!');
            } else {
                this.showToast('No changes to save.');
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
        const saveBtn = document.getElementById('saveSettings');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;

        try {
            const settings = {
                company_name: document.getElementById('settingCompanyName')?.value,
                company_email: document.getElementById('settingCompanyEmail')?.value,
                company_phone: document.getElementById('settingCompanyPhone')?.value,
                company_address: document.getElementById('settingCompanyAddress')?.value,
                usd_pkr_rate: parseFloat(document.getElementById('settingUsdPkr')?.value) || 278.50
            };

            await this.store.updateSettings(settings);
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
            const settings = await this.store.getSettings();

            const fieldMap = {
                settingCompanyName: 'company_name',
                settingCompanyEmail: 'company_email',
                settingCompanyPhone: 'company_phone',
                settingCompanyAddress: 'company_address',
                settingUsdPkr: 'usd_pkr_rate'
            };

            Object.entries(fieldMap).forEach(([elementId, settingKey]) => {
                const el = document.getElementById(elementId);
                if (el) el.value = settings[settingKey] || '';
            });

            // Load existing images
            const imageSlots = ['logo_ecw', 'logo_als', 'hero_image', 'why_us_image', 'service_air', 'service_sea'];
            imageSlots.forEach(slot => {
                const url = settings[`${slot}_url`];
                if (url) {
                    const preview = document.getElementById(this.getPreviewId(slot));
                    const placeholder = document.getElementById(this.getPlaceholderId(slot));
                    if (preview) { preview.src = url; preview.style.display = 'block'; }
                    if (placeholder) placeholder.style.display = 'none';
                    const card = preview?.closest('.image-upload-card');
                    if (card) { card.classList.add('has-image'); card.querySelector('.remove-image').style.display = 'inline-flex'; }
                }
            });
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed; bottom: 30px; right: 30px;
            background: ${type === 'error' ? '#ef4444' : '#22c55e'};
            color: white; padding: 14px 24px; border-radius: 10px;
            font-family: 'Inter', sans-serif; font-weight: 500; font-size: 0.9rem;
            z-index: 9999; box-shadow: 0 10px 30px rgba(0,0,0,0.4);
            animation: toastIn 0.3s ease-out;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s ease-in';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

document.addEventListener('DOMContentLoaded', () => new AdminPanel());
