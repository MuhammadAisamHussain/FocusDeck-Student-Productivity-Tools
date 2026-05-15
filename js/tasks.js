// ============================================
// eCargoWorld — Task Manager & Delegation
// ============================================

var TaskManager = (function() {
    'use strict';
    var db = window.supabase;

    // Predefined task templates
    var taskTemplates = [
        { name: 'Send email to customer', category: 'communication' },
        { name: 'Call customer for shipment update', category: 'communication' },
        { name: 'Send flight details to customer', category: 'communication' },
        { name: 'Send departure confirmation', category: 'communication' },
        { name: 'Send arrival notice', category: 'communication' },
        { name: 'Give documents to customs broker', category: 'documents' },
        { name: 'Prepare shipping documents', category: 'documents' },
        { name: 'Verify shipment details', category: 'verification' },
        { name: 'Update AWB in system', category: 'data' },
        { name: 'Collect payment from customer', category: 'finance' },
        { name: 'Coordinate with warehouse', category: 'operations' },
        { name: 'Arrange pickup from shipper', category: 'operations' },
        { name: 'Track flight status', category: 'operations' },
        { name: 'Custom task', category: 'custom' }
    ];

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDeadline(d) {
        var deadline = new Date(d);
        var now = new Date();
        var diff = deadline - now;
        if (diff < 0) return 'Overdue';
        var hours = Math.floor(diff / 3600000);
        if (hours < 24) return hours + 'h remaining';
        return Math.floor(hours / 24) + 'd remaining';
    }

    // Open delegation modal
    function openDelegateModal() {
        var existing = document.getElementById('delegateModal');
        if (existing) existing.remove();

        var modal = document.createElement('div');
        modal.id = 'delegateModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:1000;';

        var taskOptions = taskTemplates.map(function(t) {
            return '<option value="' + escapeHtml(t.name) + '">' + escapeHtml(t.name) + '</option>';
        }).join('');

        modal.innerHTML = '<div style="background:var(--bg-card);border:1px solid var(--border-medium);border-radius:var(--radius-xl);padding:28px;width:90%;max-width:550px;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
                '<h3 style="font-size:1.1rem;font-weight:700;">Delegate Task</h3>' +
                '<button id="closeDelegateModal" style="background:none;border:none;color:var(--text-tertiary);font-size:1.5rem;cursor:pointer;">&times;</button>' +
            '</div>' +
            '<form id="delegateForm">' +
                '<div style="margin-bottom:16px;">' +
                    '<label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Task Type</label>' +
                    '<select id="dtTaskType" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;font-size:0.9rem;">' + taskOptions + '</select>' +
                '</div>' +
                '<div style="margin-bottom:16px;">' +
                    '<label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Custom Task Name (optional)</label>' +
                    '<input type="text" id="dtCustomName" placeholder="Or type a custom task..." style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;">' +
                '</div>' +
                '<div style="margin-bottom:16px;">' +
                    '<label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Assign To *</label>' +
                    '<select id="dtAssignee" required style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"><option value="">Select employee...</option></select>' +
                '</div>' +
                '<div style="margin-bottom:16px;">' +
                    '<label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Linked Shipment (optional)</label>' +
                    '<select id="dtShipment" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"><option value="">None</option></select>' +
                '</div>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Deadline *</label><input type="datetime-local" id="dtDeadline" required style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"></div>' +
                    '<div><label style="display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:4px;">Priority</label><select id="dtPriority" style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius);color:var(--text-primary);font-family:inherit;"><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option><option value="low">Low</option></select></div>' +
                '</div>' +
                '<div style="display:flex;justify-content:flex-end;gap:10px;">' +
                    '<button type="button" id="cancelDelegateBtn" style="padding:10px 20px;background:transparent;border:1px solid var(--border-medium);color:var(--text-primary);border-radius:var(--radius);cursor:pointer;font-family:inherit;">Cancel</button>' +
                    '<button type="submit" style="padding:10px 20px;background:var(--accent);color:#1A2E4A;border:none;border-radius:var(--radius);cursor:pointer;font-weight:600;font-family:inherit;">Assign Task</button>' +
                '</div>' +
            '</form>' +
        '</div>';

        document.body.appendChild(modal);

        // Load employees
        loadEmployeesIntoSelect('dtAssignee');
        // Load shipments
        loadShipmentsIntoSelect('dtShipment');
        // Set default deadline (tomorrow)
        var tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById('dtDeadline').value = tomorrow.toISOString().slice(0, 16);

        // Close handlers
        document.getElementById('closeDelegateModal').addEventListener('click', function() { modal.remove(); });
        document.getElementById('cancelDelegateBtn').addEventListener('click', function() { modal.remove(); });
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });

        // Submit
        document.getElementById('delegateForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            var submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Assigning...';

            var customName = document.getElementById('dtCustomName').value.trim();
            var taskName = customName || document.getElementById('dtTaskType').value;
            var assigneeId = document.getElementById('dtAssignee').value;
            var shipmentId = document.getElementById('dtShipment').value || null;
            var deadline = document.getElementById('dtDeadline').value;
            var priority = document.getElementById('dtPriority').value;

            try {
                var result = await db.from('tasks').insert({
                    name: taskName,
                    task_type: 'delegated',
                    shipment_id: shipmentId,
                    assigned_to: assigneeId,
                    deadline: new Date(deadline).toISOString(),
                    status: 'pending',
                    priority: priority,
                    created_by: 'manager',
                    created_at: new Date().toISOString()
                });

                if (result.error) throw result.error;

                modal.remove();
                if (typeof loadTasks === 'function') loadTasks();
                if (typeof loadDashboardOverview === 'function') loadDashboardOverview();
                showToast('Task assigned successfully!');
            } catch(err) {
                alert('Error: ' + err.message);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Assign Task';
            }
        });
    }

    async function loadEmployeesIntoSelect(selectId) {
        var select = document.getElementById(selectId);
        if (!select) return;
        var result = await db.from('profiles').select('id, full_name').eq('role', 'employee');
        if (result.data) {
            result.data.forEach(function(emp) {
                var opt = document.createElement('option');
                opt.value = emp.id;
                opt.textContent = emp.full_name || 'Employee';
                select.appendChild(opt);
            });
        }
    }

    async function loadShipmentsIntoSelect(selectId) {
        var select = document.getElementById(selectId);
        if (!select) return;
        var result = await db.from('shipments').select('id, awb_number, customer_name').order('created_at', { ascending: false }).limit(20);
        if (result.data) {
            result.data.forEach(function(s) {
                var opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = (s.awb_number || 'Draft') + ' - ' + (s.customer_name || 'Unknown');
                select.appendChild(opt);
            });
        }
    }

    function showToast(message, type) {
        type = type || 'success';
        var toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = 'position:fixed;bottom:30px;right:30px;background:' + (type === 'error' ? '#ef4444' : '#22c55e') + ';color:white;padding:14px 24px;border-radius:10px;font-family:Inter,sans-serif;font-weight:500;font-size:0.9rem;z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,0.4);animation:toastIn 0.3s ease-out;';
        document.body.appendChild(toast);
        setTimeout(function() { toast.style.animation = 'toastOut 0.3s ease-in'; setTimeout(function() { toast.remove(); }, 300); }, 3500);
    }

    return {
        openDelegateModal: openDelegateModal,
        taskTemplates: taskTemplates,
        formatDeadline: formatDeadline
    };

})();
