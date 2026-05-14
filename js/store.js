// ============================================
// ALS eCargoWorld — Data Store
// All database operations centralized here
// ============================================

import { supabase } from './supabase.js';

class Store {
    constructor(supabaseClient) {
        this.db = supabaseClient;
        this.cache = new Map();
        this.cacheTimeout = 30000;
    }

    getCached(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        this.cache.delete(key);
        return null;
    }

    setCache(key, data) {
        this.cache.set(key, { data, timestamp: Date.now() });
    }

    bustCache(keyPattern) {
        for (const key of this.cache.keys()) {
            if (key.includes(keyPattern)) {
                this.cache.delete(key);
            }
        }
    }

    // ============ SETTINGS ============
    async getSettings() {
        const cached = this.getCached('settings');
        if (cached) return cached;

        const { data, error } = await this.db
            .from('settings')
            .select('*')
            .single();

        if (error) {
            console.error('Error fetching settings:', error);
            return this.getDefaultSettings();
        }

        this.setCache('settings', data);
        return data;
    }

    async updateSettings(settings) {
        const { data, error } = await this.db
            .from('settings')
            .upsert({ id: 1, ...settings, updated_at: new Date().toISOString() });

        if (error) throw error;
        this.bustCache('settings');
        return data;
    }

    getDefaultSettings() {
        return {
            company_name: 'ALS eCargoWorld',
            company_email: 'info@alsecargoworld.com',
            company_phone: '+92 300 0000000',
            company_address: 'Lahore, Pakistan',
            usd_pkr_rate: 278.50,
            logo_ecw_url: '',
            logo_als_url: '',
            hero_image_url: '',
            why_us_image_url: '',
            service_air_url: '',
            service_sea_url: '',
            service_customs_url: '',
            service_warehouse_url: ''
        };
    }

    async getExchangeRate() {
        const settings = await this.getSettings();
        return settings?.usd_pkr_rate || 278.50;
    }

