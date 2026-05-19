// ============================================
// eCargoWorld — Dashboard Controller
// ============================================

(function() {
    'use strict';

    var db = window.supabase;
    var currentUser = null;
    var currentScreen = 'dashboard';
    var isManager = false;
    var isOpsManager = false;
    var isDirector = false;
    var canAssignTasks = false;
    var canAccessAdmin = false;
    var lastTaskCheck = new Date().toISOString();
    var notificationSound = null;

    document.addEventListener('DOMContentLoaded', function() {
        initSound();
        initApp();
    });

    function initSound() {
        try {
            var AudioContext = window.AudioContext || window.webkitAudioContext;
            var ctx = new AudioContext();
            notificationSound = function() {
                var osc = ctx.createOscillator();
                var gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = 800;
                gain.gain.value = 0.1;
                osc.start();
                setTimeout(function() { osc.frequency.value = 1000; }, 100);
                setTimeout(function() { osc.stop(); }, 300);
            };
        } catch(e) {}
    }

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

        var role = currentUser.profile ? currentUser.profile.role : 'employee';
        isDirector = (role === 'director' || (currentUser.profile && currentUser.profile.is_admin));
        isOpsManager = (role === 'operations_manager');
        isManager = (role === 'manager' || isDirector || isOpsManager);
        canAssignTasks = (isDirector || isOpsManager);
        canAccessAdmin = (role === 'manager' || isDirector);

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
        startTaskPolling();
    }

    function updateUserUI() {
        var name = 'User', initial = 'U';
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
        var badge = document.getElementById('roleBadge');
        if (isDirector) {
            badge.textContent = 'DIRECTOR';
            document.querySelectorAll('.manager-only').forEach(function(el) { el.style.display = 'flex'; });
            document.querySelectorAll('.director-only').forEach(function(el) { el.style.display = 'flex'; });
            document.querySelectorAll('.manager-only-col').forEach(function(el) { el.style.display = 'table-cell'; });
        } else if (isOpsManager) {
            badge.textContent = 'OPS MANAGER';
            document.querySelectorAll('.director-only').forEach(function(el) { el.style.display = 'flex'; });
            document.querySelectorAll('.manager-only-col').forEach(function(el) { el.style.display = 'table-cell'; });
        } else if (isManager) {
            badge.textContent = 'MANAGER';
            document.querySelectorAll('.manager-only').forEach(function(el) { el.style.display = 'flex'; });
            document.querySelectorAll('.manager-only-col').forEach(function(el) { el.style.display = 'table-cell'; });
        } else {
            badge.textContent = 'EMPLOYEE';
        }
    }

    function setupAdminButton() {
        var btn = document.getElementById('btnAdmin');
        if (btn && canAccessAdmin) btn.style.display = 'inline-flex';
    }

    function setupNavigation() {
        document.querySelectorAll('.cmd-nav-item').forEach(function(item) {
            item.addEventListener('click', function() {
                switchScreen(item.dataset.screen);
            });
        });
    }

    function switchScreen(screenName) {
        document.querySelectorAll('.cmd-nav-item').forEach(function(item) {
            item.classList.toggle('active', item.dataset.screen === screenName);
        });
        document.querySelectorAll('.screen').forEach(function(s) {
            s.classList.toggle('active', s.id === 'screen' + screenName.charAt(0).toUpperCase() + screenName.slice(1));
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
            var r = await db.from('settings').select('logo_ecw_url').single();
            if (r.data && r.data.logo_ecw_url) {
                var ecw = document.getElementById('dashLogoEcw');
                if (ecw) ecw.src = r.data.logo_ecw_url;
            }
        } catch(e) {}
    }

    // ============ TASK POLLING ============
    function startTaskPolling() {
        setInterval(async function() {
            if (!currentUser) return;
            var r = await db.from('tasks').select('*').eq('assigned_to', currentUser.id).eq('status', 'pending').gt('created_at', lastTaskCheck);
            if (r.data && r.data.length > 0) {
                var task = r.data[0];
                showNotification(task);
                lastTaskCheck = new Date().toISOString();
                updateTaskBadge();
            }
        }, 30000);
    }

    async function updateTaskBadge() {
        if (!currentUser) return;
        var r = await db.from('tasks').select('id', { count: 'exact' }).eq('assigned_to', currentUser.id).eq('status', 'pending').gt('created_at', lastTaskCheck);
        var badge = document.getElementById('taskBadge');
        if (badge && r.count > 0) {
            badge.textContent = r.count;
            badge.style.display = 'flex';
        } else if (badge) {
            badge.style.display = 'none';
        }
    }

    function showNotification(task) {
        document.getElementById('notifTaskName').textContent = task.name;
        document.getElementById('notifTaskDeadline').textContent = 'Deadline: ' + new Date(task.deadline).toLocaleString();
        document.getElementById('notificationPopup').style.display = 'block';
        if (notificationSound) notificationSound();
        setTimeout(function() {
            document.getElementById('notificationPopup').style.display = 'none';
        }, 8000);
    }

    // ============ DASHBOARD OVERVIEW ============
    async function loadDashboardOverview() {
        try {
            var r = await db.from('shipments').select('status');
            if (r.data) {
                var counts = {};
                r.data.forEach(function(s) { counts[s.status] = (counts[s.status] || 0) + 1; });
                document.getElementById('countActive').textContent = (counts.confirmed || 0) + (counts.booked || 0) + (counts.departed || 0) + (counts.in_transit || 0);
                document.getElementById('countDelivered').textContent = counts.delivered || 0;
                document.getElementById('tlConfirmed').textContent = (counts.confirmed || 0) + (counts.booked || 0);
                document.getElementById('tlInTransit').textContent = (counts.departed || 0) + (counts.in_transit || 0);
                document.getElementById('tlArrived').textContent = counts.arrived || 0;
            }

            var taskQuery = db.from('tasks').select('*, shipments(awb_number, customer_name)').eq('status', 'pending').order('deadline', { ascending: true });
            if (!isDirector && !isManager && !isOpsManager) {
                taskQuery = taskQuery.eq('assigned_to', currentUser.id);
            }
            var taskResult = await taskQuery.limit(10);
            
            var taskContainer = document.getElementById('overviewTaskList');
            if (taskResult.data && taskResult.data.length > 0) {
                var now = new Date();
                var overdueCount = 0, todayCount = 0;
                var html = '';
                taskResult.data.forEach(function(task) {
                    var deadline = new Date(task.deadline);
                    var isOverdue = deadline < now;
                    if (isOverdue) overdueCount++; else todayCount++;
                    html += '<div onclick="openTaskDetail(\'' + task.id + '\')" style="background:var(--bg-elevated);border-left:3px solid ' + (isOverdue ? 'var(--red)' : 'var(--orange)') + ';padding:14px;border-radius:var(--radius);margin-bottom:8px;cursor:pointer;">' +
                        '<div style="display:flex;justify-content:space-between;align-items:start;">' +
                            '<div><strong>' + escapeHtml(task.name) + '</strong>' +
                            (task.shipments ? '<br><small style="color:var(--text-tertiary);">AWB: ' + task.shipments.awb_number + '</small>' : '') +
                            '<br><small style="color:' + (isOverdue ? 'var(--red)' : 'var(--text-tertiary)') + ';">' + formatDeadline(task.deadline) + '</small></div>' +
                            '<span class="status-badge status-' + (task.priority === 'critical' ? 'draft' : 'confirmed') + '" style="font-size:0.7rem;">' + task.priority + '</span>' +
                        '</div></div>';
                });
                taskContainer.innerHTML = html;
                document.getElementById('countOverdue').textContent = overdueCount;
                document.getElementById('countToday').textContent = todayCount;
                document.getElementById('taskCountBadge').textContent = taskResult.data.length + ' pending';
            } else {
                taskContainer.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;padding:20px;">No pending tasks</p>';
                document.getElementById('countOverdue').textContent = '0';
                document.getElementById('countToday').textContent = '0';
            }

            var ar = await db.from('shipments').select('*').order('updated_at', { ascending: false }).limit(4);
            if (ar.data) {
                var feed = '';
                ar.data.forEach(function(s) {
                    feed += '<div class="feed-item"><div class="feed-icon ' + (s.status === 'arrived' ? 'arrived' : s.status === 'departed' || s.status === 'in_transit' ? 'departed' : 'created') + '"></div><div class="feed-content"><p><strong>' + escapeHtml(s.awb_number || 'Draft') + '</strong> ' + formatStatus(s.status) + '</p><span class="feed-time">' + timeAgo(s.updated_at) + '</span></div></div>';
                });
                document.getElementById('activityFeed').innerHTML = feed;
            }
        } catch(e) { console.error('Dashboard error:', e); }
    }

    window.loadDashboardOverview = loadDashboardOverview;

    // ============ SHIPMENTS ============
    window.loadShipmentsPage = async function() {
        var filterStatus = document.getElementById('filterStatus');
        var query = db.from('shipments').select('*');
        if (filterStatus && filterStatus.value) query = query.eq('status', filterStatus.value);
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
            var profitCol = showProfit ? '<td class="' + (profit >= 0 ? 'profit-positive' : 'profit-negative') + '">' + (profit ? '$' + profit.toFixed(2) : '—') + '</td>' : '';
            return '<tr>' +
                '<td><span class="awb-mono">' + escapeHtml(s.awb_number || 'Draft') + '</span></td>' +
                '<td>' + escapeHtml(s.customer_name) + '</td>' +
                '<td>' + escapeHtml(s.origin) + ' → ' + escapeHtml(s.destination) + '</td>' +
                '<td>' + escapeHtml(s.airline || '—') + '</td>' +
                '<td>' + (s.weight_kg ? s.weight_kg + ' kg' : '—') + '</td>' +
                '<td><span class="status-badge status-' + s.status + '" onclick="showStatusPopup(\'' + s.id + '\',\'' + s.status + '\')" style="cursor:pointer;">' + formatStatus(s.status) + ' ▼</span></td>' +
                profitCol +
                '<td><div class="row-actions">' +
                    '<button class="row-action-btn edit-shipment-btn" data-id="' + s.id + '">✎</button>' +
                    ((isManager || isDirector || isOpsManager) ? '<button class="row-action-btn delete-shipment-btn" data-id="' + s.id + '" style="color:var(--red);">✕</button>' : '') +
                '</div></td></tr>';
        }).join('');

        bindShipmentActions();
        populateFilterDropdown(filterStatus);
    };

    function bindShipmentActions() {
        document.querySelectorAll('.edit-shipment-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var r = await db.from('shipments').select('*').eq('id', btn.dataset.id).single();
                if (r.data && typeof ShipmentManager !== 'undefined') ShipmentManager.openShipmentForm(r.data);
            });
        });
        document.querySelectorAll('.delete-shipment-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                if (!confirm('Delete this shipment?')) return;
                await db.from('shipments').delete().eq('id', btn.dataset.id);
                window.loadShipmentsPage();
                loadDashboardOverview();
            });
        });
    }

    // ============ STATUS POPUP ============
    window.showStatusPopup = function(shipmentId, currentStatus) {
        var statuses = ['draft', 'confirmed', 'booked', 'departed', 'in_transit', 'arrived', 'delivered'];
        var html = '';
        statuses.forEach(function(s) {
            var isCurrent = s === currentStatus;
            html += '<button onclick="changeShipmentStatus(\'' + shipmentId + '\',\'' + s + '\')" style="padding:12px;border-radius:var(--radius);cursor:pointer;border:2px solid ' + (isCurrent ? 'var(--accent)' : 'var(--border-medium)') + ';background:' + (isCurrent ? 'var(--accent-dim)' : 'var(--bg-elevated)') + ';color:var(--text-primary);font-family:inherit;text-align:left;margin-bottom:4px;">' + (isCurrent ? '● ' : '') + formatStatus(s) + '</button>';
        });
        document.getElementById('statusPopupOptions').innerHTML = html;
        document.getElementById('statusPopupTitle').textContent = 'Change Status';
        document.getElementById('statusPopup').style.display = 'flex';
    };

    window.changeShipmentStatus = async function(id, newStatus) {
        await db.from('shipments').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
        document.getElementById('statusPopup').style.display = 'none';
        window.loadShipmentsPage();
        loadDashboardOverview();
    };

    // ============ TASKS ============
    async function loadTasks() {
        var query = db.from('tasks').select('*, shipments(awb_number, customer_name)').order('deadline', { ascending: true });
        if (!isDirector && !isManager && !isOpsManager) query = query.eq('assigned_to', currentUser.id);
        var r = await query;
        var c = document.getElementById('taskListContainer');
        if (!r.data || !r.data.length) {
            c.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;padding:40px;">No tasks.</p>';
            return;
        }
        c.innerHTML = r.data.map(function(t) {
            var isOverdue = t.status === 'pending' && new Date(t.deadline) < new Date();
            return '<div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:14px;margin-bottom:8px;cursor:pointer;" onclick="openTaskDetail(\'' + t.id + '\')">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                    '<div><strong>' + escapeHtml(t.name) + '</strong>' + (t.shipments ? '<br><small style="color:var(--text-tertiary);">AWB: ' + t.shipments.awb_number + '</small>' : '') + '<br><small style="color:' + (isOverdue ? 'var(--red)' : 'var(--text-tertiary)') + ';">' + formatDeadline(t.deadline) + '</small></div>' +
                    '<div style="display:flex;gap:8px;align-items:center;">' +
                        '<span class="status-badge status-' + (t.status === 'completed' ? 'delivered' : 'confirmed') + '">' + t.status + '</span>' +
                        (t.status !== 'completed' ? '<button class="task-do-btn complete-task-btn" data-id="' + t.id + '" onclick="event.stopPropagation();completeTask(\'' + t.id + '\')">Done</button>' : '') +
                        '<button class="row-action-btn delete-task-btn" data-id="' + t.id + '" onclick="event.stopPropagation();deleteTask(\'' + t.id + '\')" style="color:var(--red);" title="Delete">✕</button>' +
                    '</div>' +
                '</div></div>';
        }).join('');
    }

    window.openTaskDetail = async function(taskId) {
        var r = await db.from('tasks').select('*, shipments(awb_number, customer_name, origin, destination)').eq('id', taskId).single();
        if (!r.data) return;
        var t = r.data;
        document.getElementById('taskDetailTitle').textContent = t.name;
        document.getElementById('taskDetailContent').innerHTML = 
            '<p><strong>Status:</strong> ' + t.status + '</p>' +
            '<p><strong>Priority:</strong> ' + t.priority + '</p>' +
            '<p><strong>Deadline:</strong> ' + new Date(t.deadline).toLocaleString() + '</p>' +
            (t.shipments ? '<p><strong>Shipment:</strong> ' + t.shipments.awb_number + ' — ' + t.shipments.origin + ' → ' + t.shipments.destination + ' (' + t.shipments.customer_name + ')</p>' : '<p>No linked shipment</p>') +
            '<p><strong>Created:</strong> ' + new Date(t.created_at).toLocaleString() + '</p>';
        
        if (t.proof_url) {
            document.getElementById('taskProofSection').innerHTML = '<p><strong>Completion Proof:</strong></p><img src="' + t.proof_url + '" style="max-width:100%;border-radius:var(--radius);margin-top:8px;">';
        } else {
            document.getElementById('taskProofSection').innerHTML = '';
        }
        
        document.getElementById('taskDetailCompleteBtn').style.display = t.status === 'completed' ? 'none' : 'inline-flex';
        document.getElementById('taskDetailCompleteBtn').onclick = function() { completeTaskWithProof(taskId); };
        document.getElementById('taskDetailPopup').style.display = 'flex';
    };

    window.completeTaskWithProof = function(taskId) {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async function() {
            var file = input.files[0];
            if (file) {
                var fp = 'task_proof_' + taskId + '_' + Date.now() + '.' + file.name.split('.').pop();
                var up = await db.storage.from('assets').upload(fp, file, { cacheControl: '0', upsert: true });
                if (!up.error) {
                    var url = db.storage.from('assets').getPublicUrl(fp).data.publicUrl;
                    await db.from('tasks').update({ status: 'completed', proof_url: url, completed_at: new Date().toISOString() }).eq('id', taskId);
                }
            } else {
                await db.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', taskId);
            }
            document.getElementById('taskDetailPopup').style.display = 'none';
            loadTasks();
            loadDashboardOverview();
        };
        input.click();
    };

    window.completeTask = async function(taskId) {
        await db.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', taskId);
        loadTasks();
        loadDashboardOverview();
    };

    window.deleteTask = async function(taskId) {
        if (!confirm('Delete this task?')) return;
        try {
            await db.from('tasks').delete().eq('id', taskId);
            loadTasks();
            loadDashboardOverview();
        } catch(e) {
            console.error('Delete failed:', e);
        }
    };

    // ============ RATES ============
    async function loadRates() {
        var r = await db.from('airline_rates').select('*').order('airline');
        var c = document.getElementById('ratesContainer');
        if (!r.data || !r.data.length) {
            c.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;padding:40px;">No rates configured.</p>';
            return;
        }
        c.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">' +
            r.data.map(function(rt) {
                return '<div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:16px;display:flex;justify-content:space-between;align-items:start;">' +
                    '<div><strong>' + escapeHtml(rt.airline) + '</strong><br>' + escapeHtml(rt.origin) + ' → ' + escapeHtml(rt.destination) + '<br><span style="color:var(--accent);font-size:1.2rem;font-weight:700;">$' + (rt.rate_per_kg_usd || 0).toFixed(2) + '/kg</span></div>' +
                    '<div style="display:flex;gap:4px;"><button class="row-action-btn edit-rate-btn" data-id="' + rt.id + '">✎</button><button class="row-action-btn delete-rate-btn" data-id="' + rt.id + '" style="color:var(--red);">✕</button></div>' +
                    '</div>';
            }).join('') + '</div>';

        document.querySelectorAll('.edit-rate-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var rr = await db.from('airline_rates').select('*').eq('id', btn.dataset.id).single();
                if (rr.data) openRateForm(rr.data);
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
        
        modal.innerHTML = '<div style="background:var(--bg-card);border:1px solid var(--border-medium);border-radius:var(--radius-xl);padding:28px;width:90%;max-width:520px;box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
                '<h3 style="font-size:1.1rem;font-weight:700;">' + (isEdit ? 'Edit Rate' : 'Add Rate') + '</h3>' +
                '<button onclick="document.getElementById(\'rateFormModal\').remove()" style="background:none;border:none;color:var(--text-tertiary);font-size:1.5rem;cursor:pointer;">&times;</button>' +
            '</div>' +
            '<form id="rateForm" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
                '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Airline</label><input type="text" id="rfAirline" value="' + escapeHtml(rateData?rateData.airline||'':'') + '" required style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Cargo Type</label><select id="rfCargoType" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"><option>general</option><option>perishable</option><option>pharma</option><option>dangerous</option><option>valuable</option></select></div>' +
                '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Origin</label><input type="text" id="rfOrigin" value="' + escapeHtml(rateData?rateData.origin||'':'') + '" required style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Destination</label><input type="text" id="rfDestination" value="' + escapeHtml(rateData?rateData.destination||'':'') + '" required style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Rate/kg (USD)</label><input type="number" id="rfRate" value="' + (rateData?rateData.rate_per_kg_usd||'':'') + '" step="0.01" required style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Surcharges</label><input type="number" id="rfSurcharges" value="' + (rateData?rateData.surcharges||'':'') + '" step="0.01" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                '<div style="grid-column:1/-1;display:flex;gap:10px;justify-content:flex-end;margin-top:8px;">' +
                    '<button type="button" onclick="document.getElementById(\'rateFormModal\').remove()" style="padding:10px 20px;background:transparent;border:1px solid var(--border-medium);color:var(--text-primary);border-radius:var(--radius);cursor:pointer;font-family:inherit;">Cancel</button>' +
                    '<button type="submit" style="padding:10px 20px;background:var(--accent);color:#1A2E4A;border:none;border-radius:var(--radius);cursor:pointer;font-weight:600;font-family:inherit;">' + (isEdit?'Update':'Add Rate') + '</button>' +
                '</div>' +
            '</form></div>';
        
        document.body.appendChild(modal);
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
                surcharges: parseFloat(document.getElementById('rfSurcharges').value) || 0
            };
            try {
                if (isEdit) await db.from('airline_rates').update(data).eq('id', rateData.id);
                else await db.from('airline_rates').insert(data);
                modal.remove();
                loadRates();
            } catch(err) {
                alert('Error: ' + err.message);
                submitBtn.disabled = false;
                submitBtn.textContent = isEdit ? 'Update' : 'Add Rate';
            }
        });
    }

    // ============ FLIGHTS ============
    window.loadFlightsPage = function() {
        document.getElementById('flightSearchResult').innerHTML = '';
        var container = document.getElementById('flightsContainer');
        db.from('shipments').select('*').not('flight_number', 'is', null).order('updated_at', { ascending: false }).then(function(r) {
            if (!r.data || !r.data.length) {
                container.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;padding:40px;">No flights being tracked.</p>';
                return;
            }
            container.innerHTML = r.data.map(function(s) {
                return '<div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:16px;margin-bottom:8px;">' +
                    '<div style="display:flex;justify-content:space-between;"><strong>' + escapeHtml(s.flight_number) + '</strong><span class="status-badge status-' + s.status + '">' + formatStatus(s.status) + '</span></div>' +
                    '<small>' + escapeHtml(s.airline||'') + ' | ' + escapeHtml(s.origin) + ' → ' + escapeHtml(s.destination) + ' | AWB: ' + escapeHtml(s.awb_number||'') + '</small>' +
                    (isDirector ? '<br><button class="btn btn-amber btn-sm track-flight-btn" data-id="' + s.id + '" data-flight="' + escapeHtml(s.flight_number) + '" style="margin-top:8px;">Track Now</button>' : '') +
                    '</div>';
            }).join('');
            document.querySelectorAll('.track-flight-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    if (typeof FlightTracker !== 'undefined') FlightTracker.trackFlight(btn.dataset.id, btn.dataset.flight);
                });
            });
        });
    };

    document.getElementById('btnFlightSearch')?.addEventListener('click', async function() {
        var fn = document.getElementById('flightSearchInput').value.trim();
        if (!fn) return;
        if (typeof FlightTracker !== 'undefined' && FlightTracker.searchFlight) {
            await FlightTracker.searchFlight(fn);
        }
    });

    // ============ TEAM ============
    async function loadTeam() {
        if (!isManager && !isDirector) return;
        var r = await db.from('profiles').select('*');
        var c = document.getElementById('teamContainer');
        if (!r.data || !r.data.length) { c.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;padding:40px;">No team members.</p>'; return; }
        var filtered = r.data.filter(function(p) { return p.role !== 'manager'; });
        c.innerHTML = filtered.map(function(p) {
            return '<div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;">' +
                '<div style="width:36px;height:36px;border-radius:50%;background:' + (p.is_admin || p.role==='director'?'var(--accent)':'var(--bg-tertiary)') + ';display:flex;align-items:center;justify-content:center;font-weight:700;color:' + (p.is_admin||p.role==='director'?'#1A2E4A':'var(--text-primary)') + ';">' + (p.full_name||'?').charAt(0).toUpperCase() + '</div>' +
                '<div><strong>' + escapeHtml(p.full_name) + '</strong><br><small style="color:var(--text-tertiary);">' + p.role + '</small></div></div>';
        }).join('');
    }

    // ============ HELPERS ============
    function formatStatus(s) { if (!s) return ''; return s.split('_').map(function(w){return w.charAt(0).toUpperCase()+w.slice(1);}).join(' '); }
    function formatDeadline(d) { var diff = new Date(d) - new Date(); if (diff < 0) return 'Overdue'; var h = Math.floor(diff/3600000); if (h < 24) return h + 'h remaining'; return Math.floor(h/24) + 'd remaining'; }
    function timeAgo(d) { var diff = (new Date() - new Date(d))/1000; if (diff<60) return 'Just now'; if (diff<3600) return Math.floor(diff/60)+'m ago'; if (diff<86400) return Math.floor(diff/3600)+'h ago'; return Math.floor(diff/86400)+'d ago'; }
    function escapeHtml(t) { if (!t) return ''; var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
    function populateFilterDropdown(sel) {
        if (!sel || sel.options.length > 1) return;
        ['draft','confirmed','booked','departed','in_transit','arrived','delivered'].forEach(function(s) {
            var o = document.createElement('option'); o.value = s; o.textContent = formatStatus(s); sel.appendChild(o);
        });
        sel.addEventListener('change', function() { window.loadShipmentsPage(); });
    }

    // ============ EVENT HANDLERS ============
    document.addEventListener('click', function(e) {
        if (e.target.id === 'btnNewShipment' || e.target.closest('#btnNewShipment')) {
            if (typeof ShipmentManager !== 'undefined') ShipmentManager.openShipmentForm();
        }
        if ((e.target.id === 'btnDelegateTask' || e.target.closest('#btnDelegateTask')) && canAssignTasks) {
            if (typeof TaskManager !== 'undefined') TaskManager.openDelegateModal();
        }
        if (e.target.id === 'btnAddRate' || e.target.closest('#btnAddRate')) {
            openRateForm(null);
        }
    });

    // Close popups on overlay click
    document.getElementById('statusPopup')?.addEventListener('click', function(e) { if (e.target === this) this.style.display = 'none'; });
    document.getElementById('taskDetailPopup')?.addEventListener('click', function(e) { if (e.target === this) this.style.display = 'none'; });

})();
