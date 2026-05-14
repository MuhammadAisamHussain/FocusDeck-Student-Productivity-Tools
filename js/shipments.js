// ============================================
// ALS eCargoWorld — Shipment Manager
// ============================================

class ShipmentManager {
    constructor(store) {
        this.store = store;
        this.currentFilters = {};
    }

    async load() {
        try {
            const shipments = await this.store.getShipments(this.currentFilters);
            this.renderTable(shipments);
            this.bindFilters();
        } catch (error) {
            console.error('Failed to load shipments:', error);
            this.showEmptyState('Error loading shipments. Please try again.');
        }
    }

    async create(data) {
        return await this.store.createShipment(data);
    }

    async update(id, data) {
        return await this.store.updateShipment(id, data);
    }

    async search(query) {
        this.currentFilters.search = query;
        await this.load();
    }

    renderTable(shipments) {
        const tbody = document.getElementById('shipmentTableBody');
        if (!tbody) return;

        if (!shipments.length) {
            this.showEmptyState('No shipments found. Create your first shipment to get started.');
            return;
        }

        tbody.innerHTML = shipments.map(s => this.renderShipmentRow(s)).join('');
        this.bindRowActions();
    }

    renderShipmentRow(s) {
        const statusClass = `status-${s.status}`;
        const profit = (s.revenue || 0) - (s.cost || 0);
        const profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';
        const profitDisplay = profit ? `$${profit.toFixed(2)}` : '—';

        return `
            <tr data-id="${s.id}">
                <td>
                    <span class="awb-mono">${s.awb_number || '—'}</span>
                </td>
                <td>
                    <div class="cell-primary">${this.escapeHtml(s.customer_name)}</div>
                    <div class="cell-secondary">${this.escapeHtml(s.customer_email || '')}</div>
                </td>
                <td>
                    <div class="route-display">
                        <span class="route-code">${s.origin}</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="route-arrow">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                        <span class="route-code">${s.destination}</span>
                    </div>
                </td>
                <td>${s.airline || '—'}</td>
                <td>
                    <span class="weight-display">${s.weight_kg ? s.weight_kg.toFixed(1) + ' kg' : '—'}</span>
                </td>
                <td>
                    <span class="status-badge ${statusClass}">${this.formatStatus(s.status)}</span>
                </td>
                <td class="${profitClass}">
                    <span class="profit-display">${profitDisplay}</span>
                </td>
                <td>
                    <div class="row-actions">
                        <button class="row-action-btn edit-shipment" data-id="${s.id}" title="Edit">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="row-action-btn advance-status" data-id="${s.id}" data-status="${s.status}" title="Advance Status">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    bindRowActions() {
        // Edit shipment
        document.querySelectorAll('.edit-shipment').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                try {
                    const shipment = await this.store.getShipment(id);
                    if (shipment && window.app) {
                        window.app.openShipmentModal(shipment);
                    }
                } catch (error) {
                    console.error('Failed to fetch shipment:', error);
                }
            });
        });

        // Advance status
        document.querySelectorAll('.advance-status').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const currentStatus = btn.dataset.status;
                const nextStatus = this.getNextStatus(currentStatus);
                
                if (!nextStatus) return;

                try {
                    await this.store.updateShipment(id, { status: nextStatus });
                    if (window.app) {
                        window.app.showToast(`Status advanced to ${this.formatStatus(nextStatus)}`);
                    }
                    this.load();
                } catch (error) {
                    console.error('Failed to update status:', error);
                    if (window.app) {
                        window.app.showToast('Failed to update status', 'error');
                    }
                }
            });
        });

        // Click row to view details
        document.querySelectorAll('#shipmentTableBody tr').forEach(row => {
            row.addEventListener('click', async () => {
                const id = row.dataset.id;
                try {
                    const shipment = await this.store.getShipment(id);
                    if (shipment && window.app) {
                        window.app.openShipmentModal(shipment);
                    }
                } catch (error) {
                    console.error('Failed to fetch shipment:', error);
                }
            });
        });
    }

    getNextStatus(current) {
        const flow = ['draft', 'confirmed', 'booked', 'departed', 'arrived', 'delivered'];
        const index = flow.indexOf(current);
        return index < flow.length - 1 ? flow[index + 1] : null;
    }

    formatStatus(status) {
        const labels = {
            draft: 'Draft',
            confirmed: 'Confirmed',
            booked: 'Booked',
            departed: 'Departed',
            arrived: 'Arrived',
            delivered: 'Delivered',
            cancelled: 'Cancelled'
        };
        return labels[status] || status;
    }

    bindFilters() {
        const statusFilter = document.getElementById('filterStatus');
        const routeFilter = document.getElementById('filterRoute');

        statusFilter?.addEventListener('change', () => {
            this.currentFilters.status = statusFilter.value || undefined;
            this.load();
        });

        routeFilter?.addEventListener('change', () => {
            const route = routeFilter.value;
            if (route) {
                const [origin, destination] = route.split('-');
                this.currentFilters.origin = origin;
                this.currentFilters.destination = destination;
            } else {
                delete this.currentFilters.origin;
                delete this.currentFilters.destination;
            }
            this.load();
        });
    }

    showEmptyState(message) {
        const tbody = document.getElementById('shipmentTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state">
                        <p>${message}</p>
                        <button class="btn btn-amber" onclick="document.getElementById('btnNewShipment').click()">
                            Create New Shipment
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export { ShipmentManager };
