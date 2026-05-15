// ============================================
// eCargoWorld — Dashboard Controller
// ============================================

(function() {
    'use strict';

    var db = window.supabase;
    var currentUser = null;
    var currentScreen = 'dashboard';
    var isManager = false;
    var isDirector = false;

    document.addEventListener('DOMContentLoaded', function() {
        initApp();
    });

    async function initApp() {
        var userResult = await db.auth.getUser();
        if (!userResult.data || !userResult.data.user) {
            window.location.href = 'login.html';
            return;
        }
        currentUser = userResult.data.user;

        var profileResult = await db.from('profiles').select('*').eq('id', currentUser.id).single();
        if (profileResult.data) {
            currentUser.profile = profileResult.data;
        }

        isManager = currentUser.profile && (currentUser.profile.role === 'manager' || currentUser.profile.role === 'director' || currentUser.profile.is_admin);
        isDirector = currentUser.profile && (currentUser.profile.role === 'director' || currentUser.profile.is_admin);

        updateUserUI();
        setupNavigation();
        setupLogout();
        setupAdminButton();
        loadLogos();
        setupRoleFeatures();

        if (typeof FlightTracker !== 'undefined') {
            FlightTracker.setDirector(isDirector);
        }

        loadDashboardOverview();
    }

    function updateUserUI() {
        var name = 'User';
        var initial = 'U';
        if (currentUser.profile && currentUser.profile.full_name) {
            name = currentUser.profile.full_name;
            initial = name.charAt(0).toUpperCase();
        } else if (currentUser.email) {
            name = currentUser.email.split('@')[0];
            initial = name.charAt(0).toUpperCase();
        }
        document.getElementById('userName').textContent = name;
        document.getElementById('userAvatar').textContent = initial;
    }

    function setupRoleFeatures() {
        if (isDirector) {
            document.getElementById('roleBadge').textContent = 'DIRECTOR';
            document.querySelectorAll('.manager-only').forEach(function(el) { el.style.display = 'flex'; });
            document.querySelectorAll('.director-only').forEach(function(el) { el.style.display = 'flex'; });
            document.querySelectorAll('.manager-only-col').forEach(function(el) { el.style.display = 'table-cell'; });
        } else if (isManager) {
            document.getElementById('roleBadge').textContent = 'MANAGER';
            document.querySelectorAll('.manager-only').forEach(function(el) { el.style.display = 'flex'; });
            document.querySelectorAll('.director-only').forEach(function(el) { el.style.display = 'none'; });
            document.querySelectorAll('.manager-only-col').forEach(function(el) { el.style.display = 'table-cell'; });
        } else {
            document.getElementById('roleBadge').textContent = 'EMPLOYEE';
        }
    }

    function setupAdminButton() {
        var btn = document.getElementById('btnAdmin');
        if (btn && (isManager || isDirector)) {
            btn.style.display = 'inline-flex';
        }
    }

    function setupNavigation() {
        document.querySelectorAll('.cmd-nav-item').forEach(function(item) {
            item.addEventListener('click', function() {
                var screen = item.dataset.screen;
                switchScreen(screen);
            });
        });
    }

    function switchScreen(screenName) {
        document.querySelectorAll('.cmd-nav-item').forEach(function(item) {
            item.classList.toggle('active', item.dataset.screen === screenName);
        });
        document.querySelectorAll('.screen').forEach(function(screen) {
            screen.classList.toggle('active', screen.id === 'screen' + screenName.charAt(0).toUpperCase() + screenName.slice(1));
        });
        currentScreen = screenName;

        if (screenName === 'dashboard') loadDashboardOverview();
        if (screenName === 'shipments') loadShipmentsPage();
        if (screenName === 'tasks') loadTasks();
        if (screenName === 'rates') loadRates();
        if (screenName === 'flights' && isDirector) loadFlightsPage();
        if (screenName === 'team' && isManager) loadTeam();
    }

    function setupLogout() {
        document.getElementById('btnLogout').addEventListener('click', async function() {
            await db.auth.signOut();
            window.location.href = 'login.html';
        });
    }

    async function loadLogos() {
        try {
            var result = await db.from('settings').select('logo_ecw_url, logo_als_url').single();
            if (result.data) {
                var ecw = document.getElementById('dashLogoEcw');
                if (ecw && result.data.logo_ecw_url) ecw.src = result.data.logo_ecw_url;
            }
        } catch(e) {}
    }

    // ============ DASHBOARD OVERVIEW ============
    async function loadDashboardOverview() {
        try {
            var result = await db.from('shipments').select('status');
            if (result.data) {
                var counts = {};
                result.data.forEach(function(s) { counts[s.status] = (counts[s.status] || 0) + 1; });
                document.getElementById('countActive').textContent = (counts.confirmed || 0) + (counts.booked || 0) + (counts.departed || 0);
                document.getElementById('countDelivered').textContent = counts.delivered || 0;
                document.getElementById('tlConfirmed').textContent = counts.confirmed || 0;
                document.getElementById('tlBooked').textContent = counts.booked || 0;
                document.getElementById('tlDeparted').textContent = counts.departed || 0;
                document.getElementById('tlArrived').textContent = counts.arrived || 0;
            }

            var taskResult = await db.from('tasks').select('*, shipments(awb_number, customer_name)').eq('status', 'pending').order('deadline', { ascending: true }).limit(5);
            if (taskResult.data && taskResult.data.length > 0) {
                var now = new Date();
                var overdueCount = 0;
                var todayCount = 0;
                var html = '';
                taskResult.data.forEach(function(task) {
                    var deadline = new Date(task.deadline);
                    var isOverdue = deadline < now;
                    if (isOverdue) overdueCount++; else todayCount++;
                    html += '<div class="urgent-task ' + (isOverdue ? 'overdue' : 'due-soon') + '">';
                    html += '<div class="task-priority-indicator"></div>';
                    html += '<div class="task-body">';
                    html += '<p class="task-shipment">' + (task.shipments ? 'AWB: ' + (task.shipments.awb_number || 'N/A') : 'No shipment') + '</p>';
                    html += '<p class="task-action">' + escapeHtml(task.name) + '</p>';
                    html += '<span class="task-deadline">' + formatDeadline(task.deadline) + '</span>';
                    html += '</div></div>';
                });
                document.getElementById('urgentTaskList').innerHTML = html;
                document.getElementById('countOverdue').textContent = overdueCount;
                document.getElementById('countToday').textContent = todayCount;
            } else {
                document.getElementById('urgentTaskList').innerHTML = '<p style="color:var(--text-tertiary);text-align:center;padding:20px;">No pending tasks</p>';
                document.getElementById('countOverdue').textContent = '0';
                document.getElementById('countToday').textContent = '0';
            }

            var activityResult = await db.from('shipments').select('*').order('updated_at', { ascending: false }).limit(6);
            if (activityResult.data && activityResult.data.length > 0) {
                var feedHtml = '';
                activityResult.data.forEach(function(s) {
                    var icon = s.status === 'arrived' ? 'arrived' : s.status === 'departed' ? 'departed' : 'created';
                    feedHtml += '<div class="feed-item"><div class="feed-icon ' + icon + '"></div><div class="feed-content"><p><strong>' + escapeHtml(s.awb_number || 'Draft') + '</strong> ' + formatStatus(s.status) + '</p><span class="feed-time">' + timeAgo(s.updated_at) + '</span></div></div>';
                });
                document.getElementById('activityFeed').innerHTML = feedHtml;
            }
        } catch(e) { console.error('Dashboard load error:', e); }
    }

    window.loadDashboardOverview = loadDashboardOverview;

    // ============ SHIPMENTS ============
    window.loadShipmentsPage = async function() {
        var filterStatus = document.getElementById('filterStatus');
        var filters = {};
        if (filterStatus && filterStatus.value) filters.status = filterStatus.value;

        var query = db.from('shipments').select('*');
        if (filters.status) query = query.eq('status', filters.status);
        var result = await query.order('created_at', { ascending: false });
        var shipments = result.data || [];

        var tbody = document.getElementById('shipmentTableBody');
        if (!shipments.length) {
            tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><p>No shipments found.</p></div></td></tr>';
            return;
        }

        var showProfit = isManager || isDirector;
        tbody.innerHTML = shipments.map(function(s) {
            var profit = (s.revenue || 0) - (s.cost || 0);
            var profitDisplay = showProfit ? '<td class="' + (profit >= 0 ? 'profit-positive' : 'profit-negative') + '">' + (profit ? '$' + profit.toFixed(2) : '—') + '</td>' : '';
            var deleteBtn = (isManager || isDirector) ? '<button class="row-action-btn delete-shipment-btn" data-id="' + s.id + '" title="Delete" style="margin-left:4px;color:var(--red);">✕</button>' : '';
            var editBtn = (isManager || isDirector) ? '<button class="row-action-btn edit-shipment-btn" data-id="' + s.id + '" title="Edit" style="margin-left:4px;">✎</button>' : '';
            
            return '<tr data-id="' + s.id + '">' +
                '<td><span class="awb-mono">' + escapeHtml(s.awb_number || 'Draft') + '</span></td>' +
                '<td>' + escapeHtml(s.customer_name) + '</td>' +
                '<td><div class="route-display"><span class="route-code">' + escapeHtml(s.origin) + '</span><span style="color:var(--text-tertiary);margin:0 6px;">→</span><span class="route-code">' + escapeHtml(s.destination) + '</span></div></td>' +
                '<td>' + escapeHtml(s.airline || '—') + '</td>' +
                '<td>' + (s.weight_kg ? s.weight_kg + ' kg' : '—') + '</td>' +
                '<td><span class="status-badge status-' + s.status + '">' + formatStatus(s.status) + '</span></td>' +
                profitDisplay +
                '<td><div class="row-actions">' +
                    '<button class="row-action-btn advance-status-btn" data-id="' + s.id + '" data-status="' + s.status + '" title="Advance">▶</button>' +
                    editBtn + deleteBtn +
                '</div></td>' +
                '</tr>';
        }).join('');

        bindShipmentRowActions();

        if (filterStatus && filterStatus.options.length <= 1) {
            ['draft','confirmed','booked','departed','arrived','delivered'].forEach(function(s) {
                var opt = document.createElement('option');
                opt.value = s;
                opt.textContent = formatStatus(s);
                filterStatus.appendChild(opt);
            });
            filterStatus.addEventListener('change', function() { window.loadShipmentsPage(); });
        }
    };

    function bindShipmentRowActions() {
        document.querySelectorAll('.advance-status-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var id = btn.dataset.id;
                var current = btn.dataset.status;
                var next = getNextStatus(current);
                if (!next) return;
                btn.disabled = true;
                await db.from('shipments').update({ status: next, updated_at: new Date().toISOString() }).eq('id', id);
                window.loadShipmentsPage();
                loadDashboardOverview();
            });
        });

        document.querySelectorAll('.edit-shipment-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var id = btn.dataset.id;
                var result = await db.from('shipments').select('*').eq('id', id).single();
                if (result.data && typeof ShipmentManager !== 'undefined') {
                    ShipmentManager.openShipmentForm(result.data);
                }
            });
        });

        document.querySelectorAll('.delete-shipment-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                if (!confirm('Delete this shipment? This cannot be undone.')) return;
                var id = btn.dataset.id;
                await db.from('shipments').delete().eq('id', id);
                window.loadShipmentsPage();
                loadDashboardOverview();
            });
        });
    }

    function loadShipments() { if (typeof window.loadShipmentsPage === 'function') window.loadShipmentsPage(); }

    // ============ TASKS ============
    async function loadTasks() {
        var result = await db.from('tasks').select('*, shipments(awb_number, customer_name)').order('deadline', { ascending: true });
        var container = document.getElementById('taskListContainer');
        if (!result.data || result.data.length === 0) {
            container.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;padding:40px;">No tasks assigned.</p>';
            return;
        }
        container.innerHTML = result.data.map(function(t) {
            return '<div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:16px;margin-bottom:10px;display:flex;align-items:center;gap:14px;">' +
                '<div style="flex:1;"><strong>' + escapeHtml(t.name) + '</strong><br><small style="color:var(--text-tertiary)">' + (t.shipments ? 'AWB: ' + t.shipments.awb_number : '') + ' | ' + formatDeadline(t.deadline) + '</small></div>' +
                '<span class="status-badge status-' + (t.status === 'completed' ? 'delivered' : 'confirmed') + '">' + t.status + '</span>' +
                (t.status !== 'completed' ? '<button class="task-do-btn complete-task" data-id="' + t.id + '">Done</button>' : '') +
                '</div>';
        }).join('');

        document.querySelectorAll('.complete-task').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                await db.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', btn.dataset.id);
                loadTasks();
                loadDashboardOverview();
            });
        });
    }

    // ============ RATES ============
    async function loadRates() {
        var result = await db.from('airline_rates').select('*').order('airline');
        var container = document.getElementById('ratesContainer');
        if (!result.data || result.data.length === 0) {
            container.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;padding:40px;">No rates configured.</p>';
            return;
        }
        container.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;">' +
            result.data.map(function(r) {
                return '<div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:16px;">' +
                    '<div style="display:flex;justify-content:space-between;align-items:start;">' +
                        '<div><strong>' + escapeHtml(r.airline) + '</strong><br>' +
                        escapeHtml(r.origin) + ' → ' + escapeHtml(r.destination) + '<br>' +
                        '<span style="color:var(--accent);font-size:1.2rem;font-weight:700;">$' + (r.rate_per_kg_usd || 0).toFixed(2) + '/kg</span>' +
                        (r.surcharges ? '<br><small style="color:var(--text-tertiary);">+$' + r.surcharges.toFixed(2) + ' surcharge</small>' : '') +
                        (r.valid_until ? '<br><small style="color:var(--text-tertiary);">Valid until ' + new Date(r.valid_until).toLocaleDateString() + '</small>' : '') + '</div>' +
                        ((isManager || isDirector) ? '<div style="display:flex;gap:4px;"><button class="row-action-btn edit-rate-btn" data-id="' + r.id + '" title="Edit">✎</button><button class="row-action-btn delete-rate-btn" data-id="' + r.id + '" title="Delete" style="color:var(--red);">✕</button></div>' : '') +
                    '</div></div>';
            }).join('') + '</div>';

        document.querySelectorAll('.edit-rate-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var id = btn.dataset.id;
                var result = await db.from('airline_rates').select('*').eq('id', id).single();
                if (result.data) openRateForm(result.data);
            });
        });

        document.querySelectorAll('.delete-rate-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                if (!confirm('Delete this rate?')) return;
                await db.from('airline_rates').delete().eq('id', btn.dataset.id);
                loadRates();
            });
        });
    }

    function openRateForm(rateData) {
        var existing = document.getElementById('rateFormModal');
        if (existing) existing.remove();

        var isEdit = rateData && rateData.id;

        var modal = document.createElement('div');
        modal.id = 'rateFormModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:1000;';

        modal.innerHTML = '<div style="background:var(--bg-card);border:1px solid var(--border-medium);border-radius:var(--radius-xl);padding:28px;width:90%;max-width:520px;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
                '<h3 style="font-size:1.1rem;font-weight:700;">' + (isEdit ? 'Edit Rate' : 'Add Rate') + '</h3>' +
                '<button id="closeRateModal" style="background:none;border:none;color:var(--text-tertiary);font-size:1.5rem;cursor:pointer;">&times;</button>' +
            '</div>' +
            '<form id="rateForm">' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Airline *</label><input type="text" id="rfAirline" value="' + escapeHtml(rateData ? rateData.airline || '' : '') + '" required placeholder="e.g. EK" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Cargo Type</label><select id="rfCargoType" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"><option value="general"' + (rateData && rateData.cargo_type === 'general' ? ' selected' : '') + '>General</option><option value="perishable"' + (rateData && rateData.cargo_type === 'perishable' ? ' selected' : '') + '>Perishable</option><option value="pharma"' + (rateData && rateData.cargo_type === 'pharma' ? ' selected' : '') + '>Pharma</option><option value="dangerous"' + (rateData && rateData.cargo_type === 'dangerous' ? ' selected' : '') + '>Dangerous</option><option value="valuable"' + (rateData && rateData.cargo_type === 'valuable' ? ' selected' : '') + '>Valuable</option></select></div>' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Origin *</label><input type="text" id="rfOrigin" value="' + escapeHtml(rateData ? rateData.origin || '' : '') + '" required placeholder="e.g. LHE" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Destination *</label><input type="text" id="rfDestination" value="' + escapeHtml(rateData ? rateData.destination || '' : '') + '" required placeholder="e.g. DXB" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Rate/kg (USD) *</label><input type="number" id="rfRate" value="' + (rateData ? rateData.rate_per_kg_usd || '' : '') + '" step="0.01" required style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Surcharges (USD)</label><input type="number" id="rfSurcharges" value="' + (rateData ? rateData.surcharges || '' : '') + '" step="0.01" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Valid Until</label><input type="date" id="rfValidUntil" value="' + (rateData && rateData.valid_until ? rateData.valid_until : '') + '" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                '</div>' +
                '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">' +
                    '<button type="button" id="cancelRateBtn" style="padding:10px 20px;background:transparent;border:1px solid var(--border-medium);color:var(--text-primary);border-radius:var(--radius);cursor:pointer;font-family:inherit;">Cancel</button>' +
                    '<button type="submit" style="padding:10px 20px;background:var(--accent);color:#1A2E4A;border:none;border-radius:var(--radius);cursor:pointer;font-weight:600;font-family:inherit;">' + (isEdit ? 'Update' : 'Add Rate') + '</button>' +
                '</div>' +
            '</form>' +
        '</div>';

        document.body.appendChild(modal);

        document.getElementById('closeRateModal').addEventListener('click', function() { modal.remove(); });
        document.getElementById('cancelRateBtn').addEventListener('click', function() { modal.remove(); });
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });

        document.getElementById('rateForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            var submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';

            var data = {
                airline: document.getElementById('rfAirline').value.trim(),
                origin: document.getElementById('rfOrigin').value.trim(),
                destination: document.getElementById('rfDestination').value.trim(),
                cargo_type: document.getElementById('rfCargoType').value,
                rate_per_kg_usd: parseFloat(document.getElementById('rfRate').value) || 0,
                surcharges: parseFloat(document.getElementById('rfSurcharges').value) || 0,
                valid_until: document.getElementById('rfValidUntil').value || null
            };

            try {
                if (isEdit) {
                    await db.from('airline_rates').update(data).eq('id', rateData.id);
                } else {
                    await db.from('airline_rates').insert(data);
                }
                modal.remove();
                loadRates();
            } catch(err) {
                alert('Error: ' + err.message);
                submitBtn.disabled = false;
                submitBtn.textContent = isEdit ? 'Update' : 'Add Rate';
            }
        });
    }

    // ============ FLIGHTS (Director Only) ============
    window.loadFlightsPage = async function() {
        if (!isDirector) return;
        var container = document.getElementById('flightsContainer');
        var result = await db.from('shipments').select('*').not('flight_number', 'is', null).order('updated_at', { ascending: false });

        if (!result.data || result.data.length === 0) {
            container.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;padding:40px;">No flights being tracked.</p>';
            return;
        }

        container.innerHTML = result.data.map(function(s) {
            return '<div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:20px;margin-bottom:12px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
                    '<div><strong style="font-size:1.1rem;">' + escapeHtml(s.flight_number) + '</strong><br><small style="color:var(--text-tertiary);">' + escapeHtml(s.airline || '') + ' | AWB: ' + escapeHtml(s.awb_number || '') + '</small></div>' +
                    '<span class="status-badge status-' + s.status + '">' + formatStatus(s.status) + '</span>' +
                '</div>' +
                '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                    '<span style="color:var(--text-secondary);">' + escapeHtml(s.origin) + ' → ' + escapeHtml(s.destination) + '</span>' +
                    '<button class="btn btn-amber btn-sm track-flight-btn" data-id="' + s.id + '" data-flight="' + escapeHtml(s.flight_number) + '">Track Now</button>' +
                '</div>' +
                '</div>';
        }).join('');

        document.querySelectorAll('.track-flight-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (typeof FlightTracker !== 'undefined') {
                    FlightTracker.trackFlight(btn.dataset.id, btn.dataset.flight);
                }
            });
        });
    };

    function loadFlights() { if (typeof window.loadFlightsPage === 'function') window.loadFlightsPage(); }

    // ============ TEAM (Manager+) ============
    async function loadTeam() {
        if (!isManager && !isDirector) {
            document.getElementById('teamContainer').innerHTML = '<p style="color:var(--text-tertiary);text-align:center;padding:40px;">Access restricted.</p>';
            return;
        }
        var result = await db.from('profiles').select('*');
        var container = document.getElementById('teamContainer');
        if (!result.data || result.data.length === 0) {
            container.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;padding:40px;">No team members.</p>';
            return;
        }
        container.innerHTML = result.data.map(function(p) {
            return '<div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:16px;margin-bottom:10px;display:flex;align-items:center;gap:14px;">' +
                '<div style="width:40px;height:40px;border-radius:50%;background:' + (p.is_admin || p.role === 'director' ? 'var(--accent)' : p.role === 'manager' ? 'var(--bg-tertiary)' : 'var(--bg-secondary)') + ';display:flex;align-items:center;justify-content:center;font-weight:700;color:' + (p.is_admin || p.role === 'director' ? '#1A2E4A' : 'var(--text-primary)') + ';">' + (p.full_name || '?').charAt(0).toUpperCase() + '</div>' +
                '<div style="flex:1;"><strong>' + escapeHtml(p.full_name) + '</strong><br><small style="color:var(--text-tertiary);">' + p.role + '</small></div>' +
                '</div>';
        }).join('');
    }

    // ============ HELPERS ============
    function getNextStatus(current) {
        var flow = ['draft', 'confirmed', 'booked', 'departed', 'arrived', 'delivered'];
        var idx = flow.indexOf(current);
        return idx < flow.length - 1 ? flow[idx + 1] : null;
    }

    function formatStatus(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

    function formatDeadline(d) {
        var deadline = new Date(d), now = new Date(), diff = deadline - now;
        if (diff < 0) return 'Overdue';
        var hours = Math.floor(diff / 3600000);
        if (hours < 24) return hours + 'h remaining';
        return Math.floor(hours / 24) + 'd remaining';
    }

    function timeAgo(dateStr) {
        var diff = (new Date() - new Date(dateStr)) / 1000;
        if (diff < 60) return 'Just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return Math.floor(diff / 86400) + 'd ago';
    }

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============ EVENT HANDLERS ============
    document.addEventListener('click', function(e) {
        if (e.target.id === 'btnNewShipment' || e.target.closest('#btnNewShipment')) {
            if (typeof ShipmentManager !== 'undefined') ShipmentManager.openShipmentForm();
        }
        if ((e.target.id === 'btnDelegateTask' || e.target.closest('#btnDelegateTask')) && isDirector) {
            if (typeof TaskManager !== 'undefined') TaskManager.openDelegateModal();
        }
        if (e.target.id === 'btnAddRate' || e.target.closest('#btnAddRate')) {
            if (isManager || isDirector) openRateForm(null);
        }
    });

})();
