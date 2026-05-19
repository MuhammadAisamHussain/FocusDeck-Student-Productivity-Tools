// ============================================
// eCargoWorld — Flight Tracker
// AviationStack API Integration — Director Only
// ============================================

var FlightTracker = (function() {
    'use strict';

    var AVIATIONSTACK_KEY = 'a64c5436fa799b0514c87c5e44653214';
    var db = window.supabase;
    var isDirector = false;

    function setDirector(status) { isDirector = status; }

    async function trackFlight(shipmentId, flightNumber) {
        if (!flightNumber) {
            alert('No flight number set for this shipment.');
            return;
        }
        if (!isDirector) {
            alert('Flight tracking is only available to the Director.');
            return;
        }

        showTrackingModal(shipmentId, flightNumber, 'loading');

        try {
            var status = await fetchFlightStatus(flightNumber);
            if (status) {
                var statusMap = {
                    'scheduled': 'booked', 'active': 'departed', 'landed': 'arrived',
                    'cancelled': 'cancelled', 'diverted': 'departed'
                };
                var newStatus = statusMap[status.flight_status] || null;
                if (newStatus) {
                    await db.from('shipments').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', shipmentId);
                    if (status.departure_delay && status.departure_delay > 0) {
                        var empResult = await db.from('profiles').select('id').eq('role', 'employee').limit(1);
                        var assigneeId = empResult.data && empResult.data.length > 0 ? empResult.data[0].id : null;
                        var deadline = new Date();
                        deadline.setMinutes(deadline.getMinutes() + 30);
                        await db.from('tasks').insert({
                            name: 'URGENT: Notify customer of flight delay (' + flightNumber + ')',
                            task_type: 'flight_delayed', shipment_id: shipmentId,
                            assigned_to: assigneeId, deadline: deadline.toISOString(),
                            status: 'pending', priority: 'critical', created_by: 'system',
                            created_at: new Date().toISOString()
                        });
                    }
                }
                showTrackingModal(shipmentId, flightNumber, 'success', status);
            } else {
                showTrackingModal(shipmentId, flightNumber, 'error', null, 'Flight not found.');
            }
        } catch (e) {
            showTrackingModal(shipmentId, flightNumber, 'error', null, 'Tracking failed: ' + e.message);
        }
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
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;z-index:1000;';
        
        var content = '';
        if (state === 'loading') {
            content = '<div style="text-align:center;padding:40px;"><h3>Tracking ' + escapeHtml(flightNumber) + '</h3><p style="color:#9a9a9a;">Fetching live data...</p></div>';
        } else if (state === 'success' && flightData) {
            var sc = { 'scheduled': '#3b82f6', 'active': '#f59e0b', 'landed': '#22c55e', 'cancelled': '#e5484d' };
            var sl = { 'scheduled': 'Scheduled', 'active': 'In Flight', 'landed': 'Landed', 'cancelled': 'Cancelled' };
            content = '<div style="padding:20px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
                    '<h3 style="font-size:1.1rem;">' + escapeHtml(flightData.airline) + ' ' + escapeHtml(flightData.flight_number) + '</h3>' +
                    '<span style="background:' + (sc[flightData.flight_status] || '#9a9a9a') + ';color:#fff;padding:4px 14px;border-radius:20px;font-size:0.8rem;font-weight:600;">' + (sl[flightData.flight_status] || flightData.flight_status) + '</span></div>' +
                '<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:16px;text-align:center;">' +
                    '<div><strong>' + escapeHtml(flightData.departure_airport) + '</strong><br><small style="color:#9a9a9a;">Departure</small></div>' +
                    '<div style="font-size:1.5rem;">→</div>' +
                    '<div><strong>' + escapeHtml(flightData.arrival_airport) + '</strong><br><small style="color:#9a9a9a;">Arrival</small></div></div>';
            if (flightData.departure_delay > 0) {
                content += '<div style="background:#fef2f2;border:1px solid #fecaca;padding:12px;margin-top:12px;color:#e5484d;text-align:center;border-radius:8px;">Departure delayed by ' + flightData.departure_delay + ' min</div>';
            }
            content += '<p style="color:#6b6b6b;text-align:center;margin-top:12px;">Status updated.</p></div>';
        } else {
            content = '<div style="text-align:center;padding:40px;"><h3>Tracking Failed</h3><p style="color:#9a9a9a;">' + escapeHtml(errorMessage || 'Unable to track.') + '</p></div>';
        }

        content += '<div style="text-align:center;padding:16px;border-top:1px solid #e5e5e5;"><button id="closeTrackingModal" style="padding:10px 24px;background:#F5A623;color:#1a1a1a;border:none;border-radius:4px;cursor:pointer;font-weight:600;font-family:Inter,sans-serif;">Close</button></div>';
        modal.innerHTML = '<div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;width:90%;max-width:500px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">' + content + '</div>';
        document.body.appendChild(modal);

        document.getElementById('closeTrackingModal').addEventListener('click', function() { modal.remove(); });
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
        if (state === 'success') { setTimeout(function() { if (document.getElementById('trackingModal')) modal.remove(); }, 5000); }
    }

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    return { trackFlight: trackFlight, setDirector: setDirector };
})();
