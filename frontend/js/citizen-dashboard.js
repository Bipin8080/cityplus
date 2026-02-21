// Global state
let allIssues = [];
let filteredIssues = [];
let currentPage = 1;
const pageSize = 4;
let userName = 'Citizen';
let userEmail = 'user@example.com';

// All Issues state
let allCommunityIssues = [];
let filteredCommunityIssues = [];
let allIssuesCurrentPage = 1;
let currentTab = 'dashboard'; // Track current tab

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', async () => {
  checkAuth();
  loadCitizenProfile();
  await loadCitizenIssues();
  setupEventListeners();
  updateActivityFeed();
});

// Tab switching functions
function switchToDashboardTab() {
  currentTab = 'dashboard';
  document.getElementById('dashboardView').style.display = 'block';
  document.getElementById('allIssuesView').style.display = 'none';
  updateSidebarActive('dashboard');
}

function switchToAllIssuesTab() {
  currentTab = 'allIssues';
  document.getElementById('dashboardView').style.display = 'none';
  document.getElementById('allIssuesView').style.display = 'block';
  updateSidebarActive('allIssues');
  loadAllCommunityIssues();
}

function updateSidebarActive(tab) {
  const navLinks = document.querySelectorAll('.sidebar__nav .nav-link');
  navLinks.forEach(link => {
    link.classList.remove('nav-link--active');
  });
  if (tab === 'dashboard') {
    navLinks[0].classList.add('nav-link--active');
  } else if (tab === 'allIssues') {
    navLinks[1].classList.add('nav-link--active');
  }
}

// Check if user is authenticated
function checkAuth() {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  if (!token || role !== 'citizen') {
    window.location.href = 'login.html';
    return;
  }
}

