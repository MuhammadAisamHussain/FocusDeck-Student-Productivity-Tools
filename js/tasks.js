// ============================================
// ALS eCargoWorld — Task Engine
// ============================================

class TaskEngine {
    constructor(store) {
        this.store = store;
    }

    async load() {
        try {
            const tasks = await this.store.getTasks();
            this.renderBoard(tasks);
            this.bindTaskActions();
        } catch (error) {
            console.error('Failed to load tasks:', error);
        }
    }

    renderBoard(tasks) {
        const columns = {
            overdue: document.getElementById('overdueTasks'),
            today: document.getElementById('todayTasks'),
            upcoming: document.getElementById('upcomingTasks'),
            done: document.getElementById('doneTasks')
        };

        // Clear all columns
        Object.values(columns).forEach(col => {
            if (col) col.innerHTML = '';
        });

        if (!tasks.length) {
            if (columns.overdue) {
                columns.overdue.innerHTML = '<div class="empty-column">No tasks yet</div>';
            }
            return;
        }

        const now = new Date();
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        const categorized = {
            overdue: [],
            today: [],
            upcoming: [],
            done: []
        };

        tasks.forEach(task => {
            if (task.status === 'completed') {
                categorized.done.push(task);
            } else {
                const deadline = new Date(task.deadline);
                if (deadline < now) {
                    categorized.overdue.push(task);
                } else if (deadline <= todayEnd) {
                    categorized.today.push(task);
                } else {
                    categorized.upcoming.push(task);
                }
            }
        });

        // Update column counts
        document.querySelectorAll('.column-count').forEach(countEl => {
            const column = countEl.closest('.task-column');
            if (!column) return;
            const status = column.dataset.status;
            if (categorized[status]) {
                countEl.textContent = categorized[status].length;
            }
        });

        // Render each column
        Object.entries(categorized).forEach(([status, taskList]) => {
            const col = columns[status];
            if (!col) return;

            if (!taskList.length) {
                col.innerHTML = '<div class="empty-column">No tasks</div>';
                return;
            }

            col.innerHTML = taskList.map(task => this.renderTaskCard(task)).join('');
        });
    }

    renderTaskCard(task) {
        const isOverdue = task.status !== 'completed' && new Date(task.deadline) < new Date();
        const cardClass = task.status === 'completed' ? 'task-card completed' : 
                          isOverdue ? 'task-card overdue' : 'task-card';
        
        const priorityIndicator = task.priority === 'critical' ? 'priority-critical' :
                                   task.priority === 'high' ? 'priority-high' :
                                   'priority-normal';

        const shipmentInfo = task.shipments || {};

        return `
            <div class="task-card ${cardClass}" data-id="${task.id}">
                <div class="task-priority ${priorityIndicator}"></div>
                <div class="task-card-body">
                    <div class="task-card-header">
                        <span class="task-type">${this.formatTaskType(task.task_type)}</span>
                        ${task.status !== 'completed' ? 
                            `<button class="task-complete-btn" data-id="${task.id}" title="Mark complete">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                            </button>` : ''
                        }
                    </div>
                    <p class="task-name">${this.escapeHtml(task.name)}</p>
                    ${shipmentInfo.awb_number ? 
                        `<span class="task-awb">AWB: ${this.escapeHtml(shipmentInfo.awb_number)}</span>` : ''}
                    ${shipmentInfo.customer_name ? 
                        `<span class="task-customer">${this.escapeHtml(shipmentInfo.customer_name)}</span>` : ''}
                    <div class="task-meta">
                        <span class="task-deadline ${isOverdue ? 'deadline-overdue' : ''}">
                            ${this.formatDeadline(task.deadline)}
                        </span>
                        ${task.assigned_to ? 
                            `<span class="task-assignee">Assigned to: ${this.escapeHtml(task.assigned_to_name || 'Employee')}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    bindTaskActions() {
        // Complete task
        document.querySelectorAll('.task-complete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const taskId = btn.dataset.id;
                try {
                    await this.store.updateTask(taskId, { 
                        status: 'completed',
                        completed_at: new Date().toISOString()
                    });
                    if (window.app) {
                        window.app.showToast('Task marked as complete');
                    }
                    this.load();
                } catch (error) {
                    console.error('Failed to complete task:', error);
                }
            });
        });

        // Click card to expand
        document.querySelectorAll('.task-card').forEach(card => {
            card.addEventListener('click', () => {
                card.classList.toggle('expanded');
            });
        });
    }

    async delegateTask(taskData) {
        return await this.store.createTask(taskData);
    }

    formatTaskType(type) {
        const types = {
            verify_details: 'Verification',
            booking_confirmed: 'Customer Notice',
            departure_notice: 'Departure Notice',
            arrival_notice: 'Arrival Notice',
            delay_notification: 'Delay Alert',
            renew_rate: 'Rate Renewal',
            custom: 'Manual Task'
        };
        return types[type] || type;
    }

    formatDeadline(deadlineStr) {
        const deadline = new Date(deadlineStr);
        const now = new Date();
        const diff = deadline - now;
        
        if (diff < 0) {
            const hours = Math.abs(Math.floor(diff / 3600000));
            const minutes = Math.abs(Math.floor((diff % 3600000) / 60000));
            if (hours > 24) return `Overdue by ${Math.floor(hours/24)} days`;
            if (hours > 0) return `Overdue by ${hours}h ${minutes}m`;
            return `Overdue by ${minutes}m`;
        }
        
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        if (hours > 24) return `Due in ${Math.floor(hours/24)} days`;
        if (hours > 0) return `Due in ${hours}h ${minutes}m`;
        return `Due in ${minutes}m`;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export { TaskEngine };
