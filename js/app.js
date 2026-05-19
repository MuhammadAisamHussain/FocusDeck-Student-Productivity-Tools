// ============================================
// eCargoWorld — Dashboard Controller (Minimalist)
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

        renderScreen('dashboard');
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
            badge.textContent = 'Director';
            document.querySelectorAll('.manager-only').forEach(function(el) { el.style.display = 'flex'; });
            document.querySelectorAll('.director-only').forEach(function(el) { el.style.display = 'flex'; });
        } else if (isOpsManager) {
            badge.textContent = 'Ops Manager';
            document.querySelectorAll('.director-only').forEach(function(el) { el.style.display = 'flex'; });
        } else if (isManager) {
            badge.textContent = 'Manager';
            document.querySelectorAll('.manager-only').forEach(function(el) { el.style.display = 'flex'; });
        } else {
            badge.textContent = 'Employee';
        }
    }

    function setupAdminButton() {
        var btn = document.getElementById('btnAdmin');
        if (btn && canAccessAdmin) btn.style.display = 'block';
    }

    function setupNavigation() {
        document.querySelectorAll('.sidebar-nav a').forEach(function(item) {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                var screen = item.dataset.screen;
                if (!screen) return;
                renderScreen(screen);
                document.querySelectorAll('.sidebar-nav a').forEach(function(a) { a.classList.remove('active'); });
                item.classList.add('active');
            });
        });
    }

    function renderScreen(screenName) {
        currentScreen = screenName;
        var main = document.getElementById('mainContent');
        
        if (screenName === 'dashboard') renderDashboard(main);
        if (screenName === 'tasks') loadTasks(main);
        if (screenName === 'shipments') loadShipments(main);
        if (screenName === 'rates') loadRates(main);
        if (screenName === 'flights') loadFlights(main);
        if (screenName === 'team') loadTeam(main);
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
                showNotification(r.data[0]);
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
            badge.style.display = 'inline';
        } else if (badge) {
            badge.style.display = 'none';
        }
    }

    function showNotification(task) {
        document.getElementById('notifTaskName').textContent = task.name;
        document.getElementById('notifTaskDeadline').textContent = 'Deadline: ' + new Date(task.deadline).toLocaleString();
        document.getElementById('notificationPopup').style.display = 'flex';
        if (notificationSound) notificationSound();
        setTimeout(function() {
            document.getElementById('notificationPopup').style.display = 'none';
        }, 8000);
    }

    // ============ DASHBOARD ============
    async function renderDashboard(main) {
        main.innerHTML = '<div class="page-header"><h1>Overview</h1><p>Loading...</p></div>';
        
        try {
            var shipmentsResult = await db.from('shipments').select('status');
            var counts = {};
            if (shipmentsResult.data) {
                shipmentsResult.data.forEach(function(s) { counts[s.status] = (counts[s.status] || 0) + 1; });
            }

            var taskQuery = db.from('tasks').select('*, shipments(awb_number, customer_name)').eq('status', 'pending').order('deadline', { ascending: true });
            if (!isDirector && !isManager && !isOpsManager) {
                taskQuery = taskQuery.eq('assigned_to', currentUser.id);
            }
            var taskResult = await taskQuery.limit(20);
            var tasks = taskResult.data || [];

            var now = new Date();
            var overdueCount = 0, todayCount = 0;
            tasks.forEach(function(t) {
                if (new Date(t.deadline) < now) overdueCount++;
                else todayCount++;
            });

            var activeCount = (counts.confirmed || 0) + (counts.booked || 0) + (counts.departed || 0) + (counts.in_transit || 0);
            var deliveredCount = counts.delivered || 0;

            var html = '';
            
            // Page header
            html += '<div class="page-header"><h1>Overview</h1><p>' + new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + '</p></div>';
            
            // Stats
            html += '<div class="stat-grid">';
            html += '<div class="stat-card red"><div class="stat-label">Overdue Tasks</div><div class="stat-value">' + overdueCount + '</div></div>';
            html += '<div class="stat-card amber"><div class="stat-label">Due Today</div><div class="stat-value">' + todayCount + '</div></div>';
            html += '<div class="stat-card blue"><div class="stat-label">Active Shipments</div><div class="stat-value">' + activeCount + '</div></div>';
            html += '<div class="stat-card green"><div class="stat-label">Delivered</div><div class="stat-value">' + deliveredCount + '</div></div>';
            html += '</div>';

            // Tasks section
            html += '<div class="section-title">Tasks</div>';
            if (tasks.length > 0) {
                html += '<div class="task-list">';
                tasks.forEach(function(t) {
                    var isOverdue = new Date(t.deadline) < now;
                    html += '<div class="task-item" onclick="openTaskDetail(\'' + t.id + '\')">';
                    html += '<div class="task-priority ' + (t.priority === 'critical' ? 'critical' : t.priority === 'high' ? 'high' : 'medium') + '"></div>';
                    html += '<div class="task-info"><div class="task-name">' + escapeHtml(t.name) + '</div>';
                    html += '<div class="task-meta">' + (t.shipments ? t.shipments.awb_number : '—') + ' · <span class="' + (isOverdue ? 'overdue' : '') + '">' + formatDeadline(t.deadline) + '</span></div></div>';
                    html += '<div class="task-actions">';
                    html += '<span class="task-status pending">Pending</span>';
                    if (t.status !== 'completed') {
                        html += '<button class="btn btn-sm" onclick="event.stopPropagation();completeTask(\'' + t.id + '\')">Done</button>';
                    }
                    html += '<button class="btn btn-sm danger" onclick="event.stopPropagation();deleteTask(\'' + t.id + '\')" title="Delete">✕</button>';
                    html += '</div></div>';
                });
                html += '</div>';
            } else {
                html += '<div class="empty-state">No pending tasks</div>';
            }

            // Recent Shipments
            var recentResult = await db.from('shipments').select('*').order('updated_at', { ascending: false }).limit(5);
            if (recentResult.data && recentResult.data.length > 0) {
                html += '<div class="section-title" style="margin-top:24px;">Recent Shipments</div>';
                html += '<table class="data-table"><thead><tr><th>AWB</th><th>Customer</th><th>Route</th><th>Status</th></tr></thead><tbody>';
                recentResult.data.forEach(function(s) {
                    html += '<tr><td><span class="mono">' + escapeHtml(s.awb_number || 'Draft') + '</span></td><td>' + escapeHtml(s.customer_name) + '</td><td>' + escapeHtml(s.origin) + ' → ' + escapeHtml(s.destination) + '</td><td><span class="badge ' + s.status + '">' + formatStatus(s.status) + '</span></td></tr>';
                });
                html += '</tbody></table>';
            }

            main.innerHTML = html;
        } catch(e) {
            console.error('Dashboard error:', e);
            main.innerHTML = '<div class="page-header"><h1>Overview</h1></div><div class="empty-state">Error loading dashboard. Please refresh.</div>';
        }
    }

    window.loadDashboardOverview = function() { renderDashboard(document.getElementById('mainContent')); };

    // ============ TASKS SCREEN ============
    async function loadTasks(main) {
        main.innerHTML = '<div class="page-header"><h1>Tasks</h1><p>Loading...</p></div>';
        
        var query = db.from('tasks').select('*, shipments(awb_number, customer_name)').order('deadline', { ascending: true });
        if (!isDirector && !isManager && !isOpsManager) query = query.eq('assigned_to', currentUser.id);
        var r = await query;
        var tasks = r.data || [];

        var html = '<div class="page-header"><h1>Tasks</h1><p>' + tasks.length + ' tasks</p></div>';
        
        if (canAssignTasks) {
            html += '<div style="margin-bottom:16px;"><button class="btn primary" id="btnDelegateTask">+ Delegate Task</button></div>';
        }

        if (tasks.length > 0) {
            var pendingTasks = tasks.filter(function(t) { return t.status === 'pending'; });
            var doneTasks = tasks.filter(function(t) { return t.status === 'completed'; });

            if (pendingTasks.length > 0) {
                html += '<div class="section-title">Pending (' + pendingTasks.length + ')</div>';
                html += '<div class="task-list">';
                pendingTasks.forEach(function(t) {
                    var isOverdue = new Date(t.deadline) < new Date();
                    html += '<div class="task-item" onclick="openTaskDetail(\'' + t.id + '\')">';
                    html += '<div class="task-priority ' + (t.priority === 'critical' ? 'critical' : t.priority === 'high' ? 'high' : 'medium') + '"></div>';
                    html += '<div class="task-info"><div class="task-name">' + escapeHtml(t.name) + '</div>';
                    html += '<div class="task-meta">' + (t.shipments ? t.shipments.awb_number : '—') + ' · <span class="' + (isOverdue ? 'overdue' : '') + '">' + formatDeadline(t.deadline) + '</span></div></div>';
                    html += '<div class="task-actions">';
                    html += '<span class="task-status pending">Pending</span>';
                    html += '<button class="btn btn-sm" onclick="event.stopPropagation();completeTask(\'' + t.id + '\')">Done</button>';
                    html += '<button class="btn btn-sm danger" onclick="event.stopPropagation();deleteTask(\'' + t.id + '\')">✕</button>';
                    html += '</div></div>';
                });
                html += '</div>';
            }

            if (doneTasks.length > 0) {
                html += '<div class="section-title" style="margin-top:24px;">Completed (' + doneTasks.length + ')</div>';
                html += '<div class="task-list">';
                doneTasks.forEach(function(t) {
                    html += '<div class="task-item" onclick="openTaskDetail(\'' + t.id + '\')">';
                    html += '<div class="task-priority medium"></div>';
                    html += '<div class="task-info"><div class="task-name">' + escapeHtml(t.name) + '</div>';
                    html += '<div class="task-meta">' + (t.shipments ? t.shipments.awb_number : '—') + ' · Completed</div></div>';
                    html += '<span class="task-status done">Done</span></div>';
                });
                html += '</div>';
            }
        } else {
            html += '<div class="empty-state">No tasks assigned</div>';
        }

        main.innerHTML = html;

        document.getElementById('btnDelegateTask')?.addEventListener('click', function() {
            if (typeof TaskManager !== 'undefined') TaskManager.openDelegateModal();
        });
    }

    // ============ SHIPMENTS SCREEN ============
    async function loadShipments(main) {
        main.innerHTML = '<div class="page-header"><h1>Shipments</h1><p>Loading...</p></div>';
        
        var result = await db.from('shipments').select('*').order('created_at', { ascending: false });
        var shipments = result.data || [];
        var showProfit = isManager || isDirector;

        var html = '<div class="page-header"><h1>Shipments</h1><p>' + shipments.length + ' shipments</p></div>';
        html += '<div class="search-bar"><input type="text" id="shipmentSearch" placeholder="Search by AWB, customer, or airline..."><button class="btn primary" id="btnNewShipment">+ New Shipment</button></div>';

        if (shipments.length > 0) {
            html += '<table class="data-table"><thead><tr><th>AWB</th><th>Customer</th><th>Route</th><th>Airline</th><th>Weight</th><th>Status</th>';
            if (showProfit) html += '<th>Profit</th>';
            html += '<th></th></tr></thead><tbody>';
            
            shipments.forEach(function(s) {
                var profit = (s.revenue || 0) - (s.cost || 0);
                html += '<tr>';
                html += '<td><span class="mono">' + escapeHtml(s.awb_number || 'Draft') + '</span></td>';
                html += '<td>' + escapeHtml(s.customer_name) + '</td>';
                html += '<td>' + escapeHtml(s.origin) + ' → ' + escapeHtml(s.destination) + '</td>';
                html += '<td>' + escapeHtml(s.airline || '—') + '</td>';
                html += '<td>' + (s.weight_kg ? s.weight_kg + ' kg' : '—') + '</td>';
                html += '<td><span class="badge ' + s.status + '" onclick="showStatusPopup(\'' + s.id + '\',\'' + s.status + '\')" style="cursor:pointer;">' + formatStatus(s.status) + '</span></td>';
                if (showProfit) {
                    html += '<td style="color:' + (profit >= 0 ? 'var(--green)' : 'var(--red)') + ';font-weight:500;">' + (profit ? '$' + profit.toFixed(2) : '—') + '</td>';
                }
                html += '<td style="display:flex;gap:4px;">';
                html += '<button class="btn btn-sm edit-shipment-btn" data-id="' + s.id + '">Edit</button>';
                if (isManager || isDirector || isOpsManager) {
                    html += '<button class="btn btn-sm danger delete-shipment-btn" data-id="' + s.id + '">✕</button>';
                }
                html += '</td></tr>';
            });
            html += '</tbody></table>';
        } else {
            html += '<div class="empty-state">No shipments found</div>';
        }

        main.innerHTML = html;

        // Search
        document.getElementById('shipmentSearch')?.addEventListener('input', function() {
            var query = this.value.toLowerCase();
            document.querySelectorAll('.data-table tbody tr').forEach(function(row) {
                var text = row.textContent.toLowerCase();
                row.style.display = text.includes(query) ? '' : 'none';
            });
        });

        // New shipment
        document.getElementById('btnNewShipment')?.addEventListener('click', function() {
            if (typeof ShipmentManager !== 'undefined') ShipmentManager.openShipmentForm();
        });

        // Edit shipment
        main.querySelectorAll('.edit-shipment-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var r = await db.from('shipments').select('*').eq('id', btn.dataset.id).single();
                if (r.data && typeof ShipmentManager !== 'undefined') ShipmentManager.openShipmentForm(r.data);
            });
        });

        // Delete shipment
        main.querySelectorAll('.delete-shipment-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                if (!confirm('Delete this shipment?')) return;
                await db.from('shipments').delete().eq('id', btn.dataset.id);
                loadShipments(main);
            });
        });
    }

    // ============ STATUS POPUP ============
    window.showStatusPopup = function(shipmentId, currentStatus) {
        var statuses = ['draft', 'confirmed', 'booked', 'departed', 'in_transit', 'arrived', 'delivered'];
        var html = '';
        statuses.forEach(function(s) {
            var isCurrent = s === currentStatus;
            html += '<button class="status-option' + (isCurrent ? ' current' : '') + '" onclick="changeShipmentStatus(\'' + shipmentId + '\',\'' + s + '\')">' + (isCurrent ? '● ' : '') + formatStatus(s) + '</button>';
        });
        document.getElementById('statusPopupOptions').innerHTML = html;
        document.getElementById('statusPopupTitle').textContent = 'Change Status';
        document.getElementById('statusPopup').style.display = 'flex';
    };

    window.changeShipmentStatus = async function(id, newStatus) {
        await db.from('shipments').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
        document.getElementById('statusPopup').style.display = 'none';
        renderScreen('shipments');
    };

    // ============ TASK DETAIL ============
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
            document.getElementById('taskProofSection').innerHTML = '<p><strong>Completion Proof:</strong></p><img src="' + t.proof_url + '" style="max-width:100%;border-radius:var(--radius-sm);margin-top:8px;">';
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
            renderScreen('tasks');
            renderScreen('dashboard');
        };
        input.click();
    };

    window.completeTask = async function(taskId) {
        await db.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', taskId);
        renderScreen(currentScreen);
    };

    window.deleteTask = async function(taskId) {
        if (!confirm('Delete this task?')) return;
        try {
            await db.from('tasks').delete().eq('id', taskId);
            renderScreen(currentScreen);
        } catch(e) {
            console.error('Delete failed:', e);
        }
    };

    // ============ RATES SCREEN ============
    async function loadRates(main) {
        var r = await db.from('airline_rates').select('*').order('airline');
        var rates = r.data || [];

        var html = '<div class="page-header"><h1>Rate Database</h1><p>' + rates.length + ' rates</p></div>';
        html += '<div class="search-bar"><input type="text" id="rateSearch" placeholder="Search by airline, route, or cargo type..."><button class="btn primary" id="btnAddRate">+ Add Rate</button></div>';

        if (rates.length > 0) {
            html += '<table class="data-table"><thead><tr><th>Airline</th><th>Route</th><th>Cargo</th><th>Rate/kg</th><th>Surcharges</th><th></th></tr></thead><tbody>';
            rates.forEach(function(rt) {
                html += '<tr><td><strong>' + escapeHtml(rt.airline) + '</strong></td><td>' + escapeHtml(rt.origin) + ' → ' + escapeHtml(rt.destination) + '</td><td>' + escapeHtml(rt.cargo_type || 'general') + '</td><td style="font-weight:600;">$' + (rt.rate_per_kg_usd || 0).toFixed(2) + '</td><td>$' + (rt.surcharges || 0).toFixed(2) + '</td>';
                html += '<td style="display:flex;gap:4px;"><button class="btn btn-sm edit-rate-btn" data-id="' + rt.id + '">Edit</button><button class="btn btn-sm danger delete-rate-btn" data-id="' + rt.id + '">✕</button></td></tr>';
            });
            html += '</tbody></table>';
        } else {
            html += '<div class="empty-state">No rates configured</div>';
        }

        main.innerHTML = html;

        document.getElementById('rateSearch')?.addEventListener('input', function() {
            var query = this.value.toLowerCase();
            document.querySelectorAll('.data-table tbody tr').forEach(function(row) {
                row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
            });
        });

        document.getElementById('btnAddRate')?.addEventListener('click', function() { openRateForm(null); });

        main.querySelectorAll('.edit-rate-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var rr = await db.from('airline_rates').select('*').eq('id', btn.dataset.id).single();
                if (rr.data) openRateForm(rr.data);
            });
        });

        main.querySelectorAll('.delete-rate-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                if (!confirm('Delete this rate?')) return;
                await db.from('airline_rates').delete().eq('id', btn.dataset.id);
                loadRates(main);
            });
        });
    }

    function openRateForm(rateData) {
        var existing = document.getElementById('rateFormModal');
        if (existing) existing.remove();
        var isEdit = rateData && rateData.id;
        var modal = document.createElement('div');
        modal.id = 'rateFormModal';
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        
        modal.innerHTML = '<div class="modal-panel" style="max-width:520px;">' +
            '<div class="modal-header"><h3>' + (isEdit ? 'Edit Rate' : 'Add Rate') + '</h3><button class="modal-close" onclick="document.getElementById(\'rateFormModal\').remove()">&times;</button></div>' +
            '<div class="modal-body">' +
            '<form id="rateForm">' +
                '<div class="form-row"><div class="form-group"><label>Airline</label><input type="text" id="rfAirline" value="' + escapeHtml(rateData?rateData.airline||'':'') + '" required></div><div class="form-group"><label>Cargo Type</label><select id="rfCargoType"><option>general</option><option>perishable</option><option>pharma</option><option>dangerous</option><option>valuable</option></select></div></div>' +
                '<div class="form-row"><div class="form-group"><label>Origin</label><input type="text" id="rfOrigin" value="' + escapeHtml(rateData?rateData.origin||'':'') + '" required></div><div class="form-group"><label>Destination</label><input type="text" id="rfDestination" value="' + escapeHtml(rateData?rateData.destination||'':'') + '" required></div></div>' +
                '<div class="form-row"><div class="form-group"><label>Rate/kg (USD)</label><input type="number" id="rfRate" value="' + (rateData?rateData.rate_per_kg_usd||'':'') + '" step="0.01" required></div><div class="form-group"><label>Surcharges</label><input type="number" id="rfSurcharges" value="' + (rateData?rateData.surcharges||'':'') + '" step="0.01"></div></div>' +
            '</form></div>' +
            '<div class="modal-footer"><button class="btn" onclick="document.getElementById(\'rateFormModal\').remove()">Cancel</button><button class="btn primary" id="rateFormSubmit">' + (isEdit?'Update':'Add Rate') + '</button></div>' +
            '</div>';
        
        document.body.appendChild(modal);
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
        
        document.getElementById('rateFormSubmit').addEventListener('click', async function() {
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
                loadRates(document.getElementById('mainContent'));
            } catch(err) { alert('Error: ' + err.message); }
        });
    }

    // ============ FLIGHTS SCREEN ============
    async function loadFlights(main) {
        if (!isDirector) return;
        var html = '<div class="page-header"><h1>Flight Tracking</h1><p>Search any flight or view tracked shipments</p></div>';
        html += '<div class="search-bar"><input type="text" id="flightSearchInput" placeholder="Enter flight number..."><button class="btn primary" id="btnFlightSearch">Search</button></div>';
        html += '<div id="flightSearchResult"></div>';
        html += '<div class="section-title" style="margin-top:20px;">Tracked Shipment Flights</div>';
        html += '<div id="flightsList"></div>';
        main.innerHTML = html;

        document.getElementById('btnFlightSearch')?.addEventListener('click', async function() {
            var fn = document.getElementById('flightSearchInput').value.trim();
            if (!fn) return;
            if (typeof FlightTracker !== 'undefined' && FlightTracker.searchFlight) {
                await FlightTracker.searchFlight(fn);
            }
        });

        var r = await db.from('shipments').select('*').not('flight_number', 'is', null).order('updated_at', { ascending: false });
        var flights = r.data || [];
        var fhtml = '';
        if (flights.length > 0) {
            fhtml += '<table class="data-table"><thead><tr><th>Flight</th><th>Airline</th><th>Route</th><th>Status</th><th>AWB</th><th></th></tr></thead><tbody>';
            flights.forEach(function(s) {
                fhtml += '<tr><td><span class="mono">' + escapeHtml(s.flight_number) + '</span></td><td>' + escapeHtml(s.airline||'') + '</td><td>' + escapeHtml(s.origin) + ' → ' + escapeHtml(s.destination) + '</td><td><span class="badge ' + s.status + '">' + formatStatus(s.status) + '</span></td><td>' + escapeHtml(s.awb_number||'') + '</td>';
                fhtml += '<td><button class="btn btn-sm track-flight-btn" data-id="' + s.id + '" data-flight="' + escapeHtml(s.flight_number) + '">Track</button></td></tr>';
            });
            fhtml += '</tbody></table>';
        } else {
            fhtml += '<div class="empty-state">No flights being tracked</div>';
        }
        document.getElementById('flightsList').innerHTML = fhtml;

        document.querySelectorAll('.track-flight-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (typeof FlightTracker !== 'undefined') FlightTracker.trackFlight(btn.dataset.id, btn.dataset.flight);
            });
        });
    }

    // ============ TEAM SCREEN ============
    async function loadTeam(main) {
        if (!isManager && !isDirector) return;
        var r = await db.from('profiles').select('*');
        var users = r.data || [];
        var filtered = users.filter(function(p) { return p.role !== 'manager'; });

        var html = '<div class="page-header"><h1>Team Overview</h1><p>' + filtered.length + ' team members</p></div>';
        
        if (filtered.length > 0) {
            html += '<div class="bento">';
            html += '<div class="bento-card wide"><h3>Team Members</h3><div class="mini-list">';
            filtered.forEach(function(p) {
                html += '<div class="mini-item"><span class="name">' + escapeHtml(p.full_name || 'Unnamed') + '</span><span class="count">' + p.role + '</span></div>';
            });
            html += '</div></div></div>';
        } else {
            html += '<div class="empty-state">No team members</div>';
        }

        main.innerHTML = html;
    }

    // ============ HELPERS ============
    function formatStatus(s) { if (!s) return ''; return s.split('_').map(function(w){return w.charAt(0).toUpperCase()+w.slice(1);}).join(' '); }
    function formatDeadline(d) { var diff = new Date(d) - new Date(); if (diff < 0) return 'Overdue'; var h = Math.floor(diff/3600000); if (h < 24) return h + 'h left'; return Math.floor(h/24) + 'd left'; }
    function escapeHtml(t) { if (!t) return ''; var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

    // Close modals on overlay click
    document.getElementById('statusPopup')?.addEventListener('click', function(e) { if (e.target === this) this.style.display = 'none'; });
    document.getElementById('taskDetailPopup')?.addEventListener('click', function(e) { if (e.target === this) this.style.display = 'none'; });

})();
