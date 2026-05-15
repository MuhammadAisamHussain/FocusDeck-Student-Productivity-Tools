// ============================================
// eCargoWorld — Flight Tracker
// AviationStack API Integration
// Director Only
// ============================================

var FlightTracker = (function() {
    'use strict';

    // ============================================
    // PUT YOUR API KEY HERE
    // ============================================
    var AVIATIONSTACK_KEY = 'a64c5436fa799b0514c87c5e44653214';

    var db = window.supabase;
    var isDirector = false;

    function setDirector(status) {
        isDirector = status;
    }

    // Track a flight — only directors can trigger API calls
    async function trackFlight(shipmentId, flightNumber) {
        if (!flightNumber) {
            alert('No flight number set for this shipment. Please add a flight number first.');
            return;
        }

        if (!isDirector) {
            alert('Flight tracking is only available to the Director. Please contact the Director to track this flight.');
            return;
        }

        if (!AVIATIONSTACK_KEY || AVIATIONSTACK_KEY === 'YOUR_API_KEY_HERE') {
            alert('API key not configured. Please add your AviationStack key in js/flights.js');
            return;
        }

        // Show loading
        showTrackingModal(shipmentId, flightNumber, 'loading');

        try {
            var status = await fetchFlightStatus(flightNumber);

            if (status) {
                // Update shipment status
                var statusMap = {
                    'scheduled': 'booked',
                    'active': 'departed',
                    'landed': 'arrived',
                    'cancelled': 'cancelled',
                    'diverted': 'departed'
                };

                var newStatus = statusMap[status.flight_status] || null;

                if (newStatus) {
                    await db.from('shipments')
                        .update({ status: newStatus, updated_at: new Date().toISOString() })
                        .eq('id', shipmentId);

                    // If delayed, create urgent task
                    if (status.departure_delay && status.departure_delay > 0) {
                        var empResult = await db.from('profiles').select('id').eq('role', 'employee').limit(1);
                        var assigneeId = empResult.data && empResult.data.length > 0 ? empResult.data[0].id : null;
                        var deadline = new Date();
                        deadline.setMinutes(deadline.getMinutes() + 30);

                        await db.from('tasks').insert({
                            name: 'URGENT: Notify customer of flight delay (' + flightNumber + ')',
                            task_type: 'flight_delayed',
                            shipment_id: shipmentId,
                            assigned_to: assigneeId,
                            deadline: deadline.toISOString(),
                            status: 'pending',
                            priority: 'critical',
                            created_by: 'system',
                            created_at: new Date().toISOString()
                        });
                    }
                }

                showTrackingModal(shipmentId, flightNumber, 'success', status);
            } else {
                showTrackingModal(shipmentId, flightNumber, 'error', null, 'Flight not found. Check the flight number.');
            }
        } catch (e) {
            console.error('Flight tracking error:', e);
            showTrackingModal(shipmentId, flightNumber, 'error', null, 'Tracking failed: ' + e.message);
        }

        // Refresh pages
        if (typeof window.loadFlightsPage === 'function') window.loadFlightsPage();
        if (typeof window.loadShipmentsPage === 'function') window.loadShipmentsPage();
        if (typeof window.loadDashboardOverview === 'function') window.loadDashboardOverview();
    }

    async function fetchFlightStatus(flightNumber) {
        var url = 'https://api.aviationstack.com/v1/flights?flight_iata=' + encodeURIComponent(flightNumber) + '&access_key=' + AVIATIONSTACK_KEY;

        var response = await fetch(url);
        if (!response.ok) throw new Error('API request failed');

        var data = await response.json();

        if (data.data && data.data.length > 0) {
            var flight = data.data[0];
            return {
                flight_number: flight.flight.iata || flightNumber,
                airline: flight.airline.name || 'Unknown',
                departure_airport: flight.departure.airport || 'Unknown',
                arrival_airport: flight.arrival.airport || 'Unknown',
                departure_time: flight.departure.scheduled || null,
                arrival_time: flight.arrival.scheduled || null,
                flight_status: flight.flight_status || 'unknown',
                departure_delay: flight.departure.delay || 0,
                arrival_delay: flight.arrival.delay || 0
            };
        }

        return null;
    }

    function showTrackingModal(shipmentId, flightNumber, state, flightData, errorMessage) {
        var existing = document.getElementById('trackingModal');
        if (existing) existing.remove();

        var modal = document.createElement('div');
        modal.id = 'trackingModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:1000;';

        var content = '';

        if (state === 'loading') {
            content = '<div style="text-align:center;padding:40px;">' +
                '<div style="font-size:3rem;margin-bottom:16px;">✈️</div>' +
                '<h3 style="margin-bottom:8px;">Tracking Flight ' + escapeHtml(flightNumber) + '</h3>' +
                '<p style="color:var(--text-tertiary);">Fetching live flight data...</p>' +
                '</div>';
        } else if (state === 'success' && flightData) {
            var statusColors = { 'scheduled': 'var(--blue)', 'active': 'var(--orange)', 'landed': 'var(--green)', 'cancelled': 'var(--red)' };
            var statusColor = statusColors[flightData.flight_status] || 'var(--text-tertiary)';
            var statusLabels = { 'scheduled': 'Scheduled', 'active': 'In Flight', 'landed': 'Landed', 'cancelled': 'Cancelled' };

            content = '<div style="padding:20px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
                    '<h3 style="font-size:1.1rem;">' + escapeHtml(flightData.airline) + ' ' + escapeHtml(flightData.flight_number) + '</h3>' +
                    '<span style="background:' + statusColor + ';color:white;padding:4px 14px;border-radius:20px;font-size:0.8rem;font-weight:600;">' + (statusLabels[flightData.flight_status] || flightData.flight_status) + '</span>' +
                '</div>' +
                '<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:center;text-align:center;margin-bottom:16px;">' +
                    '<div><strong style="font-size:1.2rem;">' + escapeHtml(flightData.departure_airport) + '</strong><br><small style="color:var(--text-tertiary);">Departure</small></div>' +
                    '<div style="font-size:1.5rem;">→</div>' +
                    '<div><strong style="font-size:1.2rem;">' + escapeHtml(flightData.arrival_airport) + '</strong><br><small style="color:var(--text-tertiary);">Arrival</small></div>' +
                '</div>';

            if (flightData.departure_delay > 0) {
                content += '<div style="background:var(--red-dim);border:1px solid var(--red);border-radius:var(--radius);padding:12px;margin-bottom:12px;color:var(--red);text-align:center;">⚠ Departure delayed by ' + flightData.departure_delay + ' minutes</div>';
            }

            content += '<p style="color:var(--text-secondary);text-align:center;margin-top:12px;">Shipment status has been updated automatically.</p>';
            content += '</div>';
        } else {
            content = '<div style="text-align:center;padding:40px;">' +
                '<div style="font-size:3rem;margin-bottom:16px;">❌</div>' +
                '<h3 style="margin-bottom:8px;">Tracking Failed</h3>' +
                '<p style="color:var(--text-tertiary);">' + escapeHtml(errorMessage || 'Unable to track this flight.') + '</p>' +
                '</div>';
        }

        content += '<div style="text-align:center;padding:16px;border-top:1px solid var(--border-subtle);">' +
            '<button id="closeTrackingModal" style="padding:10px 24px;background:var(--accent);color:#1A2E4A;border:none;border-radius:var(--radius);cursor:pointer;font-weight:600;font-family:Inter,sans-serif;">Close</button>' +
            '</div>';

        modal.innerHTML = '<div style="background:var(--bg-card);border:1px solid var(--border-medium);border-radius:var(--radius-xl);width:90%;max-width:500px;box-shadow:0 20px 60px rgba(0,0,0,0.5);">' + content + '</div>';

        document.body.appendChild(modal);

        document.getElementById('closeTrackingModal').addEventListener('click', function() { modal.remove(); });
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });

        // Auto-close success after 5 seconds
        if (state === 'success') {
            setTimeout(function() { if (document.getElementById('trackingModal')) modal.remove(); }, 5000);
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    return {
        trackFlight: trackFlight,
        setDirector: setDirector
    };

})();
