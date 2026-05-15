// ============================================
// eCargoWorld — Public Shipment Tracking
// ============================================

(function() {
    'use strict';

    var db = window.supabase;
    var trackBtn = document.getElementById('trackBtn');
    var awbInput = document.getElementById('trackAWB');
    var resultDiv = document.getElementById('trackResult');
    var errorDiv = document.getElementById('trackError');

    if (trackBtn) {
        trackBtn.addEventListener('click', searchShipment);
    }
    if (awbInput) {
        awbInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') searchShipment();
        });
    }

    async function searchShipment() {
        var awb = awbInput.value.trim();
        if (!awb) {
            showError('Please enter an AWB number.');
            return;
        }

        hideResult();
        hideError();
        trackBtn.textContent = 'Searching...';
        trackBtn.disabled = true;

        try {
            var result = await db.from('shipments')
                .select('awb_number, customer_name, origin, destination, airline, flight_number, weight_kg, status, updated_at')
                .ilike('awb_number', awb)
                .single();

            if (result.error || !result.data) {
                showError('AWB number not found. Please check the number and try again, or contact us at info@ecargopk.com.');
            } else {
                showResult(result.data);
            }
        } catch (e) {
            showError('Unable to search. Please try again or contact us at info@ecargopk.com.');
        }

        trackBtn.textContent = 'Track';
        trackBtn.disabled = false;
    }

    function showResult(shipment) {
        document.getElementById('trackAWBDisplay').textContent = 'AWB: ' + shipment.awb_number;
        document.getElementById('trackCustomer').textContent = shipment.customer_name || '—';
        document.getElementById('trackOrigin').textContent = shipment.origin || '—';
        document.getElementById('trackDestination').textContent = shipment.destination || '—';
        document.getElementById('trackFlight').textContent = (shipment.airline || '—') + ' ' + (shipment.flight_number || '');
        document.getElementById('trackWeight').textContent = shipment.weight_kg ? shipment.weight_kg + ' kg' : '—';
        document.getElementById('trackUpdated').textContent = formatDate(shipment.updated_at);

        var badge = document.getElementById('trackStatusBadge');
        var status = shipment.status;
        badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        badge.className = 'track-status-badge';

        var colors = {
            'draft': '#9CA3AF',
            'confirmed': '#3B82F6',
            'booked': '#F5A623',
            'departed': '#F59E0B',
            'arrived': '#22C55E',
            'delivered': '#8B5CF6',
            'cancelled': '#EF4444'
        };
        badge.style.background = (colors[status] || '#9CA3AF') + '20';
        badge.style.color = colors[status] || '#9CA3AF';
        badge.style.border = '1px solid ' + (colors[status] || '#9CA3AF');

        resultDiv.classList.add('active');
    }

    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.classList.add('active');
    }

    function hideResult() {
        resultDiv.classList.remove('active');
    }

    function hideError() {
        errorDiv.classList.remove('active');
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        var d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
})();