    // ============ SHIPMENTS ============
    async getShipments(filters = {}) {
        let query = this.db.from('shipments').select('*');

        if (filters.status) query = query.eq('status', filters.status);
        if (filters.origin) query = query.eq('origin', filters.origin);
        if (filters.destination) query = query.eq('destination', filters.destination);
        if (filters.search) {
            query = query.or(
                `awb_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,flight_number.ilike.%${filters.search}%`
            );
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    async getShipment(id) {
        const { data, error } = await this.db.from('shipments').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
    }

    async createShipment(shipmentData) {
        const awb = await this.generateAWB();
        const { data, error } = await this.db
            .from('shipments')
            .insert({
                ...shipmentData,
                awb_number: awb,
                status: shipmentData.status || 'draft',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        await this.createTaskFromTrigger('shipment_created', data);
        this.bustCache('shipments');
        return data;
    }

    async updateShipment(id, updates) {
        const oldData = await this.getShipment(id);
        const { data, error } = await this.db
            .from('shipments')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        if (updates.status && updates.status !== oldData.status) {
            await this.createTaskFromTrigger('status_changed', data, oldData.status);
        }
        this.bustCache('shipments');
        return data;
    }

    async deleteShipment(id) {
        const { error } = await this.db.from('shipments').delete().eq('id', id);
        if (error) throw error;
        this.bustCache('shipments');
    }

    async generateAWB() {
        const prefix = '176';
        const random = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
        const awb = `${prefix}-${random.slice(0, 4)}-${random.slice(4, 8)}`;
        const { data } = await this.db.from('shipments').select('id').eq('awb_number', awb).single();
        if (data) return this.generateAWB();
        return awb;
    }

    // ============ TASKS ============
    async getTasks(filters = {}) {
        let query = this.db.from('tasks').select('*, shipments(awb_number, customer_name, origin, destination)');

        if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to);
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.priority) query = query.eq('priority', filters.priority);

        const { data, error } = await query.order('deadline', { ascending: true });
        if (error) throw error;
        return data || [];
    }

    async createTask(taskData) {
        const { data, error } = await this.db
            .from('tasks')
            .insert({ ...taskData, status: 'pending', created_at: new Date().toISOString() })
            .select()
            .single();
        if (error) throw error;
        this.bustCache('tasks');
        return data;
    }

    async updateTask(id, updates) {
        const { data, error } = await this.db
            .from('tasks')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        this.bustCache('tasks');
        return data;
    }

    async deleteTask(id) {
        const { error } = await this.db.from('tasks').delete().eq('id', id);
        if (error) throw error;
        this.bustCache('tasks');
    }

    async createTaskFromTrigger(trigger, shipment, oldStatus = null) {
        const templates = [
            { trigger: 'shipment_created', type: 'verify_details', name: 'Verify shipment details', deadline_hours: 1, priority: 'high' },
            { trigger: 'status_changed', type: 'booking_confirmed', name: 'Send flight details to customer', deadline_hours: 2, priority: 'high', requiredStatus: 'booked' },
            { trigger: 'status_changed', type: 'departure_notice', name: 'Send departure confirmation', deadline_hours: 1, priority: 'high', requiredStatus: 'departed' },
            { trigger: 'status_changed', type: 'arrival_notice', name: 'Send arrival notice', deadline_hours: 1, priority: 'high', requiredStatus: 'arrived' },
            { trigger: 'flight_delayed', type: 'delay_notification', name: 'Notify customer of delay', deadline_hours: 0.5, priority: 'critical' },
            { trigger: 'rate_expiring', type: 'renew_rate', name: 'Request new rate sheet from airline', deadline_hours: 120, priority: 'medium' }
        ];

        const relevant = templates.filter(t => {
            if (t.trigger !== trigger) return false;
            if (t.requiredStatus && shipment.status !== t.requiredStatus) return false;
            return true;
        });

        for (const template of relevant) {
            const { data: existing } = await this.db
                .from('tasks')
                .select('id')
                .eq('shipment_id', shipment.id)
                .eq('task_type', template.type)
                .eq('status', 'pending')
                .single();

            if (!existing) {
                const deadline = new Date();
                deadline.setHours(deadline.getHours() + template.deadline_hours);
                await this.createTask({
                    name: template.name,
                    task_type: template.type,
                    shipment_id: shipment.id,
                    assigned_to: await this.getDefaultAssignee(shipment),
                    deadline: deadline.toISOString(),
                    priority: template.priority,
                    created_by: 'system'
                });
            }
        }
    }

    async getDefaultAssignee(shipment) {
        const { data: employees } = await this.db.from('profiles').select('id').eq('role', 'employee').limit(1);
        return employees?.[0]?.id || null;
    }

    async getEmployees() {
        const { data, error } = await this.db.from('profiles').select('*').eq('role', 'employee');
        if (error) throw error;
        return data || [];
    }

    // ============ AIRLINE RATES ============
    async getRates(filters = {}) {
        let query = this.db.from('airline_rates').select('*');
        if (filters.airline) query = query.eq('airline', filters.airline);
        if (filters.origin) query = query.eq('origin', filters.origin);
        if (filters.destination) query = query.eq('destination', filters.destination);
        if (filters.cargo_type) query = query.eq('cargo_type', filters.cargo_type);

        const { data, error } = await query.order('rate_per_kg_usd', { ascending: true });
        if (error) throw error;
        return data || [];
    }

    async createRate(rateData) {
        const { data, error } = await this.db
            .from('airline_rates')
            .insert({ ...rateData, created_at: new Date().toISOString() })
            .select()
            .single();
        if (error) throw error;
        this.bustCache('rates');
        return data;
    }

    async updateRate(id, updates) {
        const { data, error } = await this.db.from('airline_rates').update(updates).eq('id', id).select().single();
        if (error) throw error;
        this.bustCache('rates');
        return data;
    }

    async deleteRate(id) {
        const { error } = await this.db.from('airline_rates').delete().eq('id', id);
        if (error) throw error;
        this.bustCache('rates');
    }

    async findBestRate(origin, destination, cargoType, weight) {
        const rates = await this.getRates({ origin, destination, cargo_type: cargoType });
        if (!rates.length) return null;

        const validRates = rates.filter(r => !r.valid_until || new Date(r.valid_until) > new Date());
        validRates.sort((a, b) => (a.rate_per_kg_usd + (a.surcharges || 0)) - (b.rate_per_kg_usd + (b.surcharges || 0)));

        const best = validRates[0];
        if (!best) return null;

        const usdPkrRate = await this.getExchangeRate();
        const baseCost = best.rate_per_kg_usd * weight;
        const surcharges = (best.surcharges || 0) * weight;
        const totalUsd = baseCost + surcharges;
        const totalPkr = totalUsd * usdPkrRate;

        return {
            rate: best,
            weight,
            base_cost_usd: baseCost,
            surcharges_usd: surcharges,
            total_usd: totalUsd,
            total_pkr: totalPkr,
            usd_pkr_rate: usdPkrRate
        };
    }

    // ============ FLIGHTS ============
    async getFlights(filters = {}) {
        let query = this.db
            .from('shipments')
            .select('id, awb_number, flight_number, airline, status, origin, destination, customer_name')
            .not('flight_number', 'is', null);

        if (filters.status) query = query.eq('status', filters.status);
        const { data, error } = await query.order('updated_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    async updateFlightStatus(shipmentId, flightStatus) {
        const statusMap = { 'scheduled': 'booked', 'departed': 'departed', 'arrived': 'arrived' };
        const newStatus = statusMap[flightStatus] || null;
        const updates = {};
        if (newStatus) updates.status = newStatus;

        if (flightStatus === 'delayed') {
            const shipment = await this.getShipment(shipmentId);
            await this.createTaskFromTrigger('flight_delayed', shipment);
        }

        if (Object.keys(updates).length > 0) {
            return this.updateShipment(shipmentId, updates);
        }
        return null;
    }

    // ============ PROFILES ============
    async getCurrentUser() {
        const { data: { user } } = await this.db.auth.getUser();
        if (!user) return null;
        const { data: profile } = await this.db.from('profiles').select('*').eq('id', user.id).single();
        return profile || null;
    }

    async getProfiles() {
        const { data, error } = await this.db.from('profiles').select('*').order('full_name');
        if (error) throw error;
        return data || [];
    }

    // ============ STORAGE HELPERS (FIXED: using 'assets' bucket) ============
    async uploadImage(filePath, file) {
        const { data, error } = await this.db.storage
            .from('assets')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (error) throw error;

        const { data: { publicUrl } } = this.db.storage
            .from('assets')
            .getPublicUrl(filePath);

        return publicUrl;
    }

    async deleteImage(filePath) {
        const { error } = await this.db.storage
            .from('assets')
            .remove([filePath]);

        if (error) throw error;
    }

    // ============ PROFIT ============
    async getProfitSummary(period = 'month') {
        const now = new Date();
        let startDate;
        switch (period) {
            case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
            case 'year': startDate = new Date(now.getFullYear(), 0, 1); break;
            default: startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        const { data: shipments } = await this.db
            .from('shipments')
            .select('revenue, cost')
            .gte('created_at', startDate.toISOString())
            .not('revenue', 'is', null);

        if (!shipments) return { totalRevenue: 0, totalCost: 0, totalProfit: 0, count: 0, avgMargin: 0 };

        const summary = shipments.reduce((acc, s) => {
            acc.totalRevenue += (s.revenue || 0);
            acc.totalCost += (s.cost || 0);
            acc.count += 1;
            return acc;
        }, { totalRevenue: 0, totalCost: 0, count: 0 });

        summary.totalProfit = summary.totalRevenue - summary.totalCost;
        summary.avgMargin = summary.totalRevenue > 0 ? ((summary.totalProfit / summary.totalRevenue) * 100) : 0;
        return summary;
    }

    async getProfitByRoute() {
        const { data } = await this.db.from('shipments').select('origin, destination, revenue, cost').not('revenue', 'is', null);
        if (!data) return [];

        const routeMap = {};
        data.forEach(s => {
            const route = `${s.origin}-${s.destination}`;
            if (!routeMap[route]) routeMap[route] = { route, revenue: 0, cost: 0, count: 0 };
            routeMap[route].revenue += (s.revenue || 0);
            routeMap[route].cost += (s.cost || 0);
            routeMap[route].count += 1;
        });

        return Object.values(routeMap)
            .map(r => ({ ...r, profit: r.revenue - r.cost, margin: r.revenue > 0 ? ((r.revenue - r.cost) / r.revenue * 100) : 0 }))
            .sort((a, b) => b.profit - a.profit);
    }
}

export { Store };
