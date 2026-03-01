// ─── CityPlus Notification System ────────────────────────────────────
// Shared module for all dashboards.
// Uses Socket.IO for real-time push, with HTTP polling as fallback.

(function () {
    const API_BASE = '/api/notifications';
    const POLL_INTERVAL = 30000; // 30 seconds (fallback)

    let pollTimer = null;
    let notificationsOpen = false;
    let socket = null;
    let socketConnected = false;

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

    // ── Toast helper (show real-time notification toast) ────────────────
    function showNotifToast(notification) {
        // Use the global showToast if available, otherwise create our own
        if (typeof showToast === 'function') {
            showToast('info', `🔔 ${notification.title}: ${notification.message}`);
            return;
        }

        // Fallback toast
        const toast = document.createElement('div');
        toast.className = 'notif-toast';
        toast.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;padding:12px 16px;background:var(--bg-card,#fff);
                border-left:4px solid ${getNotificationColor(notification.type)};border-radius:8px;
                box-shadow:0 4px 12px rgba(0,0,0,0.15);max-width:360px;font-size:0.9rem;">
                <span class="material-icons-round" style="color:${getNotificationColor(notification.type)};font-size:20px;">
                    ${getNotificationIcon(notification.type)}
                </span>
                <div>
                    <strong style="display:block;margin-bottom:2px;">${escapeHtml(notification.title)}</strong>
                    <span style="color:var(--text-secondary,#64748b);">${escapeHtml(notification.message)}</span>
                </div>
            </div>
        `;
        toast.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10000;animation:slideInRight 0.3s ease;';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }

    // ── Socket.IO Connection ───────────────────────────────────────────
    function initSocketConnection() {
        // Check if Socket.IO client is available
        if (typeof io === 'undefined') {
            console.warn('[Notifications] Socket.IO client not loaded, using polling only');
            startPolling();
            return;
        }

        const token = getToken();
        if (!token) return;

        try {
            socket = io({
                transports: ['websocket', 'polling'],
                timeout: 10000
            });

            socket.on('connect', () => {
                console.log('[Notifications] Socket.IO connected');
                socket.emit('authenticate', { token });
            });

            socket.on('authenticated', (data) => {
                if (data.success) {
                    socketConnected = true;
                    console.log('[Notifications] Socket.IO authenticated — real-time active');
                    // Stop polling since we have real-time
                    stopPolling();
                } else {
                    console.warn('[Notifications] Socket.IO auth failed, using polling');
                    socketConnected = false;
                    startPolling();
                }
            });

            // ── Listen for real-time notifications ──────────────────────
            socket.on('new_notification', (data) => {
                console.log('[Notifications] Real-time notification received:', data);

                // Update badge count
                const badge = document.getElementById('notif-badge');
                if (badge) {
                    const currentCount = parseInt(badge.textContent) || 0;
                    updateBadge(currentCount + 1);
                }

                // Show toast notification
                if (data.notification) {
                    showNotifToast(data.notification);

                    // If panel is open, prepend the new notification
                    if (notificationsOpen) {
                        prependNotification(data.notification);
                    }
                }
            });

            socket.on('disconnect', () => {
                console.log('[Notifications] Socket.IO disconnected, falling back to polling');
                socketConnected = false;
                startPolling();
            });

            socket.on('connect_error', () => {
                console.warn('[Notifications] Socket.IO connection error, using polling');
                socketConnected = false;
                startPolling();
            });
        } catch (err) {
            console.error('[Notifications] Socket.IO init error:', err);
            startPolling();
        }
    }

    // ── Prepend a single notification to the open panel ────────────────
    function prependNotification(n) {
        const list = document.getElementById('notif-list');
        if (!list) return;

        // Remove "no notifications" placeholder if present
        const empty = list.querySelector('.notif-empty');
        if (empty) empty.remove();

        const item = document.createElement('div');
        item.className = 'notif-item notif-unread';
        item.dataset.id = n._id;
        item.dataset.issue = n.issueId || '';
        item.innerHTML = `
            <div class="notif-icon" style="background: ${getNotificationColor(n.type)}20; color: ${getNotificationColor(n.type)};">
                <span class="material-icons-round">${getNotificationIcon(n.type)}</span>
            </div>
            <div class="notif-content">
                <p class="notif-title">${escapeHtml(n.title)}</p>
                <p class="notif-message">${escapeHtml(n.message)}</p>
                <span class="notif-time">Just now</span>
            </div>
            <div class="notif-dot"></div>
        `;

        item.addEventListener('click', () => {
            if (item.classList.contains('notif-unread')) {
                markAsRead(n._id);
                item.classList.remove('notif-unread');
                const dot = item.querySelector('.notif-dot');
                if (dot) dot.remove();
            }
        });

        list.insertBefore(item, list.firstChild);
    }

    // ── Polling (fallback) ─────────────────────────────────────────────
    function startPolling() {
        if (pollTimer) return; // already polling
        pollTimer = setInterval(fetchUnreadCount, POLL_INTERVAL);
    }

    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
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
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="notif-realtime-indicator" id="notif-realtime-indicator" title="Real-time status">
            <span class="material-icons-round" style="font-size:14px;">circle</span>
          </span>
          <button class="notif-mark-all" id="notif-mark-all">Mark all read</button>
        </div>
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

    // Update real-time indicator
    function updateRealtimeIndicator() {
        const indicator = document.getElementById('notif-realtime-indicator');
        if (!indicator) return;
        if (socketConnected) {
            indicator.style.color = '#22c55e';
            indicator.title = 'Real-time: Connected';
        } else {
            indicator.style.color = '#94a3b8';
            indicator.title = 'Real-time: Disconnected (using polling)';
        }
    }

    // ── Public Init ────────────────────────────────────────────────────
    function initNotifications() {
        if (!getToken()) return; // Not logged in

        injectNotificationUI();
        fetchUnreadCount();

        // Try Socket.IO first, fall back to polling
        initSocketConnection();

        // Update indicator periodically
        setInterval(updateRealtimeIndicator, 2000);

        // Always start polling initially; it will be stopped if Socket.IO connects
        startPolling();
    }

    // ── Cleanup ────────────────────────────────────────────────────────
    function stopNotifications() {
        stopPolling();
        if (socket) {
            socket.disconnect();
            socket = null;
            socketConnected = false;
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
