function citizenText(key, fallback) {
  return fallback || key;
}

// Global state
let allIssues = [];
let filteredIssues = [];
let currentPage = 1;
const pageSize = 10;
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
  showDashboardSkeleton();

  window.addEventListener('hashchange', handleHashChange);

  await loadCitizenIssues();
  hideDashboardSkeleton();
  setupEventListeners();
  updateActivityFeed();
  if (window.loadLeafletApi) await window.loadLeafletApi();

  handleHashChange(); // initial routing
});

function handleHashChange() {
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  if (hash === 'profile') {
    openProfileModal(true);
  } else if (hash === 'allIssues') {
    switchToAllIssuesTab(true);
  } else if (hash === 'mapView') {
    switchToMapTab(true);
  } else {
    switchToDashboardTab(true);
  }
}

// Show skeleton loading state
function showDashboardSkeleton() {
  // Stat card skeletons
  ['statTotal', 'statOpen', 'statProgress', 'statResolved'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = '<span class="skeleton skeleton-value">&nbsp;</span>';
    }
  });
  // Table skeleton rows
  const tbody = document.getElementById('issuesTableBody');
  if (tbody) {
    let rows = '';
    for (let i = 0; i < 3; i++) {
      rows += `<tr class="skeleton-row">
        <td><div class="skeleton skeleton-cell" style="width:${60 + i * 15}%">&nbsp;</div></td>
        <td><div class="skeleton skeleton-cell" style="width:70%">&nbsp;</div></td>
        <td><div class="skeleton skeleton-cell" style="width:55%">&nbsp;</div></td>
        <td><div class="skeleton skeleton-cell" style="width:50%">&nbsp;</div></td>
        <td><div class="skeleton skeleton-cell" style="width:30%">&nbsp;</div></td>
      </tr>`;
    }
    tbody.innerHTML = rows;
  }
}

// Hide skeleton and show real content with fade-in
function hideDashboardSkeleton() {
  const statsGrid = document.querySelector('.stats-grid');
  if (statsGrid) statsGrid.classList.add('fade-in');
  const tableCard = document.querySelector('.table-card');
  if (tableCard) tableCard.classList.add('fade-in');
}

// Tab switching functions
function switchToDashboardTab(fromHash = false) {
  if (fromHash !== true) {
    history.pushState(null, null, '#dashboard');
  }

  // hide profile if active
  const profileContainer = document.getElementById('profile-view-container');
  if (profileContainer) profileContainer.style.display = 'none';

  currentTab = 'dashboard';
  const detailsContainer = document.getElementById('citizen-issue-details-container');
  if (detailsContainer) detailsContainer.style.display = 'none';
  const mapViewTab = document.getElementById('mapViewTab');
  if (mapViewTab) mapViewTab.style.display = 'none';
  document.getElementById('dashboardView').style.display = ''; // Clear inline styles
  document.getElementById('allIssuesView').style.display = 'none';
  updateSidebarActive('dashboard');
}

function switchToAllIssuesTab(fromHash = false) {
  if (fromHash !== true) {
    history.pushState(null, null, '#allIssues');
  }

  // hide profile if active
  const profileContainer = document.getElementById('profile-view-container');
  if (profileContainer) profileContainer.style.display = 'none';

  currentTab = 'allIssues';
  const detailsContainer = document.getElementById('citizen-issue-details-container');
  if (detailsContainer) detailsContainer.style.display = 'none';
  const mapViewTab = document.getElementById('mapViewTab');
  if (mapViewTab) mapViewTab.style.display = 'none';
  document.getElementById('dashboardView').style.display = 'none';
  document.getElementById('allIssuesView').style.display = ''; // Clear inline styles
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
  const token = window.CityPlusApi.getToken('citizen');

  if (!token) {
    window.location.href = 'login.html';
    return;
  }
}

