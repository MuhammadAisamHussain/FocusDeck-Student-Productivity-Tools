// ============================================
// ALS eCargoWorld — App Controller
// ============================================

import { supabase } from './supabase.js';
import { Store } from './store.js';
import { ShipmentManager } from './shipments.js';
import { TaskEngine } from './tasks.js';
import { FlightTracker } from './flights.js';
import { RateManager } from './rates.js';

class App {
    constructor() {
        this.currentScreen = 'dashboard';
        this.store = new Store(supabase);
        this.shipments = new ShipmentManager(this.store);
        this.tasks = new TaskEngine(this.store);
        this.flights = new FlightTracker(this.store);
        this.rates = new RateManager(this.store);
        
        this.init();
    }

    init() {
        this.bindNavigation();
        this.bindGlobalSearch();
        this.bindModals();
        this.loadDashboard();
        this.startLiveUpdates();
    }

    // Navigation
    bindNavigation() {
        document.querySelectorAll('.cmd-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const screen = item.dataset.screen;
                this.switchScreen(screen);
            });
        });
    }

    switchScreen(screenName) {
        // Update nav
        document.querySelectorAll('.cmd-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.screen === screenName);
        });

        // Update screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.toggle('active', screen.id === `screen${this.capitalize(screenName)}`);
        });

        this.currentScreen = screenName;
        
        // Load screen-specific data
        switch(screenName) {
            case 'dashboard': this.loadDashboard(); break;
            case 'shipments': this.shipments.load(); break;
            case 'flights': this.flights.load(); break;
            case 'tasks': this.tasks.load(); break;
            case 'rates': this.rates.load(); break;
        }
    }

    // Global Search
    bindGlobalSearch() {
        const searchInput = document.getElementById('globalSearch');
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            if (query.length < 2) return;
            
            // Search across shipments
            this.shipments.search(query);
        });
    }

    // Modals
    bindModals() {
        const modal = document.getElementById('shipmentModal');
        const closeBtn = document.getElementById('closeModal');
        const cancelBtn = document.getElementById('cancelShipment');
        const newBtn = document.getElementById('btnNewShipment');
        const saveBtn = document.getElementById('saveShipment');

        newBtn?.addEventListener('click', () => this.openShipmentModal());
        closeBtn?.addEventListener('click', () => this.closeModal(modal));
        cancelBtn?.addEventListener('click', () => this.closeModal(modal));
        saveBtn?.addEventListener('click', () => this.saveShipment());

        // Close on overlay click
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal(modal);
        });
    }

    openShipmentModal(shipmentData = null) {
        const modal = document.getElementById('shipmentModal');
        const title = document.getElementById('modalTitle');
        
        if (shipmentData) {
            title.textContent = 'Edit Shipment';
            this.populateShipmentForm(shipmentData);
        } else {
            title.textContent = 'New Shipment';
            document.getElementById('shipmentForm').reset();
        }
        
        modal.classList.add('active');
    }

    closeModal(modal) {
        modal.classList.remove('active');
    }

    populateShipmentForm(data) {
        document.getElementById('shipCustomerName').value = data.customer_name || '';
        document.getElementById('shipCustomerEmail').value = data.customer_email || '';
        document.getElementById('shipCustomerPhone').value = data.customer_phone || '';
        document.getElementById('shipOrigin').value = data.origin || '';
        document.getElementById('shipDestination').value = data.destination || '';
        document.getElementById('shipWeight').value = data.weight_kg || '';
        document.getElementById('shipPieces').value = data.pieces || 1;
        document.getElementById('shipCargoType').value = data.cargo_type || 'general';
        document.getElementById('shipAirline').value = data.airline || '';
        document.getElementById('shipRevenue').value = data.revenue || '';
        document.getElementById('shipCost').value = data.cost || '';
    }

    async saveShipment() {
        const form = document.getElementById('shipmentForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const data = {
            customer_name: document.getElementById('shipCustomerName').value,
            customer_email: document.getElementById('shipCustomerEmail').value,
            customer_phone: document.getElementById('shipCustomerPhone').value,
            origin: document.getElementById('shipOrigin').value,
            destination: document.getElementById('shipDestination').value,
            weight_kg: parseFloat(document.getElementById('shipWeight').value),
            pieces: parseInt(document.getElementById('shipPieces').value),
            cargo_type: document.getElementById('shipCargoType').value,
            airline: document.getElementById('shipAirline').value,
            revenue: parseFloat(document.getElementById('shipRevenue').value) || 0,
            cost: parseFloat(document.getElementById('shipCost').value) || 0,
            status: 'draft'
        };

        try {
            await this.shipments.create(data);
            this.closeModal(document.getElementById('shipmentModal'));
            this.showToast('Shipment created successfully');
            if (this.currentScreen === 'shipments') {
                this.shipments.load();
            }
            this.loadDashboard();
        } catch (error) {
            this.showToast('Error creating shipment: ' + error.message, 'error');
        }
    }

    // Dashboard
    async loadDashboard() {
        // This would fetch real data from Supabase
        // For now, the static dashboard is displayed
        console.log('Dashboard loaded');
        
        // Update rate ticker
        try {
            const rate = await this.store.getExchangeRate();
            if (rate) {
                document.getElementById('liveRate').textContent = rate.toFixed(2);
            }
        } catch (e) {
            console.log('Using default rate');
        }
    }

    // Live updates
    startLiveUpdates() {
        // Poll for flight status updates every 5 minutes
        setInterval(() => {
            this.flights.pollStatuses();
        }, 300000);

        // Refresh dashboard data every 2 minutes
        setInterval(() => {
            if (this.currentScreen === 'dashboard') {
                this.loadDashboard();
            }
        }, 120000);
    }

    // Toast
    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `app-toast app-toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: ${type === 'error' ? '#ef4444' : '#22c55e'};
            color: white;
            padding: 14px 24px;
            border-radius: 10px;
            font-family: 'Inter', sans-serif;
            font-weight: 500;
            font-size: 0.9rem;
            z-index: 9999;
            box-shadow: 0 10px 30px rgba(0,0,0,0.4);
            animation: toastIn 0.3s ease-out;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s ease-in';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

// Toast animations
const toastStyle = document.createElement('style');
toastStyle.textContent = `
    @keyframes toastIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes toastOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(toastStyle);

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
