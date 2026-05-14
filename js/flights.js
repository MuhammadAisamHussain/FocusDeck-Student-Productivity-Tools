// ============================================
// ALS eCargoWorld — Flight Tracker
// ============================================

class FlightTracker {
    constructor(store) {
        this.store = store;
        this.trackingCache = new Map();
    }

    async load() {
        try {
            const flights = await this.store.getFlights();
            this.renderFlightCards(flights);
        } catch (error) {
            console.error('Failed to load flights:', error);
        }
    }

    async pollStatuses() {
        try {
            const flights = await this.store.getFlights({ status: 'departed' });
            
            for (const flight of flights) {
                if (!flight.flight_number) continue;
                
                // Check cache to avoid duplicate API calls
                const cacheKey = flight.flight_number;
                const cached = this.trackingCache.get(cacheKey);
                if (cached && Date.now() - cached.timestamp < 300000) {
                    continue; // Use cached data if less than 5 minutes old
                }

                const status = await this.fetchFlightStatus(flight.flight_number);
                this.trackingCache.set(cacheKey, { status, timestamp: Date.now() });

                if (status && status !== flight.status) {
                    await this.store.updateFlightStatus(flight.id, status);
                    console.log(`Flight ${flight.flight_number} status updated: ${status}`);
                }
            }
            
            // Reload if on flights screen
            if (window.app && window.app.currentScreen === 'flights') {
                this.load();
            }
        } catch (error) {
            console.error('Flight polling error:', error);
        }
    }

    async fetchFlightStatus(flightNumber) {
        // This would connect to FlightAware API or similar
        // For now, simulate with realistic behavior
        try {
            // In production:
            // const response = await fetch(`https://aeroapi.flightaware.com/aeroapi/flights/${flightNumber}`, {
            //     headers: { 'x-apikey': 'YOUR_API_KEY' }
            // });
            // const data = await response.json();
            // return data.flights[0]?.status?.toLowerCase();
            
            // Simulated response for development
            return this.simulateFlightStatus(flightNumber);
        } catch (error) {
            console.error('Flight status fetch failed:', error);
            return null;
        }
    }

    simulateFlightStatus(flightNumber) {
        // Deterministic simulation based on flight number
        const hash = flightNumber.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const statuses = ['scheduled', 'departed', 'arrived'];
        return statuses[hash % statuses.length];
    }

    renderFlightCards(flights) {
        const grid = document.getElementById('flightGrid');
        if (!grid) return;

        if (!flights.length) {
            grid.innerHTML = `
                <div class="empty-state full-width">
                    <p>No flights being tracked. Add a flight number to a shipment to start tracking.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = flights.map(f => this.renderFlightCard(f)).join('');
    }

    renderFlightCard(flight) {
        const statusInfo = this.getFlightStatusInfo(flight.status);
        const progressWidth = this.getProgressWidth(flight.status);

        return `
            <div class="flight-card" data-id="${flight.id}">
                <div class="flight-card-top">
                    <div class="flight-airline">
                        <span class="airline-code">${this.escapeHtml(flight.airline || 'N/A')}</span>
                        <span class="flight-number">${this.escapeHtml(flight.flight_number || '—')}</span>
                    </div>
                    <div class="flight-status-badge" style="background: ${statusInfo.bg}; color: ${statusInfo.color}">
                        ${statusInfo.label}
                    </div>
                </div>
                <div class="flight-route">
                    <div class="flight-origin">
                        <span class="airport-code">${this.escapeHtml(flight.origin)}</span>
                    </div>
                    <div class="flight-path">
                        <div class="flight-progress-bar">
                            <div class="flight-progress-fill" style="width: ${progressWidth}%"></div>
                            <div class="flight-progress-dot" style="left: ${progressWidth}%"></div>
                        </div>
                    </div>
                    <div class="flight-destination">
                        <span class="airport-code">${this.escapeHtml(flight.destination)}</span>
                    </div>
                </div>
                <div class="flight-card-bottom">
                    <div class="flight-info-item">
                        <span class="flight-info-label">Shipment</span>
                        <span class="flight-info-value">${this.escapeHtml(flight.awb_number || '—')}</span>
                    </div>
                    <div class="flight-info-item">
                        <span class="flight-info-label">Customer</span>
                        <span class="flight-info-value">${this.escapeHtml(flight.customer_name || '—')}</span>
                    </div>
                </div>
            </div>
        `;
    }

    getFlightStatusInfo(status) {
        const map = {
            draft: { label: 'Pending', bg: 'rgba(156, 163, 175, 0.1)', color: '#9ca3af' },
            confirmed: { label: 'Confirmed', bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' },
            booked: { label: 'Scheduled', bg: 'rgba(245, 166, 35, 0.1)', color: '#F5A623' },
            departed: { label: 'In Flight', bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' },
            arrived: { label: 'Landed', bg: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' },
            delivered: { label: 'Delivered', bg: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }
        };
        return map[status] || map.draft;
    }

    getProgressWidth(status) {
        const map = {
            draft: 5,
            confirmed: 15,
            booked: 25,
            departed: 60,
            arrived: 90,
            delivered: 100
        };
        return map[status] || 5;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export { FlightTracker };
