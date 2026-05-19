// ============================================
// eCargoWorld — Admin Panel Controller
// ============================================

(function() {
    'use strict';

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
            
            var canAccess = profileResult.data && (profileResult.data.role === 'manager' || profileResult.data.role === 'director' || profileResult.data.is_admin);
            if (!canAccess) {
                window.location.href = 'app.html';
                return false;
            }
            return true;
        } catch(e) {
            window.location.href = 'login.html';
            return false;
        }
    }

    class AdminPanel {
        constructor() {
            this.db = window.supabase;
            this.pendingUploads = new Map();
            this.teamsCache = [];
            this.init();
        }

        async init() {
            var allowed = await checkAdminAccess();
            if (!allowed) return;
            this.bindNavigation();
            this.bindImageUploads();
            this.bindSaveButtons();
            this.bindTeamActions();
            await this.loadCurrentSettings();
            this.loadTeams();
            this.loadUsers();
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
                    if (section === 'users') self.loadUsers();
                    if (section === 'teams') self.loadTeams();
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
                card.addEventListener('click', function(e) {
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
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
                alert('Please upload PNG, JPEG, WebP, or SVG.');
                return;
            }
            if (file.size > 5 * 1024 * 1024) { alert('Max 5MB.'); return; }
            this.pendingUploads.set(slot, file);
            var reader = new FileReader();
            var self = this;
            reader.onload = function(e) {
                var preview = document.getElementById(self.getPreviewId(slot));
                var placeholder = document.getElementById(self.getPlaceholderId(slot));
                if (preview) { preview.src = e.target.result; preview.style.display = 'block'; }
                if (placeholder) placeholder.style.display = 'none';
                var card = preview ? preview.closest('.image-upload-card') : null;
                if (card) { card.classList.add('has-image'); var rm = card.querySelector('.remove-image'); if (rm) rm.style.display = 'inline-flex'; }
            };
            reader.readAsDataURL(file);
        }

        handleImageRemoved(slot) {
            this.pendingUploads.set(slot, null);
            var preview = document.getElementById(this.getPreviewId(slot));
            var placeholder = document.getElementById(this.getPlaceholderId(slot));
            if (preview) { preview.src = ''; preview.style.display = 'none'; }
            if (placeholder) placeholder.style.display = 'block';
            var card = preview ? preview.closest('.image-upload-card') : null;
            if (card) { card.classList.remove('has-image'); var rm = card.querySelector('.remove-image'); if (rm) rm.style.display = 'none'; }
        }

        getPreviewId(slot) {
            var map = { logo_ecw: 'logoEcwPreview', logo_als: 'logoAlsPreview', hero_image: 'heroImagePreview', why_us_image: 'whyUsImagePreview', service_air: 'serviceAirPreview', service_sea: 'serviceSeaPreview', cert_1: 'cert1Preview', cert_2: 'cert2Preview', cert_3: 'cert3Preview', cert_4: 'cert4Preview', cert_5: 'cert5Preview' };
            return map[slot] || '';
        }

        getPlaceholderId(slot) {
            var map = { logo_ecw: 'logoEcwPlaceholder', logo_als: 'logoAlsPlaceholder', hero_image: 'heroImagePlaceholder', why_us_image: 'whyUsImagePlaceholder', service_air: 'serviceAirPlaceholder', service_sea: 'serviceSeaPlaceholder', cert_1: 'cert1Placeholder', cert_2: 'cert2Placeholder', cert_3: 'cert3Placeholder', cert_4: 'cert4Placeholder', cert_5: 'cert5Placeholder' };
            return map[slot] || '';
        }

        bindSaveButtons() {
            var self = this;
            document.getElementById('saveBranding')?.addEventListener('click', function() { self.saveBranding(); });
            document.getElementById('saveSettings')?.addEventListener('click', function() { self.saveSettings(); });
        }

        async saveBranding() {
            var saveBtn = document.getElementById('saveBranding');
            var orig = saveBtn.textContent;
            saveBtn.textContent = 'Saving...'; saveBtn.disabled = true;
            try {
                var updates = {};
                for (var i = 1; i <= 5; i++) {
                    var ni = document.getElementById('cert' + i + 'Name');
                    if (ni) updates['cert_' + i + '_name'] = ni.value.trim();
                }
                for (var entry of this.pendingUploads.entries()) {
                    var slot = entry[0], file = entry[1];
                    if (file === null) { updates[slot + '_url'] = ''; }
                    else if (file instanceof File) {
                        var fp = slot + '_' + Date.now() + '.' + file.name.split('.').pop();
                        var up = await this.db.storage.from('assets').upload(fp, file, { cacheControl: '0', upsert: true });
                        if (up.error) throw up.error;
                        updates[slot + '_url'] = this.db.storage.from('assets').getPublicUrl(fp).data.publicUrl;
                    }
                }
                if (Object.keys(updates).length) {
                    updates.updated_at = new Date().toISOString();
                    var sr = await this.db.from('settings').upsert({ id: 1, ...updates }, { onConflict: 'id' });
                    if (sr.error) throw sr.error;
                    this.pendingUploads.clear();
                    this.showToast('Saved!');
                    await this.loadCurrentSettings();
                }
            } catch(e) { this.showToast('Error: ' + e.message, 'error'); }
            finally { saveBtn.textContent = orig; saveBtn.disabled = false; }
        }

        async saveSettings() {
            var saveBtn = document.getElementById('saveSettings');
            var orig = saveBtn.textContent;
            saveBtn.textContent = 'Saving...'; saveBtn.disabled = true;
            try {
                var s = {
                    company_name: document.getElementById('settingCompanyName')?.value || '',
                    company_email: document.getElementById('settingCompanyEmail')?.value || '',
                    company_phone: document.getElementById('settingCompanyPhone')?.value || '',
                    company_address: document.getElementById('settingCompanyAddress')?.value || '',
                    usd_pkr_rate: parseFloat(document.getElementById('settingUsdPkr')?.value) || 278.50,
                    updated_at: new Date().toISOString()
                };
                var r = await this.db.from('settings').upsert({ id: 1, ...s }, { onConflict: 'id' });
                if (r.error) throw r.error;
                this.showToast('Settings saved!');
            } catch(e) { this.showToast('Error: ' + e.message, 'error'); }
            finally { saveBtn.textContent = orig; saveBtn.disabled = false; }
        }

        async loadCurrentSettings() {
            try {
                var r = await this.db.from('settings').select('*').single();
                if (r.error || !r.data) return;
                var s = r.data;
                var fm = { settingCompanyName: 'company_name', settingCompanyEmail: 'company_email', settingCompanyPhone: 'company_phone', settingCompanyAddress: 'company_address', settingUsdPkr: 'usd_pkr_rate' };
                for (var k in fm) { var el = document.getElementById(k); if (el && s[fm[k]] != null) el.value = s[fm[k]]; }
                for (var i = 1; i <= 5; i++) {
                    var ni = document.getElementById('cert' + i + 'Name');
                    if (ni && s['cert_' + i + '_name'] != null) ni.value = s['cert_' + i + '_name'] || '';
                }
                var slots = ['logo_ecw','logo_als','hero_image','why_us_image','service_air','service_sea','cert_1','cert_2','cert_3','cert_4','cert_5'];
                var self = this;
                slots.forEach(function(slot) {
                    var url = s[slot + '_url'];
                    if (url) {
                        var pv = document.getElementById(self.getPreviewId(slot));
                        var ph = document.getElementById(self.getPlaceholderId(slot));
                        if (pv) { pv.src = url + '?t=' + Date.now(); pv.style.display = 'block'; }
                        if (ph) ph.style.display = 'none';
                        var card = pv ? pv.closest('.image-upload-card') : null;
                        if (card) { card.classList.add('has-image'); var rm = card.querySelector('.remove-image'); if (rm) rm.style.display = 'inline-flex'; }
                    }
                });
            } catch(e) {}
        }

        // ============ TEAMS ============
        bindTeamActions() {
            var self = this;
            document.getElementById('btnAddTeam')?.addEventListener('click', function() { self.addTeam(); });
        }

        async loadTeams() {
            var container = document.getElementById('teamsListContainer');
            if (!container) return;
            try {
                var r = await this.db.from('teams').select('*').order('name');
                this.teamsCache = r.data || [];
                if (!this.teamsCache.length) {
                    container.innerHTML = '<p style="color:#9a9a9a;text-align:center;padding:40px;">No teams yet. Create one below.</p>';
                    return;
                }
                var self = this;
                container.innerHTML = this.teamsCache.map(function(t) {
                    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fafafa;border:1px solid #f0f0f0;border-radius:8px;margin-bottom:4px;" data-id="' + t.id + '">' +
                        '<div style="flex:1;"><strong style="font-size:0.85rem;">' + escapeHtml(t.name) + '</strong>' + (t.description ? '<br><small style="color:#9a9a9a;font-size:0.75rem;">' + escapeHtml(t.description) + '</small>' : '') + '</div>' +
                        '<button class="btn btn-sm edit-team-btn" style="padding:4px 10px;font-size:0.75rem;background:#fff;border:1px solid #e5e5e5;border-radius:4px;cursor:pointer;font-family:inherit;">Edit</button>' +
                        '<button class="btn btn-sm delete-team-btn" style="padding:4px 10px;font-size:0.75rem;background:#fef2f2;color:#e5484d;border:1px solid #fecaca;border-radius:4px;cursor:pointer;font-family:inherit;">Delete</button>' +
                        '</div>';
                }).join('');

                container.querySelectorAll('.edit-team-btn').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var row = btn.closest('[data-id]');
                        var id = row.dataset.id;
                        var name = row.querySelector('strong').textContent;
                        var desc = row.querySelector('small') ? row.querySelector('small').textContent : '';
                        var newName = prompt('Edit team name:', name);
                        if (newName && newName.trim()) { self.updateTeam(id, newName.trim(), desc); }
                    });
                });

                container.querySelectorAll('.delete-team-btn').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        if (!confirm('Delete this team?')) return;
                        self.deleteTeam(btn.closest('[data-id]').dataset.id);
                    });
                });
            } catch(e) {
                container.innerHTML = '<p style="color:#e5484d;text-align:center;padding:40px;">Error loading teams.</p>';
            }
        }

        async addTeam() {
            var nameInput = document.getElementById('newTeamName');
            var descInput = document.getElementById('newTeamDesc');
            var name = nameInput.value.trim();
            if (!name) { alert('Enter a team name.'); return; }
            try {
                await this.db.from('teams').insert({ name: name, description: descInput.value.trim() });
                nameInput.value = ''; descInput.value = '';
                this.showToast('Team created!');
                this.loadTeams();
            } catch(e) { this.showToast('Error: ' + e.message, 'error'); }
        }

        async updateTeam(id, name, description) {
            try {
                await this.db.from('teams').update({ name: name, description: description, updated_at: new Date().toISOString() }).eq('id', id);
                this.showToast('Team updated!');
                this.loadTeams();
            } catch(e) { this.showToast('Error: ' + e.message, 'error'); }
        }

        async deleteTeam(id) {
            try {
                await this.db.from('teams').delete().eq('id', id);
                this.showToast('Team deleted.');
                this.loadTeams();
            } catch(e) { this.showToast('Error: ' + e.message, 'error'); }
        }

        // ============ USERS ============
        async loadUsers() {
            var container = document.getElementById('usersListContainer');
            if (!container) return;
            container.innerHTML = '<p style="color:#9a9a9a;text-align:center;padding:40px;">Loading...</p>';
            try {
                var r = await this.db.from('profiles').select('*').order('full_name');
                if (!r.data || !r.data.length) {
                    container.innerHTML = '<p style="color:#9a9a9a;text-align:center;padding:40px;">No users.</p>';
                    return;
                }
                var self = this;
                var teamsOpts = '<option value="">No Team</option>';
                if (this.teamsCache.length) {
                    teamsOpts += this.teamsCache.map(function(t) {
                        return '<option value="' + t.id + '">' + escapeHtml(t.name) + '</option>';
                    }).join('');
                }

                container.innerHTML = r.data.map(function(p) {
                    var teamOptsHtml = teamsOpts.replace('value="' + (p.team_id || '') + '"', 'value="' + (p.team_id || '') + '" selected');
                    return '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:#fafafa;border:1px solid #f0f0f0;border-radius:8px;margin-bottom:6px;flex-wrap:wrap;" data-id="' + p.id + '">' +
                        '<div style="flex:1;min-width:120px;"><strong style="font-size:0.85rem;">' + (p.full_name || 'Unnamed') + '</strong><br><small style="color:#9a9a9a;font-size:0.75rem;">' + (p.email || '') + '</small></div>' +
                        '<div style="display:flex;flex-direction:column;gap:2px;"><label style="font-size:0.65rem;color:#9a9a9a;text-transform:uppercase;">Name</label><input type="text" class="user-name-input" value="' + (p.full_name || '') + '" style="background:#fff;border:1px solid #e5e5e5;color:#1a1a1a;padding:5px 8px;border-radius:4px;font-family:inherit;font-size:0.8rem;"></div>' +
                        '<div style="display:flex;flex-direction:column;gap:2px;"><label style="font-size:0.65rem;color:#9a9a9a;text-transform:uppercase;">Role</label><select class="user-role-select" style="background:#fff;border:1px solid #e5e5e5;color:#1a1a1a;padding:5px 8px;border-radius:4px;font-family:inherit;font-size:0.8rem;cursor:pointer;">' +
                            '<option value="employee"' + (p.role === 'employee' ? ' selected' : '') + '>Employee</option>' +
                            '<option value="operations_manager"' + (p.role === 'operations_manager' ? ' selected' : '') + '>Ops Manager</option>' +
                            '<option value="manager"' + (p.role === 'manager' ? ' selected' : '') + '>Website Manager</option>' +
                            '<option value="director"' + (p.role === 'director' ? ' selected' : '') + '>Director</option>' +
                        '</select></div>' +
                        '<div style="display:flex;flex-direction:column;gap:2px;"><label style="font-size:0.65rem;color:#9a9a9a;text-transform:uppercase;">Team</label><select class="user-team-select" style="background:#fff;border:1px solid #e5e5e5;color:#1a1a1a;padding:5px 8px;border-radius:4px;font-family:inherit;font-size:0.8rem;cursor:pointer;">' + teamOptsHtml + '</select></div>' +
                        '<button class="save-user-btn" style="padding:4px 10px;font-size:0.75rem;background:#F5A623;color:#1a1a1a;border:none;border-radius:4px;cursor:pointer;font-weight:600;font-family:inherit;">Save</button>' +
                        '</div>';
                }).join('');

                container.querySelectorAll('.save-user-btn').forEach(function(btn) {
                    btn.addEventListener('click', async function() {
                        var row = btn.closest('[data-id]');
                        var uid = row.dataset.id;
                        var newName = row.querySelector('.user-name-input').value.trim();
                        var newRole = row.querySelector('.user-role-select').value;
                        var newTeam = row.querySelector('.user-team-select').value || null;

                        btn.textContent = '...'; btn.disabled = true;
                        try {
                            await self.db.from('profiles').update({
                                full_name: newName, role: newRole, team_id: newTeam,
                                is_admin: (newRole === 'director'), updated_at: new Date().toISOString()
                            }).eq('id', uid);
                            self.showToast('User updated!');
                            self.loadUsers();
                        } catch(e) {
                            self.showToast('Error: ' + e.message, 'error');
                            btn.textContent = 'Save'; btn.disabled = false;
                        }
                    });
                });
            } catch(e) {
                container.innerHTML = '<p style="color:#e5484d;text-align:center;padding:40px;">Error.</p>';
            }
        }

        showToast(message, type) {
            type = type || 'success';
            var toast = document.createElement('div');
            toast.textContent = message;
            toast.style.cssText = 'position:fixed;bottom:30px;right:30px;background:' + (type === 'error' ? '#e5484d' : '#22c55e') + ';color:white;padding:14px 24px;border-radius:8px;font-family:Inter,sans-serif;font-weight:500;font-size:0.9rem;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.1);animation:toastIn 0.3s ease-out;';
            document.body.appendChild(toast);
            setTimeout(function() { toast.style.animation = 'toastOut 0.3s ease-in'; setTimeout(function() { toast.remove(); }, 300); }, 3500);
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    document.addEventListener('DOMContentLoaded', function() { new AdminPanel(); });
})();
