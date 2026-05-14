// ============================================
// eCargoWorld — Shipment Manager
// ============================================

var ShipmentManager = (function() {
    'use strict';
    var db = window.supabase;

    function getNextStatus(current) {
        var flow = ['draft', 'confirmed', 'booked', 'departed', 'arrived', 'delivered'];
        var idx = flow.indexOf(current);
        return idx < flow.length - 1 ? flow[idx + 1] : null;
    }

    function formatStatus(s) {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function generateAWB() {
        var prefix = '176';
        var random = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
        return prefix + '-' + random.slice(0, 4) + '-' + random.slice(4, 8);
    }

    // Create shipment
    async function createShipment(data) {
        data.awb_number = generateAWB();
        data.status = data.status || 'draft';
        data.created_at = new Date().toISOString();
        data.updated_at = new Date().toISOString();

        var result = await db.from('shipments').insert(data).select().single();
        if (result.error) throw result.error;

        // Auto-create task: verify shipment
        await createTaskFromTrigger('shipment_created', result.data);

        return result.data;
    }

    // Update shipment status
    async function updateStatus(id, newStatus) {
        var oldResult = await db.from('shipments').select('status').eq('id', id).single();
        var oldStatus = oldResult.data ? oldResult.data.status : null;

        var result = await db.from('shipments')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (result.error) throw result.error;

        // Trigger tasks on status change
        if (oldStatus !== newStatus) {
            await createTaskFromTrigger('status_changed', result.data, oldStatus);
        }

        return result.data;
    }

    // Auto-create tasks based on triggers
    async function createTaskFromTrigger(trigger, shipment, oldStatus) {
        var templates = {
            'shipment_created': { name: 'Verify shipment details', deadline_hours: 1, priority: 'high' },
            'status_changed_booked': { name: 'Send flight details to customer', deadline_hours: 2, priority: 'high' },
            'status_changed_departed': { name: 'Send departure confirmation', deadline_hours: 1, priority: 'high' },
            'status_changed_arrived': { name: 'Send arrival notice to customer', deadline_hours: 1, priority: 'high' }
        };

        var templateKey = trigger;
        if (trigger === 'status_changed' && shipment.status) {
            templateKey = 'status_changed_' + shipment.status;
        }

        var template = templates[templateKey];
        if (!template) return;

        // Check if task already exists
        var existingResult = await db.from('tasks')
            .select('id')
            .eq('shipment_id', shipment.id)
            .eq('name', template.name)
            .eq('status', 'pending')
            .single();

        if (existingResult.data) return; // Already exists

        // Get an employee to assign
        var empResult = await db.from('profiles').select('id').eq('role', 'employee').limit(1);
        var assigneeId = empResult.data && empResult.data.length > 0 ? empResult.data[0].id : null;

        var deadline = new Date();
        deadline.setHours(deadline.getHours() + template.deadline_hours);

        await db.from('tasks').insert({
            name: template.name,
            task_type: trigger,
            shipment_id: shipment.id,
            assigned_to: assigneeId,
            deadline: deadline.toISOString(),
            status: 'pending',
            priority: template.priority,
            created_by: 'system',
            created_at: new Date().toISOString()
        });
    }

    // Load all shipments
    async function loadShipments(filters) {
        filters = filters || {};
        var query = db.from('shipments').select('*');

        if (filters.status) query = query.eq('status', filters.status);

        var result = await query.order('created_at', { ascending: false });
        return result.data || [];
    }

    // Render shipment table
    function renderTable(shipments, tbodyId) {
        var tbody = document.getElementById(tbodyId);
        if (!tbody) return;

        if (!shipments || shipments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><p>No shipments found.</p></div></td></tr>';
            return;
        }

        tbody.innerHTML = shipments.map(function(s) {
            return '<tr>' +
                '<td><span class="awb-mono">' + escapeHtml(s.awb_number || 'Draft') + '</span></td>' +
                '<td>' + escapeHtml(s.customer_name) + '</td>' +
                '<td><div class="route-display"><span class="route-code">' + escapeHtml(s.origin) + '</span><span style="color:var(--text-tertiary);margin:0 6px;">→</span><span class="route-code">' + escapeHtml(s.destination) + '</span></div></td>' +
                '<td>' + escapeHtml(s.airline || '—') + '</td>' +
                '<td>' + (s.weight_kg ? s.weight_kg + ' kg' : '—') + '</td>' +
                '<td><span class="status-badge status-' + s.status + '">' + formatStatus(s.status) + '</span></td>' +
                '<td><div class="row-actions">' +
                    '<button class="row-action-btn advance-status-btn" data-id="' + s.id + '" data-status="' + s.status + '" title="Advance Status">▶</button>' +
                    '<button class="row-action-btn track-flight-btn" data-id="' + s.id + '" data-flight="' + escapeHtml(s.flight_number || '') + '" title="Track Flight" style="margin-left:4px;">✈</button>' +
                '</div></td>' +
                '</tr>';
        }).join('');

        // Bind advance status buttons
        tbody.querySelectorAll('.advance-status-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var id = btn.dataset.id;
                var current = btn.dataset.status;
                var next = getNextStatus(current);
                if (!next) return;
                btn.disabled = true;
                btn.textContent = '...';
                try {
                    await updateStatus(id, next);
                    if (typeof loadShipmentsPage === 'function') loadShipmentsPage();
                    if (typeof loadDashboardOverview === 'function') loadDashboardOverview();
                } catch(e) {
                    console.error('Status update failed:', e);
                    btn.disabled = false;
                    btn.textContent = '▶';
                }
            });
        });

        // Bind track flight buttons
        tbody.querySelectorAll('.track-flight-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var shipmentId = btn.dataset.id;
                var flightNumber = btn.dataset.flight;
                if (typeof FlightTracker !== 'undefined' && FlightTracker.trackFlight) {
                    FlightTracker.trackFlight(shipmentId, flightNumber);
                } else {
                    alert('Flight tracking coming in Batch 3 part 2');
                }
            });
        });
    }

    // Open shipment form modal
    function openShipmentForm(shipmentData) {
        var existingModal = document.getElementById('shipmentFormModal');
        if (existingModal) existingModal.remove();

        var isEdit = shipmentData && shipmentData.id;
        var modal = document.createElement('div');
        modal.id = 'shipmentFormModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:1000;';

        modal.innerHTML = '<div style="background:var(--bg-card);border:1px solid var(--border-medium);border-radius:var(--radius-xl);padding:28px;width:90%;max-width:600px;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
                '<h3 style="font-size:1.1rem;font-weight:700;">' + (isEdit ? 'Edit Shipment' : 'New Shipment') + '</h3>' +
                '<button id="closeShipmentModal" style="background:none;border:none;color:var(--text-tertiary);font-size:1.5rem;cursor:pointer;">&times;</button>' +
            '</div>' +
            '<form id="shipmentForm">' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Customer Name *</label><input type="text" id="sfCustomer" value="' + escapeHtml(shipmentData ? shipmentData.customer_name || '' : '') + '" required style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Email</label><input type="email" id="sfEmail" value="' + escapeHtml(shipmentData ? shipmentData.customer_email || '' : '') + '" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Origin *</label><select id="sfOrigin" required style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"><option value="">Select</option><option value="LHE"' + (shipmentData && shipmentData.origin === 'LHE' ? ' selected' : '') + '>LHE - Lahore</option><option value="KHI"' + (shipmentData && shipmentData.origin === 'KHI' ? ' selected' : '') + '>KHI - Karachi</option><option value="ISB"' + (shipmentData && shipmentData.origin === 'ISB' ? ' selected' : '') + '>ISB - Islamabad</option></select></div>' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Destination *</label><select id="sfDestination" required style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"><option value="">Select</option><option value="DXB"' + (shipmentData && shipmentData.destination === 'DXB' ? ' selected' : '') + '>DXB - Dubai</option><option value="DOH"' + (shipmentData && shipmentData.destination === 'DOH' ? ' selected' : '') + '>DOH - Doha</option><option value="JED"' + (shipmentData && shipmentData.destination === 'JED' ? ' selected' : '') + '>JED - Jeddah</option><option value="LHR"' + (shipmentData && shipmentData.destination === 'LHR' ? ' selected' : '') + '>LHR - London</option><option value="IST"' + (shipmentData && shipmentData.destination === 'IST' ? ' selected' : '') + '>IST - Istanbul</option></select></div>' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Weight (kg) *</label><input type="number" id="sfWeight" value="' + (shipmentData ? shipmentData.weight_kg || '' : '') + '" step="0.1" required style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Airline</label><select id="sfAirline" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"><option value="">Select</option><option value="EK"' + (shipmentData && shipmentData.airline === 'EK' ? ' selected' : '') + '>EK - Emirates</option><option value="QR"' + (shipmentData && shipmentData.airline === 'QR' ? ' selected' : '') + '>QR - Qatar</option><option value="TK"' + (shipmentData && shipmentData.airline === 'TK' ? ' selected' : '') + '>TK - Turkish</option><option value="EY"' + (shipmentData && shipmentData.airline === 'EY' ? ' selected' : '') + '>EY - Etihad</option></select></div>' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Flight Number</label><input type="text" id="sfFlight" value="' + escapeHtml(shipmentData ? shipmentData.flight_number || '' : '') + '" placeholder="e.g. EK612" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Revenue (USD)</label><input type="number" id="sfRevenue" value="' + (shipmentData ? shipmentData.revenue || '' : '') + '" step="0.01" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Cost (USD)</label><input type="number" id="sfCost" value="' + (shipmentData ? shipmentData.cost || '' : '') + '" step="0.01" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                '</div>' +
                '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">' +
                    '<button type="button" id="cancelShipmentBtn" style="padding:10px 20px;background:transparent;border:1px solid var(--border-medium);color:var(--text-primary);border-radius:var(--radius);cursor:pointer;font-family:inherit;">Cancel</button>' +
                    '<button type="submit" style="padding:10px 20px;background:var(--accent);color:#1A2E4A;border:none;border-radius:var(--radius);cursor:pointer;font-weight:600;font-family:inherit;">' + (isEdit ? 'Update' : 'Create') + '</button>' +
                '</div>' +
            '</form>' +
        '</div>';

        document.body.appendChild(modal);

        // Close handlers
        document.getElementById('closeShipmentModal').addEventListener('click', function() { modal.remove(); });
        document.getElementById('cancelShipmentBtn').addEventListener('click', function() { modal.remove(); });
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });

        // Submit handler
        document.getElementById('shipmentForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            var submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';

            var data = {
                customer_name: document.getElementById('sfCustomer').value,
                customer_email: document.getElementById('sfEmail').value,
                origin: document.getElementById('sfOrigin').value,
                destination: document.getElementById('sfDestination').value,
                weight_kg: parseFloat(document.getElementById('sfWeight').value) || 0,
                airline: document.getElementById('sfAirline').value,
                flight_number: document.getElementById('sfFlight').value,
                revenue: parseFloat(document.getElementById('sfRevenue').value) || 0,
                cost: parseFloat(document.getElementById('sfCost').value) || 0
            };

            try {
                if (isEdit) {
                    await db.from('shipments').update(data).eq('id', shipmentData.id);
                } else {
                    await createShipment(data);
                }
                modal.remove();
                if (typeof loadShipmentsPage === 'function') loadShipmentsPage();
                if (typeof loadDashboardOverview === 'function') loadDashboardOverview();
            } catch(err) {
                console.error('Save failed:', err);
                alert('Error saving shipment: ' + err.message);
                submitBtn.disabled = false;
                submitBtn.textContent = isEdit ? 'Update' : 'Create';
            }
        });
    }

    return {
        createShipment: createShipment,
        updateStatus: updateStatus,
        loadShipments: loadShipments,
        renderTable: renderTable,
        openShipmentForm: openShipmentForm,
        getNextStatus: getNextStatus,
        formatStatus: formatStatus
    };

})();
