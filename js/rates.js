// ============================================
// ALS eCargoWorld — Rate Manager & Quote Generator
// ============================================

class RateManager {
    constructor(store) {
        this.store = store;
    }

    async load() {
        try {
            const rates = await this.store.getRates();
            this.renderRatesGrid(rates);
            this.bindRateActions();
        } catch (error) {
            console.error('Failed to load rates:', error);
        }
    }

    async generateQuote(origin, destination, weight, cargoType = 'general') {
        try {
            const quote = await this.store.findBestRate(origin, destination, cargoType, weight);
            
            if (!quote) {
                return {
                    success: false,
                    message: 'No rates available for this route and cargo type.'
                };
            }

            return {
                success: true,
                ...quote
            };
        } catch (error) {
            console.error('Quote generation failed:', error);
            return {
                success: false,
                message: 'Error generating quote. Please try again.'
            };
        }
    }

    renderRatesGrid(rates) {
        const grid = document.getElementById('ratesGrid');
        if (!grid) return;

        if (!rates.length) {
            grid.innerHTML = `
                <div class="empty-state full-width">
                    <p>No rates configured. Add airline rates to enable quote generation.</p>
                    <button class="btn btn-amber" id="btnAddRateEmpty">Add First Rate</button>
                </div>
            `;
            document.getElementById('btnAddRateEmpty')?.addEventListener('click', () => {
                document.getElementById('btnAddRate')?.click();
            });
            return;
        }

        // Group rates by airline
        const grouped = this.groupRatesByAirline(rates);
        
        grid.innerHTML = Object.entries(grouped).map(([airline, airlineRates]) => 
            this.renderAirlineRateGroup(airline, airlineRates)
        ).join('');

        this.bindExpiryWarnings(rates);
    }

    groupRatesByAirline(rates) {
        const grouped = {};
        rates.forEach(rate => {
            if (!grouped[rate.airline]) {
                grouped[rate.airline] = [];
            }
            grouped[rate.airline].push(rate);
        });
        return grouped;
    }

    renderAirlineRateGroup(airline, rates) {
        const airlineNames = {
            'EK': 'Emirates',
            'QR': 'Qatar Airways',
            'TK': 'Turkish Airlines',
            'EY': 'Etihad'
        };
        const airlineName = airlineNames[airline] || airline;
        const bestRate = rates.reduce((min, r) => 
            (r.rate_per_kg_usd + (r.surcharges || 0)) < (min.rate_per_kg_usd + (min.surcharges || 0)) ? r : min
        , rates[0]);

        return `
            <div class="rate-group-card">
                <div class="rate-group-header">
                    <div class="rate-airline-name">
                        <span class="rate-airline-code">${this.escapeHtml(airline)}</span>
                        <span class="rate-airline-full">${this.escapeHtml(airlineName)}</span>
                    </div>
                    <div class="rate-best-badge">
                        Best: $${(bestRate.rate_per_kg_usd + (bestRate.surcharges || 0)).toFixed(2)}/kg
                    </div>
                </div>
                <div class="rate-routes-list">
                    ${rates.map(r => this.renderRateRow(r)).join('')}
                </div>
                <div class="rate-group-footer">
                    <span class="rate-count">${rates.length} route${rates.length > 1 ? 's' : ''}</span>
                    <button class="btn-text rate-add-route" data-airline="${this.escapeHtml(airline)}">
                        + Add Route
                    </button>
                </div>
            </div>
        `;
    }

    renderRateRow(rate) {
        const isExpiring = rate.valid_until && new Date(rate.valid_until) < new Date(Date.now() + 7 * 86400000);
        const isExpired = rate.valid_until && new Date(rate.valid_until) < new Date();
        
        let expiryClass = '';
        let expiryLabel = '';
        if (isExpired) {
            expiryClass = 'rate-expired';
            expiryLabel = 'Expired';
        } else if (isExpiring) {
            expiryClass = 'rate-expiring';
            expiryLabel = 'Expiring soon';
        }

        return `
            <div class="rate-row ${expiryClass}">
                <div class="rate-route">
                    <span class="rate-origin">${this.escapeHtml(rate.origin)}</span>
                    <span class="rate-arrow">→</span>
                    <span class="rate-destination">${this.escapeHtml(rate.destination)}</span>
                </div>
                <div class="rate-details">
                    <span class="rate-cargo-type">${this.escapeHtml(rate.cargo_type || 'general')}</span>
                    <span class="rate-value">$${rate.rate_per_kg_usd?.toFixed(2)}/kg</span>
                    ${rate.surcharges ? `<span class="rate-surcharge">+$${rate.surcharges.toFixed(2)} surcharge</span>` : ''}
                </div>
                <div class="rate-validity">
                    ${expiryLabel ? `<span class="rate-expiry-badge ${expiryClass}">${expiryLabel}</span>` : ''}
                    <span class="rate-valid-date">
                        ${rate.valid_until ? 'Until ' + new Date(rate.valid_until).toLocaleDateString() : 'No expiry'}
                    </span>
                </div>
                <div class="rate-actions">
                    <button class="rate-action-btn edit-rate" data-id="${rate.id}">Edit</button>
                    <button class="rate-action-btn delete-rate" data-id="${rate.id}">Delete</button>
                </div>
            </div>
        `;
    }

    bindRateActions() {
        document.querySelectorAll('.edit-rate').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                // Would open rate edit modal
                console.log('Edit rate:', id);
            });
        });

        document.querySelectorAll('.delete-rate').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (confirm('Delete this rate?')) {
                    try {
                        await this.store.deleteRate(id);
                        if (window.app) window.app.showToast('Rate deleted');
                        this.load();
                    } catch (error) {
                        console.error('Failed to delete rate:', error);
                        if (window.app) window.app.showToast('Failed to delete rate', 'error');
                    }
                }
            });
        });
    }

    bindExpiryWarnings(rates) {
        const expiringRates = rates.filter(r => {
            if (!r.valid_until) return false;
            const daysUntilExpiry = (new Date(r.valid_until) - new Date()) / 86400000;
            return daysUntilExpiry > 0 && daysUntilExpiry <= 7;
        });

        if (expiringRates.length > 0 && window.app) {
            // Show a subtle warning
            console.log(`${expiringRates.length} rates expiring within 7 days`);
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export { RateManager };
