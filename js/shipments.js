// ============================================
// eCargoWorld — Shipment Manager
// ============================================

var ShipmentManager = (function() {
    'use strict';
    var db = window.supabase;

    function getNextStatus(current) {
        var flow = ['draft', 'confirmed', 'booked', 'departed', 'in_transit', 'arrived', 'delivered'];
        var idx = flow.indexOf(current);
        return idx < flow.length - 1 ? flow[idx + 1] : null;
    }

    function formatStatus(s) { if (!s) return ''; return s.split('_').map(function(w){return w.charAt(0).toUpperCase()+w.slice(1);}).join(' '); }

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
        return result.data;
    }

    function openShipmentForm(shipmentData) {
        var existing = document.getElementById('shipmentFormModal');
        if (existing) existing.remove();
        var isEdit = shipmentData && shipmentData.id;
        var isManager = (window.app && window.app.isManager) || false;

        var modal = document.createElement('div');
        modal.id = 'shipmentFormModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;z-index:1000;';

        modal.innerHTML = '<div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;padding:24px;width:90%;max-width:600px;max-height:85vh;overflow-y:auto;box-shadow:0 4px 24px rgba(0,0,0,0.08);">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
                '<h3 style="font-size:1.1rem;font-weight:700;">' + (isEdit ? 'Edit Shipment' : 'New Shipment') + '</h3>' +
                '<button id="closeShipmentModal" style="background:none;border:none;font-size:1.3rem;color:#9a9a9a;cursor:pointer;">&times;</button>' +
            '</div>' +
            '<form id="shipmentForm">' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
                    '<div><label style="display:block;font-size:0.72rem;font-weight:600;color:#6b6b6b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">AWB *</label><input type="text" id="sfAWB" value="' + escapeHtml(shipmentData ? shipmentData.awb_number || '' : '') + '" required style="width:100%;padding:8px 12px;border:1px solid #e5e5e5;border-radius:4px;font-family:inherit;font-size:0.85rem;background:#fff;color:#1a1a1a;"></div>' +
                    '<div><label style="display:block;font-size:0.72rem;font-weight:600;color:#6b6b6b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Customer *</label><input type="text" id="sfCustomer" value="' + escapeHtml(shipmentData ? shipmentData.customer_name || '' : '') + '" required style="width:100%;padding:8px 12px;border:1px solid #e5e5e5;border-radius:4px;font-family:inherit;font-size:0.85rem;background:#fff;color:#1a1a1a;"></div>' +
                    '<div><label style="display:block;font-size:0.72rem;font-weight:600;color:#6b6b6b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Email</label><input type="email" id="sfEmail" value="' + escapeHtml(shipmentData ? shipmentData.customer_email || '' : '') + '" style="width:100%;padding:8px 12px;border:1px solid #e5e5e5;border-radius:4px;font-family:inherit;font-size:0.85rem;background:#fff;color:#1a1a1a;"></div>' +
                    '<div><label style="display:block;font-size:0.72rem;font-weight:600;color:#6b6b6b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Origin *</label><input type="text" id="sfOrigin" value="' + escapeHtml(shipmentData ? shipmentData.origin || '' : '') + '" required style="width:100%;padding:8px 12px;border:1px solid #e5e5e5;border-radius:4px;font-family:inherit;font-size:0.85rem;background:#fff;color:#1a1a1a;"></div>' +
                    '<div><label style="display:block;font-size:0.72rem;font-weight:600;color:#6b6b6b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Destination *</label><input type="text" id="sfDestination" value="' + escapeHtml(shipmentData ? shipmentData.destination || '' : '') + '" required style="width:100%;padding:8px 12px;border:1px solid #e5e5e5;border-radius:4px;font-family:inherit;font-size:0.85rem;background:#fff;color:#1a1a1a;"></div>' +
                    '<div><label style="display:block;font-size:0.72rem;font-weight:600;color:#6b6b6b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Weight (kg) *</label><input type="number" id="sfWeight" value="' + (shipmentData ? shipmentData.weight_kg || '' : '') + '" step="0.1" required style="width:100%;padding:8px 12px;border:1px solid #e5e5e5;border-radius:4px;font-family:inherit;font-size:0.85rem;background:#fff;color:#1a1a1a;"></div>' +
                    '<div><label style="display:block;font-size:0.72rem;font-weight:600;color:#6b6b6b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Airline</label><input type="text" id="sfAirline" value="' + escapeHtml(shipmentData ? shipmentData.airline || '' : '') + '" style="width:100%;padding:8px 12px;border:1px solid #e5e5e5;border-radius:4px;font-family:inherit;font-size:0.85rem;background:#fff;color:#1a1a1a;"></div>' +
                    '<div><label style="display:block;font-size:0.72rem;font-weight:600;color:#6b6b6b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Flight #</label><input type="text" id="sfFlight" value="' + escapeHtml(shipmentData ? shipmentData.flight_number || '' : '') + '" style="width:100%;padding:8px 12px;border:1px solid #e5e5e5;border-radius:4px;font-family:inherit;font-size:0.85rem;background:#fff;color:#1a1a1a;"></div>' +
                '</div>' +
                '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">' +
                    '<button type="button" id="cancelShipmentBtn" style="padding:8px 16px;background:#fff;border:1px solid #e5e5e5;border-radius:4px;cursor:pointer;font-family:inherit;font-size:0.85rem;">Cancel</button>' +
                    '<button type="submit" style="padding:8px 16px;background:#1a1a1a;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;font-family:inherit;font-size:0.85rem;">' + (isEdit ? 'Update' : 'Create') + '</button>' +
                '</div>' +
            '</form></div>';

        document.body.appendChild(modal);
        document.getElementById('closeShipmentModal').addEventListener('click', function() { modal.remove(); });
        document.getElementById('cancelShipmentBtn').addEventListener('click', function() { modal.remove(); });
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });

        document.getElementById('shipmentForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            var submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true; submitBtn.textContent = 'Saving...';
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
            try {
                if (isEdit) {
                    data.updated_at = new Date().toISOString();
                    await db.from('shipments').update(data).eq('id', shipmentData.id);
                } else {
                    await createShipment(data);
                }
                modal.remove();
                if (typeof window.refreshCurrentScreen === 'function') window.refreshCurrentScreen();
            } catch(err) { alert('Error: ' + err.message); submitBtn.disabled = false; submitBtn.textContent = isEdit ? 'Update' : 'Create'; }
        });
    }

    return { createShipment: createShipment, openShipmentForm: openShipmentForm, getNextStatus: getNextStatus, formatStatus: formatStatus };
})();