// Load citizen profile from localStorage and display
function loadCitizenProfile() {
  try {
    const userName_stored = localStorage.getItem('userName');
    const userEmail_stored = localStorage.getItem('userEmail');

    // Use stored name if available
    if (userName_stored) {
      userName = userName_stored;
      document.getElementById('userName').textContent = userName;
      const firstName = userName.split(' ')[0];
      document.getElementById('pageTitle').textContent = `Welcome back, ${firstName}`;
    }
    // If no name but have email, use email as display
    else if (userEmail_stored) {
      const emailName = userEmail_stored.split('@')[0];
      document.getElementById('userName').textContent = userEmail_stored;
      document.getElementById('pageTitle').textContent = `Welcome back, ${emailName}`;
    }

    // Update email display
    if (userEmail_stored) {
      userEmail = userEmail_stored;
      document.getElementById('userEmail').textContent = userEmail;
    }
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

// Load citizen issues from API
async function loadCitizenIssues() {
  const token = localStorage.getItem('token');

  try {
    const res = await fetch('http://localhost:5000/api/issues/my', {
      headers: { Authorization: 'Bearer ' + token }
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    const data = await res.json();
    allIssues = data.issues || [];
    applyFiltersAndRender();
  } catch (error) {
    console.error('Error loading issues:', error);
    showErrorMessage('Failed to load issues. Please try again.');
  }
}

// Load all community issues from API
async function loadAllCommunityIssues() {
  const token = localStorage.getItem('token');

  try {
    const res = await fetch('http://localhost:5000/api/issues/all', {
      headers: { Authorization: 'Bearer ' + token }
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    const data = await res.json();
    allCommunityIssues = data.issues || [];
    allIssuesCurrentPage = 1;
    applyAllIssuesFiltersAndRender();
  } catch (error) {
    console.error('Error loading community issues:', error);
    showErrorMessage('Failed to load community issues. Please try again.');
  }
}

// Apply filters and render issues
function applyFiltersAndRender() {
  const search = document.querySelector('#searchInput').value.toLowerCase();
  const statusFilter = document.querySelector('#statusFilter').value;
  const categoryFilter = document.querySelector('#categoryFilter').value;
  const wardFilter = document.querySelector('#wardFilter').value.toLowerCase();

  // Filter issues
  filteredIssues = allIssues.filter(issue => {
    if (statusFilter && issue.status !== statusFilter) return false;
    if (categoryFilter && issue.category !== categoryFilter) return false;
    if (wardFilter && !issue.ward.toLowerCase().includes(wardFilter)) return false;

    if (search) {
      const haystack = (
        issue.title +
        ' ' +
        issue.location +
        ' ' +
        issue.description
      ).toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });

  currentPage = 1;
  updateStats();
  renderTable();
}

// Update statistics
function updateStats() {
  let total = 0, open = 0, progress = 0, resolved = 0;

  filteredIssues.forEach(issue => {
    total++;
    if (issue.status === 'Open') open++;
    else if (issue.status === 'In Progress') progress++;
    else if (issue.status === 'Resolved') resolved++;
  });

  document.querySelector('#statTotal').textContent = total;
  document.querySelector('#statOpen').textContent = open;
  document.querySelector('#statProgress').textContent = progress;
  document.querySelector('#statResolved').textContent = resolved;
}

// Render issues table
function renderTable() {
  const tbody = document.querySelector('#issuesTableBody');
  tbody.innerHTML = '';

  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const paginatedIssues = filteredIssues.slice(start, end);

  if (paginatedIssues.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--slate-500);">No issues found</td></tr>';
    updatePaginationControls();
    return;
  }

  paginatedIssues.forEach(issue => {
    const created = new Date(issue.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    let statusClass = 'pending';
    let statusLabel = 'Open';
    if (issue.status === 'In Progress') {
      statusClass = 'inprogress';
      statusLabel = 'In Progress';
    } else if (issue.status === 'Resolved') {
      statusClass = 'resolved';
      statusLabel = 'Resolved';
    }

    const row = document.createElement('tr');
    row.onclick = () => openIssueModal(issue);
    row.innerHTML = `
      <td>
        <div class="issue-cell">
          <div class="issue-thumb">
            ${issue.image ? `<img src="http://localhost:5000${issue.image}" alt="${issue.title}">` : '<span class="material-icons">image_not_supported</span>'}
          </div>
          <div>
            <p class="issue-title">${issue.title}</p>
            <p class="issue-id">ID: #${issue._id.slice(-6)}</p>
          </div>
        </div>
      </td>
      <td class="date-cell">${created}</td>
      <td>
        <span class="badge badge--category">
          <span class="material-icons">category</span>
          ${issue.category}
        </span>
      </td>
      <td>
        <span class="badge badge--${statusClass}">
          <span class="badge__dot badge__dot--${statusClass === 'pending' ? 'yellow' : statusClass === 'resolved' ? 'green' : 'blue'}"></span>
          ${statusLabel}
        </span>
      </td>
      <td class="action-cell">
        <button class="action-btn" title="View details">
          <span class="material-icons">more_vert</span>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  updatePaginationControls();
}

// Apply filters and render all community issues
function applyAllIssuesFiltersAndRender() {
  const search = document.querySelector('#allIssuesSearchInput').value.toLowerCase();
  const statusFilter = document.querySelector('#allIssuesStatusFilter').value;
  const categoryFilter = document.querySelector('#allIssuesCategoryFilter').value;
  const wardFilter = document.querySelector('#allIssuesWardFilter').value.toLowerCase();

  // Filter issues
  filteredCommunityIssues = allCommunityIssues.filter(issue => {
    if (statusFilter && issue.status !== statusFilter) return false;
    if (categoryFilter && issue.category !== categoryFilter) return false;
    if (wardFilter && !issue.ward.toLowerCase().includes(wardFilter)) return false;

    if (search) {
      const haystack = (
        issue.title +
        ' ' +
        issue.location +
        ' ' +
        issue.description +
        ' ' +
        (issue.citizen ? issue.citizen.name : '')
      ).toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });

  allIssuesCurrentPage = 1;
  renderAllIssuesTable();
}

// Render all issues table
function renderAllIssuesTable() {
  const tbody = document.querySelector('#allIssuesTableBody');
  tbody.innerHTML = '';

  const start = (allIssuesCurrentPage - 1) * pageSize;
  const end = start + pageSize;
  const paginatedIssues = filteredCommunityIssues.slice(start, end);

  if (paginatedIssues.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--slate-500);">No issues found</td></tr>';
    updateAllIssuesPaginationControls();
    return;
  }

  paginatedIssues.forEach(issue => {
    const created = new Date(issue.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    let statusClass = 'pending';
    let statusLabel = 'Open';
    if (issue.status === 'In Progress') {
      statusClass = 'inprogress';
      statusLabel = 'In Progress';
    } else if (issue.status === 'Resolved') {
      statusClass = 'resolved';
      statusLabel = 'Resolved';
    }

    const reportedBy = issue.citizen ? issue.citizen.name : 'Anonymous';

    const row = document.createElement('tr');
    row.onclick = () => openIssueModal(issue);
    row.innerHTML = `
      <td>
        <div class="issue-cell">
          <div class="issue-thumb">
            ${issue.image ? `<img src="http://localhost:5000${issue.image}" alt="${issue.title}">` : '<span class="material-icons">image_not_supported</span>'}
          </div>
          <div>
            <p class="issue-title">${issue.title}</p>
            <p class="issue-id">ID: #${issue._id.slice(-6)}</p>
          </div>
        </div>
      </td>
      <td>
        <span style="font-size: 0.875rem; color: var(--text-secondary);">${reportedBy}</span>
      </td>
      <td class="date-cell">${created}</td>
      <td>
        <span class="badge badge--category">
          <span class="material-icons">category</span>
          ${issue.category}
        </span>
      </td>
      <td>
        <span class="badge badge--${statusClass}">
          <span class="badge__dot badge__dot--${statusClass === 'pending' ? 'yellow' : statusClass === 'resolved' ? 'green' : 'blue'}"></span>
          ${statusLabel}
        </span>
      </td>
      <td class="action-cell">
        <button class="action-btn" title="View details">
          <span class="material-icons">more_vert</span>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  updateAllIssuesPaginationControls();
}

// Update all issues pagination controls
function updateAllIssuesPaginationControls() {
  const totalPages = Math.ceil(filteredCommunityIssues.length / pageSize);
  const start = (allIssuesCurrentPage - 1) * pageSize + 1;
  const end = Math.min(allIssuesCurrentPage * pageSize, filteredCommunityIssues.length);
  const total = filteredCommunityIssues.length;

  document.querySelector('#allIssuesPaginationInfo').textContent =
    total === 0 ? 'No issues' : `Showing ${start} to ${end} of ${total} entries`;

  document.querySelector('#allIssuesPrevBtn').disabled = allIssuesCurrentPage === 1;
  document.querySelector('#allIssuesNextBtn').disabled = allIssuesCurrentPage >= totalPages;
}

// Open issue modal
function openIssueModal(issue) {
  const modal = document.querySelector('#issueModal');
  document.querySelector('#modalTitle').textContent = issue.title;
  document.querySelector('#modalCategory').textContent = issue.category;
  document.querySelector('#modalWard').textContent = issue.ward;
  document.querySelector('#modalLocation').textContent = issue.location;
  document.querySelector('#modalPriority').textContent = issue.priority;
  document.querySelector('#modalStatus').textContent = issue.status;
  document.querySelector('#modalDescription').textContent = issue.description;

  const submitted = new Date(issue.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  document.querySelector('#modalSubmitted').textContent = submitted;

  const imageEl = document.querySelector('#modalImage');
  if (issue.image) {
    imageEl.src = 'http://localhost:5000' + issue.image;
    imageEl.style.display = 'block';
  } else {
    imageEl.style.display = 'none';
  }

  modal.style.display = 'flex';
}

// Close issue modal
function closeIssueModal() {
  document.querySelector('#issueModal').style.display = 'none';
}

// Open profile modal
function openProfileModal() {
  const modal = document.querySelector('#profileModal');

  // Populate profile data
  const userName_stored = localStorage.getItem('userName');
  const userEmail_stored = localStorage.getItem('userEmail');

  document.querySelector('#profileName').textContent = userName_stored || 'Citizen User';
  document.querySelector('#profileFullName').textContent = userName_stored || '-';
  document.querySelector('#profileEmail').textContent = userEmail_stored || '-';

  modal.style.display = 'flex';
}

// Close profile modal
function closeProfileModal() {
  document.querySelector('#profileModal').style.display = 'none';
}

// Update activity feed
function updateActivityFeed() {
  const activityList = document.querySelector('#activityList');

  // Get recent resolved issues
  const resolvedIssues = allIssues
    .filter(issue => issue.status === 'Resolved')
    .sort((a, b) => new Date(b.resolvedAt) - new Date(a.resolvedAt))
    .slice(0, 2);

  if (resolvedIssues.length === 0) {
    activityList.innerHTML = `
      <div class="activity-item">
        <div class="activity-icon activity-icon--primary">
          <span class="material-icons">info</span>
        </div>
        <div>
          <p class="activity-item__title">No recent updates</p>
          <p class="activity-item__body">Your resolved issues will appear here</p>
          <p class="activity-item__time">No activity yet</p>
        </div>
      </div>
    `;
    return;
  }

  activityList.innerHTML = resolvedIssues.map(issue => {
    const date = new Date(issue.resolvedAt);
    const timeAgo = getTimeAgo(date);

    return `
      <div class="activity-item">
        <div class="activity-icon activity-icon--green">
          <span class="material-icons">check</span>
        </div>
        <div>
          <p class="activity-item__title">Issue Resolved: ${issue.title}</p>
          <p class="activity-item__body">Your report #${issue._id.slice(-6)} has been successfully resolved.</p>
          <p class="activity-item__time">${timeAgo}</p>
        </div>
      </div>
    `;
  }).join('');
}

// Helper function to get time ago text
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;

  return date.toLocaleDateString('en-IN');
}

// Setup event listeners
function setupEventListeners() {
  // Search input
  document.querySelector('#searchInput').addEventListener('input', applyFiltersAndRender);

  // Filter toggle
  document.querySelector('#filterBtn').addEventListener('click', () => {
    const panel = document.querySelector('#filterPanel');
    panel.style.display = panel.style.display === 'none' ? 'grid' : 'none';
  });

  // Filter selects
  document.querySelector('#statusFilter').addEventListener('change', applyFiltersAndRender);
  document.querySelector('#categoryFilter').addEventListener('change', applyFiltersAndRender);
  document.querySelector('#wardFilter').addEventListener('input', applyFiltersAndRender);

  // Pagination
  document.querySelector('#prevBtn').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  document.querySelector('#nextBtn').addEventListener('click', () => {
    const totalPages = Math.ceil(filteredIssues.length / pageSize);
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // All Issues Search input
  document.querySelector('#allIssuesSearchInput').addEventListener('input', applyAllIssuesFiltersAndRender);

  // All Issues Filter toggle
  document.querySelector('#allIssuesFilterBtn').addEventListener('click', () => {
    const panel = document.querySelector('#allIssuesFilterPanel');
    panel.style.display = panel.style.display === 'none' ? 'grid' : 'none';
  });

  // All Issues Filter selects
  document.querySelector('#allIssuesStatusFilter').addEventListener('change', applyAllIssuesFiltersAndRender);
  document.querySelector('#allIssuesCategoryFilter').addEventListener('change', applyAllIssuesFiltersAndRender);
  document.querySelector('#allIssuesWardFilter').addEventListener('input', applyAllIssuesFiltersAndRender);

  // All Issues Pagination
  document.querySelector('#allIssuesPrevBtn').addEventListener('click', () => {
    if (allIssuesCurrentPage > 1) {
      allIssuesCurrentPage--;
      renderAllIssuesTable();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  document.querySelector('#allIssuesNextBtn').addEventListener('click', () => {
    const totalPages = Math.ceil(filteredCommunityIssues.length / pageSize);
    if (allIssuesCurrentPage < totalPages) {
      allIssuesCurrentPage++;
      renderAllIssuesTable();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // Close modal when clicking outside
  document.querySelector('#issueModal').addEventListener('click', (e) => {
    if (e.target.id === 'issueModal') {
      closeIssueModal();
    }
  });

  // Close profile modal when clicking outside
  document.querySelector('#profileModal').addEventListener('click', (e) => {
    if (e.target.id === 'profileModal') {
      closeProfileModal();
    }
  });
}

// Logout function (kept for backwards compatibility)
function logout() {
  localStorage.clear();
  window.location.href = 'login.html';
}

// Logout confirmation modal
function showLogoutConfirmation() {
  const modal = document.getElementById('logoutConfirmModal');
  modal.classList.add('active');
}

function hideLogoutConfirmation() {
  const modal = document.getElementById('logoutConfirmModal');
  modal.classList.remove('active');
}

function confirmLogout() {
  localStorage.clear();
  window.location.href = 'login.html';
}

// Setup logout confirmation listeners
document.addEventListener('DOMContentLoaded', () => {
  const cancelBtn = document.getElementById('cancelLogoutBtn');
  const confirmBtn = document.getElementById('confirmLogoutBtn');
  const modal = document.getElementById('logoutConfirmModal');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', hideLogoutConfirmation);
  }
  if (confirmBtn) {
    confirmBtn.addEventListener('click', confirmLogout);
  }
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        hideLogoutConfirmation();
      }
    });
  }
});

// Show error message
function showErrorMessage(message) {
  // Create a simple alert - you can enhance this with a toast notification
  alert(message);
}

// Expose functions globally for HTML onclick handlers
window.switchToDashboardTab = switchToDashboardTab;
window.switchToAllIssuesTab = switchToAllIssuesTab;
