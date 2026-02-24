// ─── CityPlus Notification System ────────────────────────────────────
// Shared module for all dashboards. Handles polling, bell icon, dropdown panel.
// Include this script on any dashboard page.

(function () {
    const API_BASE = '/api/notifications';
    const POLL_INTERVAL = 30000; // 30 seconds

    let pollTimer = null;
    let notificationsOpen = false;

    // ── Helpers ─────────────────────────────────────────────────────────
    function getToken() {
        return localStorage.getItem('token');
    }

    function authHeaders() {
        return {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json'
        };
    }

    function timeAgo(dateStr) {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return new Date(dateStr).toLocaleDateString();
    }

    function getNotificationIcon(type) {
        const icons = {
            issue_created: 'report_problem',
            issue_assigned: 'assignment_ind',
            issue_reassigned: 'swap_horiz',
            status_updated: 'sync',
            feedback_received: 'star_rate',
            account_status_changed: 'admin_panel_settings'
        };
        return icons[type] || 'notifications';
    }

    function getNotificationColor(type) {
        const colors = {
            issue_created: '#3b82f6',
            issue_assigned: '#8b5cf6',
            issue_reassigned: '#f59e0b',
            status_updated: '#06b6d4',
            feedback_received: '#eab308',
            account_status_changed: '#ef4444'
        };
        return colors[type] || '#64748b';
    }

    // ── API Calls ──────────────────────────────────────────────────────
    async function fetchUnreadCount() {
        try {
            const res = await fetch(`${API_BASE}/unread-count`, { headers: authHeaders() });
            if (!res.ok) return;
            const data = await res.json();
            updateBadge(data.count);
        } catch (e) {
            // silent fail — notifications should never break the page
        }
    }

    async function fetchNotifications() {
        try {
            const res = await fetch(API_BASE, { headers: authHeaders() });
            if (!res.ok) return;
            const data = await res.json();
            renderNotificationList(data.notifications);
        } catch (e) {
            // silent fail
        }
    }

    async function markAsRead(id) {
        try {
            await fetch(`${API_BASE}/${id}/read`, { method: 'PATCH', headers: authHeaders() });
            fetchUnreadCount();
        } catch (e) { /* silent */ }
    }

    async function markAllAsRead() {
        try {
            await fetch(`${API_BASE}/read-all`, { method: 'PATCH', headers: authHeaders() });
            updateBadge(0);
            // Update UI for all items
            const items = document.querySelectorAll('.notif-item.notif-unread');
            items.forEach(item => item.classList.remove('notif-unread'));
        } catch (e) { /* silent */ }
    }

    // ── UI Rendering ───────────────────────────────────────────────────
    function updateBadge(count) {
        const badge = document.getElementById('notif-badge');
        if (!badge) return;
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    function renderNotificationList(notifications) {
        const list = document.getElementById('notif-list');
        if (!list) return;

        if (!notifications || notifications.length === 0) {
            list.innerHTML = `
        <div class="notif-empty">
          <span class="material-icons-round" style="font-size: 2.5rem; color: var(--text-secondary); opacity: 0.5;">notifications_off</span>
          <p>No notifications yet</p>
        </div>
      `;
            return;
        }

        list.innerHTML = notifications.map(n => `
      <div class="notif-item ${n.read ? '' : 'notif-unread'}" data-id="${n._id}" data-issue="${n.issueId || ''}">
        <div class="notif-icon" style="background: ${getNotificationColor(n.type)}20; color: ${getNotificationColor(n.type)};">
          <span class="material-icons-round">${getNotificationIcon(n.type)}</span>
        </div>
        <div class="notif-content">
          <p class="notif-title">${escapeHtml(n.title)}</p>
          <p class="notif-message">${escapeHtml(n.message)}</p>
          <span class="notif-time">${timeAgo(n.createdAt)}</span>
        </div>
        ${!n.read ? '<div class="notif-dot"></div>' : ''}
      </div>
    `).join('');

        // Add click listeners
        list.querySelectorAll('.notif-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                if (item.classList.contains('notif-unread')) {
                    markAsRead(id);
                    item.classList.remove('notif-unread');
                    const dot = item.querySelector('.notif-dot');
                    if (dot) dot.remove();
                }
            });
        });
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function toggleNotificationPanel() {
        const panel = document.getElementById('notif-panel');
        if (!panel) return;

        notificationsOpen = !notificationsOpen;
        if (notificationsOpen) {
            panel.classList.add('notif-panel-open');
            fetchNotifications(); // refresh when opened
        } else {
            panel.classList.remove('notif-panel-open');
        }
    }

    // Close panel when clicking outside
    function handleOutsideClick(e) {
        const panel = document.getElementById('notif-panel');
        const bell = document.getElementById('notif-bell');
        if (!panel || !bell) return;
        if (notificationsOpen && !panel.contains(e.target) && !bell.contains(e.target)) {
            notificationsOpen = false;
            panel.classList.remove('notif-panel-open');
        }
    }

    // ── Injection & Init ───────────────────────────────────────────────
    function injectNotificationUI() {
        const navbarAuth = document.querySelector('.navbar-auth');
        if (!navbarAuth) return;

        // Create the bell button
        const bellWrapper = document.createElement('div');
        bellWrapper.className = 'notif-bell-wrapper';
        bellWrapper.id = 'notif-bell';
        bellWrapper.innerHTML = `
      <button class="notif-bell-btn" aria-label="Notifications" title="Notifications">
        <span class="material-icons-round">notifications</span>
        <span class="notif-badge" id="notif-badge" style="display:none;">0</span>
      </button>
    `;

        // Create the dropdown panel
        const panel = document.createElement('div');
        panel.className = 'notif-panel';
        panel.id = 'notif-panel';
        panel.innerHTML = `
      <div class="notif-panel-header">
        <h3>Notifications</h3>
        <button class="notif-mark-all" id="notif-mark-all">Mark all read</button>
      </div>
      <div class="notif-list" id="notif-list">
        <div class="notif-empty">
          <span class="material-icons-round" style="font-size: 2.5rem; color: var(--text-secondary); opacity: 0.5;">notifications_off</span>
          <p>No notifications yet</p>
        </div>
      </div>
    `;

        // Insert bell before the logout button
        navbarAuth.insertBefore(bellWrapper, navbarAuth.firstChild);
        navbarAuth.appendChild(panel);

        // Event listeners
        bellWrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleNotificationPanel();
        });

        document.getElementById('notif-mark-all').addEventListener('click', (e) => {
            e.stopPropagation();
            markAllAsRead();
        });

        document.addEventListener('click', handleOutsideClick);
    }

    // ── Public Init ────────────────────────────────────────────────────
    function initNotifications() {
        if (!getToken()) return; // Not logged in

        injectNotificationUI();
        fetchUnreadCount();

        // Start polling
        pollTimer = setInterval(fetchUnreadCount, POLL_INTERVAL);
    }

    // ── Cleanup ────────────────────────────────────────────────────────
    function stopNotifications() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    // Initialize on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNotifications);
    } else {
        initNotifications();
    }

    // Expose for external use
    window.CityPlusNotifications = {
        init: initNotifications,
        stop: stopNotifications,
        refresh: fetchUnreadCount
    };
})();
