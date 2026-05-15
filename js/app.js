// ============================================
// eCargoWorld — Dashboard Controller
// ============================================

(function() {
    'use strict';

    var db = window.supabase;
    var currentUser = null;
    var currentScreen = 'dashboard';
    var isManager = false;

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

        isManager = currentUser.profile && (currentUser.profile.role === 'manager' || currentUser.profile.is_admin);

        updateUserUI();
        setupNavigation();
        setupLogout();
        setupAdminButton();
        loadLogos();
        setupManagerFeatures();

        if (typeof FlightTracker !== 'undefined') {
            FlightTracker.setManager(isManager);
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

    function setupManagerFeatures() {
        if (isManager) {
            document.getElementById('roleBadge').textContent = 'MANAGER';
            document.querySelectorAll('.manager-only').forEach(function(el) { el.style.display = 'flex'; });
            document.querySelectorAll('.manager-only-col').forEach(function(el) { el.style.display = 'table-cell'; });
        } else {
            document.getElementById('roleBadge').textContent = 'EMPLOYEE';
        }
    }

    function setupAdminButton() {
        var btn = document.getElementById('btnAdmin');
        if (btn && isManager) {
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
        if (screenName === 'flights') loadFlightsPage();
        if (screenName === 'team') loadTeam();
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

        var result = await db.from('shipments').select('*').order('created_at', { ascending: false });
        if (filters.status) {
            result = await db.from('shipments').select('*').eq('status', filters.status).order('created_at', { ascending: false });
        }
        var shipments = result.data || [];

        var tbody = document.getElementById('shipmentTableBody');
        if (!shipments.length) {
            tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><p>No shipments found.</p></div></td></tr>';
            return;
        }

        var cols = isManager ? 8 : 7;
        tbody.innerHTML = shipments.map(function(s) {
            var profit = (s.revenue || 0) - (s.cost || 0);
            var profitDisplay = isManager ? '<td class="' + (profit >= 0 ? 'profit-positive' : 'profit-negative') + '">' + (profit ? '$' + profit.toFixed(2) : '—') + '</td>' : '';
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
                    '<button class="row-action-btn edit-shipment-btn" data-id="' + s.id + '" title="Edit" style="margin-left:4px;">✎</button>' +
                    (isManager ? '<button class="row-action-btn delete-shipment-btn" data-id="' + s.id + '" title="Delete" style="margin-left:4px;color:var(--red);">✕</button>' : '') +
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
        container.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">' +
            result.data.map(function(r) {
                return '<div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:16px;">' +
                    '<strong>' + escapeHtml(r.airline) + '</strong><br>' +
                    escapeHtml(r.origin) + ' → ' + escapeHtml(r.destination) + '<br>' +
                    '<span style="color:var(--accent);font-size:1.2rem;font-weight:700;">$' + (r.rate_per_kg_usd || 0).toFixed(2) + '/kg</span>' +
                    '</div>';
            }).join('') + '</div>';
    }

    // ============ FLIGHTS (Manager Only) ============
    window.loadFlightsPage = async function() {
        if (!isManager) return;
        var container = document.getElementById('flightsContainer');
        var result = await db.from('shipments').select('*').not('flight_number', 'is', null).order('updated_at', { ascending: false });

        if (!result.data || result.data.length === 0) {
            container.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;padding:40px;">No flights being tracked. Add flight numbers to shipments.</p>';
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

    // ============ TEAM ============
    async function loadTeam() {
        if (!isManager) {
            document.getElementById('teamContainer').innerHTML = '<p style="color:var(--text-tertiary);text-align:center;padding:40px;">Access restricted to managers.</p>';
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
                '<div style="width:40px;height:40px;border-radius:50%;background:' + (p.is_admin ? 'var(--accent)' : 'var(--bg-tertiary)') + ';display:flex;align-items:center;justify-content:center;font-weight:700;color:' + (p.is_admin ? '#1A2E4A' : 'var(--text-primary)') + ';">' + (p.full_name || '?').charAt(0).toUpperCase() + '</div>' +
                '<div style="flex:1;"><strong>' + escapeHtml(p.full_name) + '</strong><br><small style="color:var(--text-tertiary);">' + p.role + (p.is_admin ? ' • Admin' : '') + '</small></div>' +
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
        if (e.target.id === 'btnDelegateTask' || e.target.closest('#btnDelegateTask')) {
            if (typeof TaskManager !== 'undefined') TaskManager.openDelegateModal();
        }
        if (e.target.id === 'btnAddRate' || e.target.closest('#btnAddRate')) {
            alert('Rate management form coming soon.');
        }
    });

})();
