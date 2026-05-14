// ============================================
// eCargoWorld — Dashboard Controller
// ============================================

(function() {
    'use strict';

    var db = window.supabase;
    var currentUser = null;
    var currentScreen = 'dashboard';

    // Init
    document.addEventListener('DOMContentLoaded', function() {
        initApp();
    });

    async function initApp() {
        // Check auth
        var userResult = await db.auth.getUser();
        if (!userResult.data || !userResult.data.user) {
            window.location.href = 'login.html';
            return;
        }

        currentUser = userResult.data.user;

        // Get profile
        var profileResult = await db.from('profiles').select('*').eq('id', currentUser.id).single();
        if (profileResult.data) {
            currentUser.profile = profileResult.data;
        }

        // Update UI
        updateUserUI();
        setupNavigation();
        setupLogout();
        loadLogos();

        // Show/hide manager features
        var isManager = currentUser.profile && (currentUser.profile.role === 'manager' || currentUser.profile.is_admin);
        if (isManager) {
            document.querySelectorAll('.manager-only').forEach(function(el) { el.style.display = 'flex'; });
            document.getElementById('roleBadge').textContent = 'MANAGER';
        } else {
            document.getElementById('roleBadge').textContent = 'EMPLOYEE';
        }

        // Load overview
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

        // Load screen data
        if (screenName === 'dashboard') loadDashboardOverview();
        if (screenName === 'shipments') loadShipments();
        if (screenName === 'tasks') loadTasks();
        if (screenName === 'rates') loadRates();
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
                var als = document.getElementById('dashLogoAls');
                if (ecw && result.data.logo_ecw_url) ecw.src = result.data.logo_ecw_url;
                if (als && result.data.logo_als_url) als.src = result.data.logo_als_url;
            }
        } catch(e) {}
    }

    // ============ DASHBOARD OVERVIEW ============
    async function loadDashboardOverview() {
        try {
            // Get shipment counts by status
            var result = await db.from('shipments').select('status');
            if (result.data) {
                var counts = {};
                result.data.forEach(function(s) {
                    counts[s.status] = (counts[s.status] || 0) + 1;
                });

                document.getElementById('countActive').textContent = (counts.confirmed || 0) + (counts.booked || 0) + (counts.departed || 0);
                document.getElementById('countDelivered').textContent = counts.delivered || 0;
                document.getElementById('tlConfirmed').textContent = counts.confirmed || 0;
                document.getElementById('tlBooked').textContent = counts.booked || 0;
                document.getElementById('tlDeparted').textContent = counts.departed || 0;
                document.getElementById('tlArrived').textContent = counts.arrived || 0;
            }

            // Get urgent tasks
            var taskResult = await db.from('tasks').select('*, shipments(awb_number, customer_name)').eq('status', 'pending').order('deadline', { ascending: true }).limit(5);
            if (taskResult.data && taskResult.data.length > 0) {
                var now = new Date();
                var overdueCount = 0;
                var todayCount = 0;
                var html = '';

                taskResult.data.forEach(function(task) {
                    var deadline = new Date(task.deadline);
                    var isOverdue = deadline < now;
                    if (isOverdue) overdueCount++;
                    else todayCount++;

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

            // Recent activity
            var activityResult = await db.from('shipments').select('*').order('updated_at', { ascending: false }).limit(6);
            if (activityResult.data && activityResult.data.length > 0) {
                var feedHtml = '';
                activityResult.data.forEach(function(s) {
                    var icon = s.status === 'arrived' ? 'arrived' : s.status === 'departed' ? 'departed' : 'created';
                    feedHtml += '<div class="feed-item">';
                    feedHtml += '<div class="feed-icon ' + icon + '"></div>';
                    feedHtml += '<div class="feed-content"><p><strong>' + escapeHtml(s.awb_number || 'Draft') + '</strong> ' + formatStatus(s.status) + '</p>';
                    feedHtml += '<span class="feed-time">' + timeAgo(s.updated_at) + '</span></div>';
                    feedHtml += '</div>';
                });
                document.getElementById('activityFeed').innerHTML = feedHtml;
            }
        } catch(e) {
            console.error('Dashboard load error:', e);
        }
    }

    // ============ SHIPMENTS ============
    async function loadShipments() {
        var result = await db.from('shipments').select('*').order('created_at', { ascending: false });
        var tbody = document.getElementById('shipmentTableBody');
        if (!result.data || result.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><p>No shipments yet.</p><button class="btn btn-amber" id="btnNewShipmentEmpty">+ Create First Shipment</button></div></td></tr>';
            document.getElementById('btnNewShipmentEmpty')?.addEventListener('click', function() { alert('Shipment form coming in Batch 3'); });
            return;
        }

        tbody.innerHTML = result.data.map(function(s) {
            return '<tr>' +
                '<td><span class="awb-mono">' + escapeHtml(s.awb_number || 'Draft') + '</span></td>' +
                '<td>' + escapeHtml(s.customer_name) + '</td>' +
                '<td><div class="route-display"><span class="route-code">' + escapeHtml(s.origin) + '</span><span style="color:var(--text-tertiary)">→</span><span class="route-code">' + escapeHtml(s.destination) + '</span></div></td>' +
                '<td>' + escapeHtml(s.airline || '—') + '</td>' +
                '<td>' + (s.weight_kg ? s.weight_kg + ' kg' : '—') + '</td>' +
                '<td><span class="status-badge status-' + s.status + '">' + formatStatus(s.status) + '</span></td>' +
                '<td><div class="row-actions"><button class="row-action-btn advance-status" data-id="' + s.id + '" data-status="' + s.status + '">▶</button></div></td>' +
                '</tr>';
        }).join('');

        // Bind status advance buttons
        document.querySelectorAll('.advance-status').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var id = btn.dataset.id;
                var current = btn.dataset.status;
                var next = getNextStatus(current);
                if (!next) return;
                await db.from('shipments').update({ status: next, updated_at: new Date().toISOString() }).eq('id', id);
                loadShipments();
                loadDashboardOverview();
            });
        });
    }

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
            }).join('') +
            '</div>';
    }

    // ============ TEAM ============
    async function loadTeam() {
        var result = await db.from('profiles').select('*');
        var container = document.getElementById('teamContainer');
        if (!result.data || result.data.length === 0) {
            container.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;padding:40px;">No team members.</p>';
            return;
        }
        container.innerHTML = result.data.map(function(p) {
            return '<div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:16px;margin-bottom:10px;display:flex;align-items:center;gap:14px;">' +
                '<div style="width:40px;height:40px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700;color:#1A2E4A;">' + (p.full_name || '?').charAt(0) + '</div>' +
                '<div style="flex:1;"><strong>' + escapeHtml(p.full_name) + '</strong><br><small style="color:var(--text-tertiary)">' + p.role + '</small></div>' +
                '</div>';
        }).join('');
    }

    // ============ HELPERS ============
    function getNextStatus(current) {
        var flow = ['draft', 'confirmed', 'booked', 'departed', 'arrived', 'delivered'];
        var idx = flow.indexOf(current);
        return idx < flow.length - 1 ? flow[idx + 1] : null;
    }

    function formatStatus(s) {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    function formatDeadline(d) {
        var deadline = new Date(d);
        var now = new Date();
        var diff = deadline - now;
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

    // New shipment button
    document.addEventListener('click', function(e) {
        if (e.target.id === 'btnNewShipment' || e.target.closest('#btnNewShipment')) {
            alert('Shipment creation form coming in Batch 3');
        }
    });

})();
