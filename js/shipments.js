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

    function formatStatus(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async function createShipment(data) {
        data.status = data.status || 'draft';
        data.created_at = new Date().toISOString();
        data.updated_at = new Date().toISOString();
        var result = await db.from('shipments').insert(data).select().single();
        if (result.error) throw result.error;
        await createTaskFromTrigger('shipment_created', result.data);
        return result.data;
    }

    async function updateStatus(id, newStatus) {
        var result = await db.from('shipments').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id).select().single();
        if (result.error) throw result.error;
        await createTaskFromTrigger('status_changed', result.data);
        return result.data;
    }

    async function deleteShipment(id) {
        var result = await db.from('shipments').delete().eq('id', id);
        if (result.error) throw result.error;
        return true;
    }

    async function createTaskFromTrigger(trigger, shipment) {
        var templates = {
            'shipment_created': { name: 'Verify shipment details', deadline_hours: 1, priority: 'high' },
            'status_changed_booked': { name: 'Send flight details to customer', deadline_hours: 2, priority: 'high' },
            'status_changed_departed': { name: 'Send departure confirmation', deadline_hours: 1, priority: 'high' },
            'status_changed_arrived': { name: 'Send arrival notice to customer', deadline_hours: 1, priority: 'high' }
        };
        var templateKey = trigger === 'status_changed' ? 'status_changed_' + shipment.status : trigger;
        var template = templates[templateKey];
        if (!template) return;

        var existingResult = await db.from('tasks').select('id').eq('shipment_id', shipment.id).eq('name', template.name).eq('status', 'pending').single();
        if (existingResult.data) return;

        var empResult = await db.from('profiles').select('id').eq('role', 'employee').limit(1);
        var assigneeId = empResult.data && empResult.data.length > 0 ? empResult.data[0].id : null;
        var deadline = new Date();
        deadline.setHours(deadline.getHours() + template.deadline_hours);

        await db.from('tasks').insert({
            name: template.name, task_type: trigger, shipment_id: shipment.id,
            assigned_to: assigneeId, deadline: deadline.toISOString(),
            status: 'pending', priority: template.priority, created_by: 'system', created_at: new Date().toISOString()
        });
    }

    function openShipmentForm(shipmentData) {
        var existingModal = document.getElementById('shipmentFormModal');
        if (existingModal) existingModal.remove();

        var isEdit = shipmentData && shipmentData.id;
        var isManager = window.app && window.app.isManager;

        var modal = document.createElement('div');
        modal.id = 'shipmentFormModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:1000;';

        var revenueFields = isManager ? 
            '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Revenue (USD)</label><input type="number" id="sfRevenue" value="' + (shipmentData ? shipmentData.revenue || '' : '') + '" step="0.01" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
            '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Cost (USD)</label><input type="number" id="sfCost" value="' + (shipmentData ? shipmentData.cost || '' : '') + '" step="0.01" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' : '';

        modal.innerHTML = '<div style="background:var(--bg-card);border:1px solid var(--border-medium);border-radius:var(--radius-xl);padding:28px;width:90%;max-width:600px;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
                '<h3 style="font-size:1.1rem;font-weight:700;">' + (isEdit ? 'Edit Shipment' : 'New Shipment') + '</h3>' +
                '<button id="closeShipmentModal" style="background:none;border:none;color:var(--text-tertiary);font-size:1.5rem;cursor:pointer;">&times;</button>' +
            '</div>' +
            '<form id="shipmentForm">' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">AWB Number *</label><input type="text" id="sfAWB" value="' + escapeHtml(shipmentData ? shipmentData.awb_number || '' : '') + '" required placeholder="e.g. 176-5432-1098" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Customer Name *</label><input type="text" id="sfCustomer" value="' + escapeHtml(shipmentData ? shipmentData.customer_name || '' : '') + '" required style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Email</label><input type="email" id="sfEmail" value="' + escapeHtml(shipmentData ? shipmentData.customer_email || '' : '') + '" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Origin *</label><input type="text" id="sfOrigin" value="' + escapeHtml(shipmentData ? shipmentData.origin || '' : '') + '" required placeholder="e.g. LHE" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Destination *</label><input type="text" id="sfDestination" value="' + escapeHtml(shipmentData ? shipmentData.destination || '' : '') + '" required placeholder="e.g. DXB" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Weight (kg) *</label><input type="number" id="sfWeight" value="' + (shipmentData ? shipmentData.weight_kg || '' : '') + '" step="0.1" required style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Airline</label><input type="text" id="sfAirline" value="' + escapeHtml(shipmentData ? shipmentData.airline || '' : '') + '" placeholder="e.g. EK" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Flight Number</label><input type="text" id="sfFlight" value="' + escapeHtml(shipmentData ? shipmentData.flight_number || '' : '') + '" placeholder="e.g. EK612" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                    revenueFields +
                '</div>' +
                '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">' +
                    '<button type="button" id="cancelShipmentBtn" style="padding:10px 20px;background:transparent;border:1px solid var(--border-medium);color:var(--text-primary);border-radius:var(--radius);cursor:pointer;font-family:inherit;">Cancel</button>' +
                    '<button type="submit" style="padding:10px 20px;background:var(--accent);color:#1A2E4A;border:none;border-radius:var(--radius);cursor:pointer;font-weight:600;font-family:inherit;">' + (isEdit ? 'Update' : 'Create') + '</button>' +
                '</div>' +
            '</form>' +
        '</div>';

        document.body.appendChild(modal);

        document.getElementById('closeShipmentModal').addEventListener('click', function() { modal.remove(); });
        document.getElementById('cancelShipmentBtn').addEventListener('click', function() { modal.remove(); });
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });

        document.getElementById('shipmentForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            var submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';

            var data = {
                awb_number: document.getElementById('sfAWB').value.trim(),
                customer_name: document.getElementById('sfCustomer').value,
                customer_email: document.getElementById('sfEmail').value,
                origin: document.getElementById('sfOrigin').value.trim(),
                destination: document.getElementById('sfDestination').value.trim(),
                weight_kg: parseFloat(document.getElementById('sfWeight').value) || 0,
                airline: document.getElementById('sfAirline').value.trim(),
                flight_number: document.getElementById('sfFlight').value.trim()
            };

            if (isManager) {
                data.revenue = parseFloat(document.getElementById('sfRevenue').value) || 0;
                data.cost = parseFloat(document.getElementById('sfCost').value) || 0;
            }

            try {
                if (isEdit) {
                    data.updated_at = new Date().toISOString();
                    await db.from('shipments').update(data).eq('id', shipmentData.id);
                } else {
                    await createShipment(data);
                }
                modal.remove();
                if (typeof window.loadShipmentsPage === 'function') window.loadShipmentsPage();
                if (typeof window.loadDashboardOverview === 'function') window.loadDashboardOverview();
            } catch(err) {
                alert('Error saving shipment: ' + err.message);
                submitBtn.disabled = false;
                submitBtn.textContent = isEdit ? 'Update' : 'Create';
            }
        });
    }

    return {
        createShipment: createShipment,
        updateStatus: updateStatus,
        deleteShipment: deleteShipment,
        openShipmentForm: openShipmentForm,
        getNextStatus: getNextStatus,
        formatStatus: formatStatus
    };

})();