// Load citizen profile from localStorage and display
function loadCitizenProfile() {
  try {
    const userName_stored = localStorage.getItem('citizen_userName');
    const userEmail_stored = localStorage.getItem('citizen_userEmail');

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
  const token = window.CityPlusApi.getToken('citizen');

  try {
    const res = await fetch('/api/issues/my', {
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
    console.error('Full error details:', error);
    showErrorMessage('Failed to load issues. Please try again.');
  }
}

// Load all community issues from API
async function loadAllCommunityIssues() {
  const token = window.CityPlusApi.getToken('citizen');

  try {
    const res = await fetch('/api/issues/all', {
      headers: { Authorization: 'Bearer ' + token }
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    const data = await res.json();
    allCommunityIssues = data.issues || [];
    setupCitizenMapFilters(allCommunityIssues);
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


  // Filter issues
  filteredIssues = allIssues.filter(issue => {
    if (statusFilter && issue.status !== statusFilter) return false;
    if (categoryFilter && issue.category !== categoryFilter) return false;


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
    if (issue.status === 'Pending') open++;
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
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--slate-500);">${citizenText("common.noIssuesFound", "No issues found")}</td></tr>`;
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
    let statusLabel = 'Pending';
    if (issue.status === 'In Progress') {
      statusClass = 'inprogress';
      statusLabel = 'In Progress';
    } else if (issue.status === 'Resolved') {
      statusClass = 'resolved';
      statusLabel = 'Resolved';
    } else if (issue.status === 'Rejected') {
      statusClass = 'rejected';
      statusLabel = 'Rejected';
    }

    const row = document.createElement('tr');
    row.onclick = () => openIssueDetails(issue);
    row.innerHTML = `
      <td>
        <div class="issue-cell">
          <div class="issue-thumb">
            ${issue.image ? `<img src="${issue.image.startsWith('http') ? issue.image : '' + issue.image}" alt="${issue.title}">` : '<span class="material-icons">image_not_supported</span>'}
          </div>
          <div>
            <p class="issue-title">${issue.title}</p>
            <p class="issue-id" style="display:flex;align-items:center;gap:0.25rem;">
              ID: #${issue._id.slice(-6)}
              ${issue.feedback ? `<span style="color:#eab308;display:flex;align-items:center;font-size:0.875rem;"><span class="material-icons" style="font-size:1rem;">star</span> ${issue.feedback.rating}</span>` : ''}
            </p>
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
        <span style="font-size: 0.875rem; color: var(--text-secondary);">
          ${issue.department ? issue.department.name : '-'}
        </span>
      </td>
      <td>
        <span class="badge badge--${statusClass}">
          <span class="badge__dot badge__dot--${statusClass === 'pending' ? 'yellow' : statusClass === 'resolved' ? 'green' : statusClass === 'rejected' ? 'red' : 'blue'}"></span>
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

// Update pagination controls
function updatePaginationControls() {
  const totalPages = Math.ceil(filteredIssues.length / pageSize);
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, filteredIssues.length);
  const total = filteredIssues.length;

  document.querySelector('#paginationInfo').textContent =
    total === 0 ? 'No issues' : `Showing ${start} to ${end} of ${total} entries`;

  document.querySelector('#prevBtn').disabled = currentPage === 1;
  document.querySelector('#nextBtn').disabled = currentPage >= totalPages;
}

// Apply filters and render all community issues
function applyAllIssuesFiltersAndRender() {
  const search = document.querySelector('#allIssuesSearchInput').value.toLowerCase();
  const statusFilter = document.querySelector('#allIssuesStatusFilter').value;
  const categoryFilter = document.querySelector('#allIssuesCategoryFilter').value;


  // Filter issues
  filteredCommunityIssues = allCommunityIssues.filter(issue => {
    if (statusFilter && issue.status !== statusFilter) return false;
    if (categoryFilter && issue.category !== categoryFilter) return false;


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
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--slate-500);">${citizenText("common.noIssuesFound", "No issues found")}</td></tr>`;
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
    let statusLabel = 'Pending';
    if (issue.status === 'In Progress') {
      statusClass = 'inprogress';
      statusLabel = 'In Progress';
    } else if (issue.status === 'Resolved') {
      statusClass = 'resolved';
      statusLabel = 'Resolved';
    } else if (issue.status === 'Rejected') {
      statusClass = 'rejected';
      statusLabel = 'Rejected';
    }

    const reportedBy = issue.citizen ? issue.citizen.name : 'Anonymous';

    const row = document.createElement('tr');
    row.onclick = () => openIssueDetails(issue);
    row.innerHTML = `
      <td>
        <div class="issue-cell">
          <div class="issue-thumb">
            ${issue.image ? `<img src="${issue.image.startsWith('http') ? issue.image : '' + issue.image}" alt="${issue.title}">` : '<span class="material-icons">image_not_supported</span>'}
          </div>
          <div>
            <p class="issue-title">${issue.title}</p>
            <p class="issue-id" style="display:flex;align-items:center;gap:0.25rem;">
              ID: #${issue._id.slice(-6)}
              ${issue.feedback ? `<span style="color:#eab308;display:flex;align-items:center;font-size:0.875rem;"><span class="material-icons" style="font-size:1rem;">star</span> ${issue.feedback.rating}</span>` : ''}
            </p>
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
        <span style="font-size: 0.875rem; color: var(--text-secondary);">
          ${issue.department ? issue.department.name : '-'}
        </span>
      </td>
      <td>
        <span class="badge badge--${statusClass}">
          <span class="badge__dot badge__dot--${statusClass === 'pending' ? 'yellow' : statusClass === 'resolved' ? 'green' : statusClass === 'rejected' ? 'red' : 'blue'}"></span>
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

  // If map tab is active, re-render
  const mapTab = document.getElementById('mapViewTab');
  if (mapTab && mapTab.style.display !== 'none') {
    let mapFilteredIssues = filteredCommunityIssues;
    if (citizenMapStatusFilter) {
      mapFilteredIssues = mapFilteredIssues.filter(issue => {
        return !citizenMapStatusFilter || issue.status === citizenMapStatusFilter;
      });
    }
    renderCitizenAllIssuesMap(mapFilteredIssues);
  } else {
    // initialize but don't show
    renderCitizenAllIssuesMap(filteredCommunityIssues);
  }
}

// Map View Logic for Community Issues
window.switchToMapTab = function (fromHash = false) {
  if (fromHash !== true) {
    history.pushState(null, null, '#mapView');
  }

  currentTab = 'mapView';

  document.getElementById('dashboardView').style.display = 'none';
  document.getElementById('allIssuesView').style.display = 'none';
  const detailsView = document.getElementById('citizen-issue-details-container');
  if (detailsView) detailsView.style.display = 'none';
  const profileView = document.getElementById('profile-view-container');
  if (profileView) profileView.style.display = 'none';

  document.getElementById('mapViewTab').style.display = 'block';

  // Update nav active state
  document.querySelectorAll('.sidebar__nav .nav-link').forEach(l => l.classList.remove('nav-link--active'));
  const mapNavLinks = document.querySelectorAll('.sidebar__nav .nav-link');
  if (mapNavLinks[2]) mapNavLinks[2].classList.add('nav-link--active');

  // Auto-load community issues if not loaded yet
  if (!allCommunityIssues || allCommunityIssues.length === 0) {
    loadAllCommunityIssues().then(() => {
      renderMapWithFilters();
    });
  } else {
    renderMapWithFilters();
  }

  function renderMapWithFilters() {
    let mapFilteredIssues = filteredCommunityIssues || allCommunityIssues || [];
    if (citizenMapStatusFilter) {
      mapFilteredIssues = mapFilteredIssues.filter(issue => {
        return !citizenMapStatusFilter || issue.status === citizenMapStatusFilter;
      });
    }
    setTimeout(() => renderCitizenAllIssuesMap(mapFilteredIssues), 150);
  }
};

function renderCitizenAllIssuesMap(issues) {
  if (!window.isLeafletLoaded || typeof L === 'undefined') return;

  const mapEl = document.getElementById('citizenMapViewMap');
  if (!mapEl) return;

  if (!window.citizenAllIssuesMapInstance) {
    window.citizenAllIssuesMapInstance = L.map(mapEl).setView([19.2952, 73.0544], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(window.citizenAllIssuesMapInstance);

    if (L.Control && L.Control.geocoder) {
      L.Control.geocoder({
        defaultMarkGeocode: false
      }).on('markgeocode', function (e) {
        var bbox = e.geocode.bbox;
        window.citizenAllIssuesMapInstance.fitBounds(bbox);
      }).addTo(window.citizenAllIssuesMapInstance);
    }
  }

  if (window.citizenAllIssuesMarkers) {
    window.citizenAllIssuesMapInstance.removeLayer(window.citizenAllIssuesMarkers);
  }
  
  window.citizenAllIssuesMarkers = L.layerGroup().addTo(window.citizenAllIssuesMapInstance);
  const bounds = [];
  
  // Store issues globally so popup button onclick can reference them
  window.citizenMapIssuesList = issues;
  
  issues.forEach(issue => {
    if (issue.lat && issue.lng) {
      bounds.push([issue.lat, issue.lng]);
      let markerColor = '#ef4444';
      if (issue.status === 'In Progress') markerColor = '#eab308';
      else if (issue.status === 'Resolved') markerColor = '#22c55e';
      else if (issue.status === 'Rejected') markerColor = '#b91c1c';

      const svgIcon = L.divIcon({
        className: 'custom-map-marker',
        html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="${markerColor}" stroke="white" stroke-width="2">
                 <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
               </svg>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      const marker = L.marker([issue.lat, issue.lng], { icon: svgIcon });

      // Rich tooltip on hover
      marker.bindTooltip(`
        <div style="min-width:180px;">
          <strong style="font-size:0.875rem;">${issue.title || issue.category}</strong><br/>
          <span style="font-size:0.8rem; color:#666;">📍 ${issue.location ? issue.location.substring(0, 40) : '--'}</span><br/>
          <span style="font-size:0.8rem;">📂 ${issue.category}</span><br/>
          <span style="font-size:0.8rem; color:${markerColor}; font-weight:600;">● ${issue.status}</span>
        </div>
      `, { direction: 'top', opacity: 0.95 });

      // Rich popup on click with issue preview
      const created = new Date(issue.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
      const popupContent = `
        <div style="min-width:220px; max-width:280px; font-family: inherit;">
          ${issue.image ? `<img src="${issue.image.startsWith('http') ? issue.image : issue.image}" alt="${issue.title}" style="width:100%; height:120px; object-fit:cover; border-radius:0.375rem; margin-bottom:0.5rem;">` : ''}
          <h4 style="margin:0 0 0.25rem 0; font-size:0.95rem; color:#1e293b;">${issue.title || 'Untitled'}</h4>
          <div style="display:flex; gap:0.35rem; flex-wrap:wrap; margin-bottom:0.35rem;">
            <span style="background:rgba(59,130,246,0.1); color:#3b82f6; padding:0.1rem 0.5rem; border-radius:9999px; font-size:0.7rem; font-weight:600;">${issue.category}</span>
            <span style="background:${markerColor}20; color:${markerColor}; padding:0.1rem 0.5rem; border-radius:9999px; font-size:0.7rem; font-weight:600;">${issue.status}</span>
          </div>
          <p style="margin:0 0 0.25rem 0; font-size:0.8rem; color:#64748b;">📍 ${issue.location || '--'}</p>
          <p style="margin:0 0 0.5rem 0; font-size:0.75rem; color:#94a3b8;">Submitted: ${created}</p>
          ${issue.description ? `<p style="margin:0 0 0.5rem 0; font-size:0.8rem; color:#475569; line-height:1.4;">${issue.description.substring(0, 100)}${issue.description.length > 100 ? '...' : ''}</p>` : ''}
          <button onclick="openIssueDetails(window.citizenMapIssuesList.find(i => i._id === '${issue._id}'))" style="width:100%; padding:0.4rem; background:#3b82f6; color:white; border:none; border-radius:0.375rem; font-size:0.8rem; font-weight:600; cursor:pointer;">View Full Details</button>
        </div>
      `;
      marker.bindPopup(popupContent, { maxWidth: 300 });

      window.citizenAllIssuesMarkers.addLayer(marker);
    }
  });

  if (bounds.length > 0) {
    if (bounds.length === 1) {
      window.citizenAllIssuesMapInstance.setView(bounds[0], 15);
    } else {
      window.citizenAllIssuesMapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  } else {
    window.citizenAllIssuesMapInstance.setView([19.2952, 73.0544], 13);
  }

  setTimeout(() => window.citizenAllIssuesMapInstance.invalidateSize(), 100);
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

// Open issue details
function openIssueDetails(issue) {
  // (Wait to show container at the end)
  document.querySelector('#modalTitle').textContent = issue.title;
  document.querySelector('#modalCategory').textContent = issue.category ? (issue.category.name || issue.category) : "--";

  document.querySelector('#modalDepartment').textContent = issue.department ? issue.department.name : "Unassigned";
  document.querySelector('#modalLocation').textContent = issue.location;
  document.querySelector('#modalPriority').textContent = issue.priority;
  document.querySelector('#modalStatus').textContent = issue.status;
  document.querySelector('#modalDescription').textContent = issue.description;

  if (issue.assignedTo && issue.assignedTo.name) {
    document.querySelector('#modalAssigned').textContent = issue.assignedTo.name;
    document.querySelector('#assignedContainer').style.display = 'grid';
  } else {
    document.querySelector('#assignedContainer').style.display = 'none';
  }

  const submitted = new Date(issue.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  document.querySelector('#modalSubmitted').textContent = submitted;

  const imageEl = document.querySelector('#modalImage');
  if (issue.image) {
    imageEl.src = issue.image.startsWith('http') ? issue.image : '' + issue.image;
    imageEl.style.display = 'block';
  } else {
    imageEl.style.display = 'none';
  }

  // Handle Feedback UI
  const feedbackSection = document.querySelector('#modalFeedbackSection');
  const existingFeedback = document.querySelector('#existingFeedback');
  const leaveFeedbackForm = document.querySelector('#leaveFeedbackForm');

  if (issue.status === 'Resolved') {
    feedbackSection.style.display = 'block';

    if (issue.feedback && issue.feedback.rating) {
      // Feedback exists, show it
      existingFeedback.style.display = 'block';
      leaveFeedbackForm.style.display = 'none';

      const starsDiv = document.querySelector('#existingRatingStars');
      let starsHtml = '';
      for (let i = 1; i <= 5; i++) {
        starsHtml += `<span class="material-icons" style="font-size:1.25rem;">${i <= issue.feedback.rating ? 'star' : 'star_border'}</span>`;
      }
      starsDiv.innerHTML = starsHtml;

      const textEl = document.querySelector('#existingFeedbackText');
      if (issue.feedback.text) {
        textEl.textContent = `"${issue.feedback.text}"`;
        textEl.style.display = 'block';
      } else {
        textEl.style.display = 'none';
      }
    } else {
      // No feedback yet, show form only if the user reported this issue
      const submitBtn = document.querySelector('#submitFeedbackBtn');
      // For simplicity, if they are in "dashboard" view it's their issue.
      if (currentTab === 'dashboard') {
        existingFeedback.style.display = 'none';
        leaveFeedbackForm.style.display = 'block';

        currentRating = 0;
        updateStarUI();
        document.querySelector('#feedbackText').value = '';
        submitBtn.onclick = () => submitFeedback(issue._id);
      } else {
        feedbackSection.style.display = 'none';
      }
    }
  } else {
    feedbackSection.style.display = 'none';
  }

  // Render Timeline
  const timelineContent = document.getElementById("modalTimelineContent");
  let timelineHtml = '';

  const bulletStyle = 'position: absolute; left: -1.75rem; top: 0; width: 0.8rem; height: 0.8rem; border-radius: 50%; background: var(--primary-color); border: 2px solid white; box-shadow: 0 0 0 2px var(--primary-color);';

  // 1. Submitted
  const submittedDate = new Date(issue.createdAt).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
  timelineHtml += `
    <div style="position: relative; padding-bottom: 1.5rem;">
      <div style="${bulletStyle}"></div>
      <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">Issue Submitted</div>
      <div style="font-size: 0.875rem; color: var(--text-secondary);">${submittedDate}</div>
    </div>
  `;

  // 2. In Progress
  if (issue.inProgressAt) {
    const progressDate = new Date(issue.inProgressAt).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
    const imgUrl = issue.inProgressImage ? (issue.inProgressImage.startsWith('http') ? issue.inProgressImage : '' + issue.inProgressImage) : '';
    timelineHtml += `
      <div style="position: relative; padding-bottom: 1.5rem;">
        <div style="${bulletStyle} background: #eab308; box-shadow: 0 0 0 2px #eab308;"></div>
        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">Marked as In Progress</div>
        <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">${progressDate}</div>
        ${issue.inProgressNote ? `<div style="font-size: 0.9375rem; background: var(--slate-50); padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--border-color); margin-bottom: 0.5rem;">${issue.inProgressNote}</div>` : ''}
        ${imgUrl ? `<a href="${imgUrl}" target="_blank"><img src="${imgUrl}" alt="In Progress Proof" style="max-width: 100%; max-height: 200px; border-radius: 0.5rem; border: 1px solid var(--border-color);"></a>` : ''}
      </div>
    `;
  }

  // 3. Resolved
  if (issue.resolvedAt) {
    const resolvedDate = new Date(issue.resolvedAt).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
    const imgUrl = issue.resolvedImage ? (issue.resolvedImage.startsWith('http') ? issue.resolvedImage : '' + issue.resolvedImage) : '';
    timelineHtml += `
      <div style="position: relative;">
        <div style="${bulletStyle} background: #22c55e; box-shadow: 0 0 0 2px #22c55e;"></div>
        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">Issue Resolved</div>
        <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">${resolvedDate}</div>
        ${issue.resolvedNote ? `<div style="font-size: 0.9375rem; background: var(--slate-50); padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--border-color); margin-bottom: 0.5rem;">${issue.resolvedNote}</div>` : ''}
        ${imgUrl ? `<a href="${imgUrl}" target="_blank"><img src="${imgUrl}" alt="Resolution Proof" style="max-width: 100%; max-height: 200px; border-radius: 0.5rem; border: 1px solid var(--border-color);"></a>` : ''}
      </div>
    `;
  }

  timelineContent.innerHTML = timelineHtml;

  // Initialize Map if coordinates present
  const mapContainer = document.getElementById('modalMapContainer');
  const mapEl = document.getElementById('modalMap');

  if (issue.lat && issue.lng && window.isLeafletLoaded) {
    mapContainer.style.display = 'block';

    // Slight delay to ensure modal is visible for proper map sizing
    setTimeout(() => {
      // Clear previous map instance if it exists
      if (window.citizenIssueMap) {
        window.citizenIssueMap.remove();
      }

      const pos = [issue.lat, issue.lng];
      window.citizenIssueMap = L.map(mapEl).setView(pos, 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(window.citizenIssueMap);

      L.marker(pos).addTo(window.citizenIssueMap);
    }, 100);
  } else {
    mapContainer.style.display = 'none';
  }

  // Hide main views and show details
  document.getElementById('dashboardView').style.display = 'none';
  document.getElementById('allIssuesView').style.display = 'none';
  const mapViewTab = document.getElementById('mapViewTab');
  if (mapViewTab) mapViewTab.style.display = 'none';
  document.getElementById('citizen-issue-details-container').style.display = 'block';
  window.scrollTo(0, 0);
}

let currentRating = 0;

function updateStarUI() {
  const stars = document.querySelectorAll('.star-btn');
  stars.forEach(star => {
    const val = parseInt(star.getAttribute('data-value'));
    if (val <= currentRating) {
      star.textContent = 'star';
      star.style.color = '#eab308';
    } else {
      star.textContent = 'star_border';
      star.style.color = 'var(--slate-300)';
    }
  });
}

async function submitFeedback(issueId) {
  if (currentRating === 0) {
    showToast('error', citizenText('common.selectStarRating', 'Please select a star rating.'));
    return;
  }

  const text = document.querySelector('#feedbackText').value.trim();
  const token = localStorage.getItem('citizen_token');
  const btn = document.querySelector('#submitFeedbackBtn');
  const originalText = btn.textContent;

  btn.disabled = true;
  btn.textContent = citizenText('common.submitting', 'Submitting...');

  try {
    const res = await fetch(`/api/issues/${issueId}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ rating: currentRating, text })
    });

    const data = await res.json();

    if (res.ok) {
      showToast('success', citizenText('common.feedbackSubmitted', 'Feedback submitted successfully!'));

      const issueIndex = allIssues.findIndex(i => i._id === issueId);
      if (issueIndex !== -1) {
        allIssues[issueIndex].feedback = data.issue.feedback;
      }

      const commIssueIndex = allCommunityIssues.findIndex(i => i._id === issueId);
      if (commIssueIndex !== -1) {
        allCommunityIssues[commIssueIndex].feedback = data.issue.feedback;
      }

      if (currentTab === 'dashboard') {
        applyFiltersAndRender();
      } else {
        applyAllIssuesFiltersAndRender();
      }

      openIssueDetails(data.issue);

    } else {
      showToast('error', data.message || citizenText('common.feedbackSubmitFailed', 'Failed to submit feedback.'));
    }
  } catch (err) {
    console.error(err);
    showToast('error', citizenText('common.networkError', 'Network error. Please try again.'));
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// Close issue details
function closeIssueDetails() {
  document.getElementById('citizen-issue-details-container').style.display = 'none';
  if (currentTab === 'dashboard') {
    document.getElementById('dashboardView').style.display = 'block';
  } else if (currentTab === 'mapView') {
    document.getElementById('mapViewTab').style.display = 'block';
    setTimeout(() => {
      if (window.citizenAllIssuesMapInstance) window.citizenAllIssuesMapInstance.invalidateSize();
    }, 100);
  } else {
    document.getElementById('allIssuesView').style.display = 'block';
  }
}

// Open profile view
window.openProfileModal = function (fromHash = false) {
  if (fromHash !== true) {
    history.pushState(null, null, '#profile');
  }

  // Populate profile data
  const userName_stored = localStorage.getItem('citizen_userName');
  const userEmail_stored = localStorage.getItem('citizen_userEmail');

  document.querySelector('#profileName').textContent = userName_stored || 'Citizen User';
  document.querySelector('#profileFullName').textContent = userName_stored || '-';
  document.querySelector('#profileEmail').textContent = userEmail_stored || '-';

  // Setup change password form
  const cpEmail = document.querySelector('#cpEmail');
  if (cpEmail) cpEmail.value = userEmail_stored || '';

  const cpForm = document.querySelector('#changePasswordForm');
  if (cpForm) cpForm.style.display = 'none';
  if (document.querySelector('#cpCurrentPassword')) document.querySelector('#cpCurrentPassword').value = '';
  if (document.querySelector('#cpNewPassword')) document.querySelector('#cpNewPassword').value = '';

  // Hide other views and show profile view
  document.getElementById('dashboardView').style.display = 'none';
  document.getElementById('allIssuesView').style.display = 'none';
  const detailsContainer = document.getElementById('citizen-issue-details-container');
  if (detailsContainer) detailsContainer.style.display = 'none';

  document.getElementById('profile-view-container').style.display = 'block';
  window.scrollTo(0, 0);
}

// Close profile view
window.closeProfileView = function () {
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  if (hash === 'profile') {
    history.pushState(null, null, currentTab === 'allIssues' ? '#allIssues' : '#dashboard');
    window.dispatchEvent(new Event('hashchange'));
  } else {
    window.dispatchEvent(new Event('hashchange'));
  }
}


// Toggle change password form
window.toggleChangePasswordForm = function () {
  const form = document.querySelector('#changePasswordForm');
  if (form) {
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  }
};

// Submit password change
window.submitPasswordChange = async function () {
  const email = document.querySelector('#cpEmail').value.trim();
  const currentPassword = document.querySelector('#cpCurrentPassword').value;
  const newPassword = document.querySelector('#cpNewPassword').value;

  if (!email || !currentPassword || !newPassword) {
    showToast('error', citizenText('common.allFieldsRequired', 'All fields are required.'));
    return;
  }

  const btn = document.querySelector('#submitPasswordBtn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = citizenText('common.updating', 'Updating...');

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: window.CityPlusApi.authHeaders('citizen', { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.json();

    if (res.ok) {
      showToast('success', citizenText('common.passwordChanged', 'Password changed successfully!'));
      document.querySelector('#changePasswordForm').style.display = 'none';
      document.querySelector('#cpCurrentPassword').value = '';
      document.querySelector('#cpNewPassword').value = '';
      toggleChangePasswordForm();
    } else {
      showToast('error', data.message || citizenText('common.passwordChangeFailed', 'Failed to change password.'));
    }
  } catch (err) {
    console.error(err);
    showToast('error', citizenText('common.networkError', 'Network error. Please try again.'));
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
};

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
          <p class="activity-item__title">${citizenText('activity.issueResolved', 'Issue Resolved:')} ${issue.title}</p>
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



  // Star feedback rating interactions
  const stars = document.querySelectorAll('.star-btn');
  stars.forEach(star => {
    star.addEventListener('click', () => {
      currentRating = parseInt(star.getAttribute('data-value'));
      updateStarUI();
    });
  });
}

// Logout function
function logout() {
  window.CityPlusApi.clearSession('citizen');
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
  window.CityPlusApi.clearSession('citizen');
  window.location.href = 'login.html';
}

// Setup logout confirmation listeners
document.addEventListener('DOMContentLoaded', () => {
  // Mobile menu toggle
  const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (mobileMenuToggle && sidebar) {
    mobileMenuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('active');
    });
  }

  // Desktop sidebar collapse toggle
  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  if (sidebarToggleBtn && sidebar) {
    sidebarToggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sidebar.classList.toggle('collapsed');
    });
  }

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
  // Use the global toast instead of alert
  showToast('error', message);
}

// Expose functions globally for HTML onclick handlers
window.switchToDashboardTab = switchToDashboardTab;
window.switchToAllIssuesTab = switchToAllIssuesTab;

async function refreshCitizenData(btn) {
  const icon = btn.querySelector('.material-icons-round');
  const originalHtml = btn.innerHTML;

  if (icon) icon.classList.add('spin-animation');
  btn.disabled = true;
  btn.innerHTML = `<span class="material-icons-round spin-animation">refresh</span> ${citizenText('common.refreshing', 'Refreshing...')}`;

  try {
    await loadCitizenIssues();
    updateActivityFeed();
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
}

async function refreshAllCommunityData(btn) {
  const icon = btn.querySelector('.material-icons-round');
  const originalHtml = btn.innerHTML;

  if (icon) icon.classList.add('spin-animation');
  btn.disabled = true;
  btn.innerHTML = `<span class="material-icons-round spin-animation">refresh</span> ${citizenText('common.refreshing', 'Refreshing...')}`;

  try {
    await loadAllCommunityIssues();
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
}

window.refreshCitizenData = refreshCitizenData;
window.refreshAllCommunityData = refreshAllCommunityData;
// Map Filters Logic
let citizenMapStatusFilter = "";

function parseLocationForMap(locationStr) {
  if (!locationStr) return { city: '', state: '' };
  const parts = locationStr.split(',').map(p => p.trim());
  if (parts.length >= 3) {
    return {
      state: parts[parts.length - 2].replace(/[0-9]/g, '').trim(),
      city: parts[parts.length - 3]
    };
  } else if (parts.length === 2) {
    return {
      state: parts[1].replace(/[0-9]/g, '').trim(),
      city: parts[0]
    };
  }
  return { city: locationStr, state: '' };
}

function populateMapSelect(select, label, values) {
  if (!select) return;
  select.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = label;
  select.appendChild(defaultOption);

  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function setupCitizenMapFilters(issues) {
  const statusSelect = document.getElementById('citizenMapStatusFilter');
  const resetButton = document.getElementById('citizenMapResetFilters');
  if (!statusSelect) return;

  populateMapSelect(statusSelect, "All Statuses", ["Pending", "In Progress", "Resolved", "Rejected"]);
  statusSelect.value = citizenMapStatusFilter;

  statusSelect.onchange = (e) => {
    citizenMapStatusFilter = e.target.value;
    applyAllIssuesFiltersAndRender();
  };

  if (resetButton) {
    resetButton.onclick = () => {
      citizenMapStatusFilter = "";
      setupCitizenMapFilters(issues);
      applyAllIssuesFiltersAndRender();
    };
  }
}
