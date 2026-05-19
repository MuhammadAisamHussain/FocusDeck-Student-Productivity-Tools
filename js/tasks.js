// ============================================
// eCargoWorld — Task Manager & Delegation
// ============================================

var TaskManager = (function() {
    'use strict';
    var db = window.supabase;

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

    function openDelegateModal() {
        var existing = document.getElementById('delegateModal');
        if (existing) existing.remove();

        var modal = document.createElement('div');
        modal.id = 'delegateModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;z-index:1000;';

        var taskOptions = taskTemplates.map(function(t) {
            return '<option value="' + escapeHtml(t.name) + '">' + escapeHtml(t.name) + '</option>';
        }).join('');

        modal.innerHTML = '<div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;padding:24px;width:90%;max-width:550px;max-height:85vh;overflow-y:auto;box-shadow:0 4px 24px rgba(0,0,0,0.08);">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
                '<h3 style="font-size:1.1rem;font-weight:700;">Delegate Task</h3>' +
                '<button id="closeDelegateModal" style="background:none;border:none;font-size:1.3rem;color:#9a9a9a;cursor:pointer;">&times;</button>' +
            '</div>' +
            '<form id="delegateForm">' +
                '<div style="margin-bottom:14px;"><label style="display:block;font-size:0.72rem;font-weight:600;color:#6b6b6b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Task Type</label><select id="dtTaskType" style="width:100%;padding:8px 12px;border:1px solid #e5e5e5;border-radius:4px;font-family:inherit;font-size:0.85rem;background:#fff;color:#1a1a1a;">' + taskOptions + '</select></div>' +
                '<div style="margin-bottom:14px;"><label style="display:block;font-size:0.72rem;font-weight:600;color:#6b6b6b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Custom Name (optional)</label><input type="text" id="dtCustomName" placeholder="Or type a custom task..." style="width:100%;padding:8px 12px;border:1px solid #e5e5e5;border-radius:4px;font-family:inherit;font-size:0.85rem;background:#fff;color:#1a1a1a;"></div>' +
                '<div style="margin-bottom:14px;"><label style="display:block;font-size:0.72rem;font-weight:600;color:#6b6b6b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Assign To *</label><select id="dtAssignee" required style="width:100%;padding:8px 12px;border:1px solid #e5e5e5;border-radius:4px;font-family:inherit;font-size:0.85rem;background:#fff;color:#1a1a1a;"><option value="">Select employee...</option></select></div>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">' +
                    '<div><label style="display:block;font-size:0.72rem;font-weight:600;color:#6b6b6b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Deadline *</label><input type="datetime-local" id="dtDeadline" required style="width:100%;padding:8px 12px;border:1px solid #e5e5e5;border-radius:4px;font-family:inherit;font-size:0.85rem;background:#fff;color:#1a1a1a;"></div>' +
                    '<div><label style="display:block;font-size:0.72rem;font-weight:600;color:#6b6b6b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Priority</label><select id="dtPriority" style="width:100%;padding:8px 12px;border:1px solid #e5e5e5;border-radius:4px;font-family:inherit;font-size:0.85rem;background:#fff;color:#1a1a1a;"><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>' +
                '</div>' +
                '<div style="display:flex;justify-content:flex-end;gap:10px;">' +
                    '<button type="button" id="cancelDelegateBtn" style="padding:8px 16px;background:#fff;border:1px solid #e5e5e5;border-radius:4px;cursor:pointer;font-family:inherit;font-size:0.85rem;">Cancel</button>' +
                    '<button type="submit" style="padding:8px 16px;background:#1a1a1a;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;font-family:inherit;font-size:0.85rem;">Assign Task</button>' +
                '</div>' +
            '</form></div>';

        document.body.appendChild(modal);
        loadEmployeesIntoSelect('dtAssignee');
        var tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById('dtDeadline').value = tomorrow.toISOString().slice(0, 16);

        document.getElementById('closeDelegateModal').addEventListener('click', function() { modal.remove(); });
        document.getElementById('cancelDelegateBtn').addEventListener('click', function() { modal.remove(); });
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });

        document.getElementById('delegateForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            var submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true; submitBtn.textContent = 'Assigning...';
            var customName = document.getElementById('dtCustomName').value.trim();
            var taskName = customName || document.getElementById('dtTaskType').value;
            try {
                await db.from('tasks').insert({
                    name: taskName, task_type: 'delegated',
                    assigned_to: document.getElementById('dtAssignee').value,
                    deadline: new Date(document.getElementById('dtDeadline').value).toISOString(),
                    status: 'pending', priority: document.getElementById('dtPriority').value,
                    created_by: 'manager', created_at: new Date().toISOString()
                });
                modal.remove();
                if (typeof window.refreshCurrentScreen === 'function') window.refreshCurrentScreen();
                showToast('Task assigned!');
            } catch(err) { alert('Error: ' + err.message); submitBtn.disabled = false; submitBtn.textContent = 'Assign Task'; }
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

    function showToast(message) {
        var toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = 'position:fixed;bottom:30px;right:30px;background:#22c55e;color:#fff;padding:14px 24px;border-radius:8px;font-family:Inter,sans-serif;font-weight:500;font-size:0.9rem;z-index:9999;';
        document.body.appendChild(toast);
        setTimeout(function() { toast.remove(); }, 3500);
    }

    return { openDelegateModal: openDelegateModal, taskTemplates: taskTemplates };
})();
