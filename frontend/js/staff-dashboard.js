let staffAllIssues = [];
let staffAssignedIssues = [];
let currentStaffView = "dashboard"; // "dashboard", "all" or "assigned"

// Search and pagination variables
let currentStaffIssueSearchTerm = '';
let currentStaffIssueStatusFilter = '';
let currentStaffPage = 1;
const staffIssuesPerPage = 10;

async function loadStaffData() {
  const token = window.CityPlusApi.getToken("staff");

  if (!token) {
    window.location.href = "login.html";
    return;
  }

  const [allRes, assignedRes] = await Promise.all([
    fetch("/api/issues/all", {
      headers: { Authorization: "Bearer " + token }
    }),
    fetch("/api/issues/assigned/mine", {
      headers: { Authorization: "Bearer " + token }
    })
  ]);

  const allData = await allRes.json();
  const assignedData = await assignedRes.json();

  if (!allRes.ok) throw new Error(allData.message || "Unable to retrieve issues. Please refresh the page or try again later.");
  if (!assignedRes.ok) throw new Error(assignedData.message || "Unable to retrieve assigned issues. Please refresh the page or try again later.");

  staffAllIssues = allData.issues || [];
  window.staffAllIssues = staffAllIssues; // Global for map popup click
  staffAssignedIssues = assignedData.issues || [];

  renderStaffAnalytics();
  setupStaffMapFilters(staffAllIssues);
  renderStaffIssues();
}

function renderStaffAnalytics() {
  const total = staffAssignedIssues.length;
  let pending = 0;
  let inProgress = 0;
  let resolved = 0;
  let departmentName = "-";

  let highPriority = 0;
  let mediumPriority = 0;
  let lowPriority = 0;

  staffAssignedIssues.forEach(issue => {
    if (issue.status === "Pending") pending++;
    else if (issue.status === "In Progress") inProgress++;
    else if (issue.status === "Resolved") resolved++;

    if (issue.priority === "High") highPriority++;
    else if (issue.priority === "Medium") mediumPriority++;
    else if (issue.priority === "Low") lowPriority++;

    if (departmentName === "-" && issue.department && issue.department.name) {
      departmentName = issue.department.name;
    }
  });

  if (departmentName !== "-") {
    localStorage.setItem('staff_departmentName', departmentName);
  }

  const userName_stored = localStorage.getItem('staff_userName') || 'Staff';
  const staffDashboardTitle = document.getElementById("staffDashboardTitle");
  const staffDashboardSubtitle = document.getElementById("staffDashboardSubtitle");

  if (staffDashboardTitle) {
      staffDashboardTitle.textContent = `Welcome, ${userName_stored}`;
  }
  if (staffDashboardSubtitle) {
      staffDashboardSubtitle.textContent = departmentName !== "-" 
          ? `Here is an overview of your assigned issues for the ${departmentName} department.`
          : `Here is an overview of your assigned issues.`;
  }

  const statTotalAssigned = document.getElementById("statTotalAssigned");
  const statPending = document.getElementById("statPending");
  const statInProgress = document.getElementById("statInProgress");
  const statResolved = document.getElementById("statResolved");

  if (statTotalAssigned) statTotalAssigned.textContent = total;
  if (statPending) statPending.textContent = pending;
  if (statInProgress) statInProgress.textContent = inProgress;
  if (statResolved) statResolved.textContent = resolved;

  // Render Priority Breakdown
  const statHigh = document.getElementById("statHighPriority");
  const statMedium = document.getElementById("statMediumPriority");
  const statLow = document.getElementById("statLowPriority");
  const barHigh = document.getElementById("barHighPriority");
  const barMedium = document.getElementById("barMediumPriority");
  const barLow = document.getElementById("barLowPriority");

  if (statHigh) statHigh.textContent = highPriority;
  if (statMedium) statMedium.textContent = mediumPriority;
  if (statLow) statLow.textContent = lowPriority;

  if (total > 0) {
    if (barHigh) barHigh.style.width = `${(highPriority / total) * 100}%`;
    if (barMedium) barMedium.style.width = `${(mediumPriority / total) * 100}%`;
    if (barLow) barLow.style.width = `${(lowPriority / total) * 100}%`;
  } else {
    if (barHigh) barHigh.style.width = '0%';
    if (barMedium) barMedium.style.width = '0%';
    if (barLow) barLow.style.width = '0%';
  }

  // Render Widgets
  renderStaffDashboardWidgets();
}

function renderStaffDashboardWidgets() {
  // Render Recent Assigned Issues
  const recentIssuesBody = document.getElementById('staffRecentIssuesBody');
  if (recentIssuesBody) {
    // Sort by createdAt desc
    const sortedIssues = [...staffAssignedIssues].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const topIssues = sortedIssues.slice(0, 5);
    
    recentIssuesBody.innerHTML = '';
    
    if (topIssues.length === 0) {
      recentIssuesBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-secondary);">No issues assigned yet.</td></tr>`;
    } else {
      topIssues.forEach(issue => {
        const catName = issue.category ? (issue.category.name || issue.category) : '--';
        
        const statusClass = issue.status === 'Resolved' ? 'resolved' : issue.status === 'In Progress' ? 'progress' : issue.status === 'Rejected' ? 'rejected' : 'pending';
        const statusBadge = `<span class="issue-card-status ${statusClass}" style="padding: 0.15rem 0.5rem; border-radius: 9999px; font-weight: 500; font-size: 0.75rem;">${issue.status}</span>`;
        
        let priorityColor = 'var(--text-secondary)';
        if (issue.priority === 'High') priorityColor = '#ef4444';
        else if (issue.priority === 'Medium') priorityColor = '#eab308';
        else if (issue.priority === 'Low') priorityColor = '#22c55e';
        
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.className = 'hover-bg-slate-50';
        tr.innerHTML = `
          <td style="padding: 0.75rem 1.5rem;">${issue._id.slice(-6)}</td>
          <td style="padding: 0.75rem 1.5rem;">${catName}</td>
          <td style="padding: 0.75rem 1.5rem;"><span style="color: ${priorityColor}; font-weight: 500;">${issue.priority || '--'}</span></td>
          <td style="padding: 0.75rem 1.5rem;">${statusBadge}</td>
        `;
        // Hover effect helper style if not existing: tr:hover { background: var(--bg-primary); }
        tr.onmouseover = () => { tr.style.background = 'var(--bg-primary)'; };
        tr.onmouseleave = () => { tr.style.background = 'transparent'; };
        tr.onclick = () => openStaffIssueDetails(issue);
        recentIssuesBody.appendChild(tr);
      });
    }
  }

  // Render Recent Activity Timeline
  const activityTimeline = document.getElementById('staffRecentActivityTimeline');
  if (activityTimeline) {
    // Collect all updates: inProgress and resolved
    let activities = [];
    staffAssignedIssues.forEach(issue => {
      if (issue.inProgressAt) {
        activities.push({
          type: 'in_progress',
          issue: issue,
          date: new Date(issue.inProgressAt),
          title: `Marked #${issue._id.slice(-6)} In Progress`
        });
      }
      if (issue.resolvedAt) {
        activities.push({
          type: 'resolved',
          issue: issue,
          date: new Date(issue.resolvedAt),
          title: `Resolved #${issue._id.slice(-6)}`
        });
      }
    });
    
    // Sort by date desc
    activities.sort((a, b) => b.date - a.date);
    const topActivities = activities.slice(0, 5);
    
    activityTimeline.innerHTML = '';
    
    if (topActivities.length === 0) {
      activityTimeline.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.875rem;">No recent updates found.</div>';
    } else {
      const bulletStyle = 'position: absolute; left: -1.35rem; top: 0.25rem; width: 0.7rem; height: 0.7rem; border-radius: 50%; border: 2px solid white;';
      
      topActivities.forEach(act => {
        const timeAgo = getTimeAgo(act.date);
        const color = act.type === 'resolved' ? '#22c55e' : '#eab308';
        
        const div = document.createElement('div');
        div.style.position = 'relative';
        div.style.paddingBottom = '0.5rem';
        div.innerHTML = `
          <div style="${bulletStyle} background: ${color}; box-shadow: 0 0 0 2px ${color};"></div>
          <div style="font-weight: 500; color: var(--text-primary); cursor: pointer; display: inline-block; font-size: 0.9375rem; text-decoration: underline; text-decoration-color: transparent; transition: text-decoration-color 0.2s ease;" onmouseover="this.style.textDecorationColor='var(--text-primary)'" onmouseout="this.style.textDecorationColor='transparent'" onclick="openStaffActivityIssue('${act.issue._id}')">${act.title}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary);">${timeAgo}</div>
        `;
        activityTimeline.appendChild(div);
      });
    }
  }
}

// Add helper function for time ago
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  if (seconds < 10) return "Just now";
  return Math.floor(seconds) + " seconds ago";
}

window.openStaffActivityIssue = function(issueId) {
  const issue = staffAssignedIssues.find(i => i._id === issueId);
  if (issue) openStaffIssueDetails(issue);
};

function renderStaffIssues() {
  const tbody = document.querySelector("#staffIssuesBody");
  if (tbody) tbody.innerHTML = "";

  const source = (currentStaffView === "all" || currentStaffView === "map") ? staffAllIssues : staffAssignedIssues;
  const isViewOnly = currentStaffView === "all" || currentStaffView === "map";

  // Update page title and subtitle
  const pageTitle = document.querySelector("#pageTitle");
  const pageSubtitle = document.querySelector("#pageSubtitle");

  if (currentStaffView === "all") {
    pageTitle.textContent = "City-wide Issues";
    pageSubtitle.textContent = "View all civic issues reported by citizens.";
  } else {
    pageTitle.textContent = "My Assigned Issues";
    pageSubtitle.textContent = "Manage and update your assigned issues.";
  }

  // Apply Search and Filters
  let filteredIssues = source;
  if (currentStaffIssueSearchTerm.trim()) {
    const searchLower = currentStaffIssueSearchTerm.toLowerCase();
    filteredIssues = filteredIssues.filter(issue =>
      (issue._id && issue._id.toLowerCase().includes(searchLower)) ||
      (issue.category && issue.category.toLowerCase().includes(searchLower)) ||
      (issue.location && issue.location.toLowerCase().includes(searchLower)) ||
      (issue.citizen && issue.citizen.name && issue.citizen.name.toLowerCase().includes(searchLower))
    );
  }

  if (currentStaffIssueStatusFilter) {
    filteredIssues = filteredIssues.filter(issue => issue.status === currentStaffIssueStatusFilter);
  }

  updateStaffIssueSearchResultsInfo(filteredIssues, source.length);

  // If map tab is active, re-render map before early returns
  const mapTab = document.getElementById('staff-map-view-container');
  if (mapTab && mapTab.style.display !== 'none') {
    let mapFilteredIssues = filteredIssues;
    if (staffMapStatusFilter) {
       mapFilteredIssues = mapFilteredIssues.filter(issue => {
         return !staffMapStatusFilter || issue.status === staffMapStatusFilter;
       });
    }
    renderStaffAllIssuesMap(mapFilteredIssues);
  }

  if (filteredIssues.length === 0) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No issues found matching your search criteria.</td></tr>`;
    renderStaffPagination(0);
    return;
  }

  // Calculate pagination
  const totalItems = filteredIssues.length;
  const totalPages = Math.ceil(totalItems / staffIssuesPerPage);

  if (currentStaffPage > totalPages) {
    currentStaffPage = totalPages > 0 ? totalPages : 1;
  }

  const startIndex = (currentStaffPage - 1) * staffIssuesPerPage;
  const endIndex = Math.min(startIndex + staffIssuesPerPage, totalItems);
  const currentIssuesSlice = filteredIssues.slice(startIndex, endIndex);

  currentIssuesSlice.forEach(issue => {
    const created = new Date(issue.createdAt).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric"
    });

    const citizenName = issue.citizen ? issue.citizen.name : "-";
    const departmentName = issue.department ? issue.department.name : "-";

    const imageCell = issue.image
      ? `<a href="${issue.image.startsWith('http') ? issue.image : '' + issue.image}" target="_blank" title="View full image"><img src="${issue.image.startsWith('http') ? issue.image : '' + issue.image}" alt="Issue" style="width: 60px; height: 40px; object-fit: cover; border-radius: 4px;"></a>`
      : "-";

    const statusOptions = ["Pending", "In Progress", "Resolved", "Rejected"]
      .map(s => `<option value="${s}" ${issue.status === s ? "selected" : ""}>${s}</option>`)
      .join("");

    const tr = document.createElement("tr");
    tr.setAttribute("data-id", issue._id);

    // For "All Issues" view: disable action. For "Assigned" view, show view button.
    const statusClass = issue.status === 'Resolved' ? 'resolved' : issue.status === 'In Progress' ? 'progress' : issue.status === 'Rejected' ? 'rejected' : 'pending';
    const statusBadge = `<span class="issue-card-status ${statusClass}" style="padding: 0.25rem 0.75rem; border-radius: 9999px; font-weight: 500; font-size: 0.875rem;">${issue.status}</span>`;
    const statusCell = `<td>${statusBadge}</td>`;

    const actionCell = isViewOnly
      ? `<td><button class="btn btn-primary btn-small" onclick="openStaffIssueDetailsFromTable(this)" disabled style="opacity: 0.5; cursor: not-allowed;">View Only</button></td>`
      : `<td><button class="btn btn-primary btn-small" onclick="openStaffIssueDetailsFromTable(this)">View</button></td>`;

    tr.innerHTML = `
      <td>${issue._id.slice(-6)}</td>
      <td>
        ${issue.category}
        ${issue.feedback ? `<div style="color:#eab308;display:flex;align-items:center;font-size:0.875rem;margin-top:0.25rem;"><span class="material-icons-round" style="font-size:1rem;">star</span> ${issue.feedback.rating}</div>` : ''}
      </td>
      <td>${departmentName}</td>
      <td>${issue.location}</td>
      <td>${issue.priority}</td>
      <td>${citizenName}</td>
      <td>${imageCell}</td>
      ${statusCell}
      ${actionCell}
    `;
    tr.dataset.issue = JSON.stringify(issue);
    tr.style.cursor = "pointer";
    tr.onclick = (e) => {
      if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'A' || e.target.closest('a')) return;
      openStaffIssueDetails(issue);
    };
    tbody.appendChild(tr);
  });

    renderStaffPagination(totalItems, totalPages);
}

// Map View Logic
let currentStaffIssueViewMode = 'list';

window.renderStaffAllIssuesMap = function(issues) {
  if (!window.isLeafletLoaded || typeof L === 'undefined') return;
  
  const mapEl = document.getElementById('staffAllIssuesMap');
  if (!mapEl) return;
  
  if (!window.staffAllIssuesMapInstance) {
    window.staffAllIssuesMapInstance = L.map(mapEl).setView([19.2952, 73.0544], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(window.staffAllIssuesMapInstance);

    if (L.Control && L.Control.geocoder) {
      L.Control.geocoder({
        defaultMarkGeocode: false
      }).on('markgeocode', function(e) {
        var bbox = e.geocode.bbox;
        window.staffAllIssuesMapInstance.fitBounds(bbox);
      }).addTo(window.staffAllIssuesMapInstance);
    }
  }
  
  if (window.staffAllIssuesMarkers) {
    window.staffAllIssuesMapInstance.removeLayer(window.staffAllIssuesMarkers);
  }
  
  window.staffAllIssuesMarkers = L.layerGroup().addTo(window.staffAllIssuesMapInstance);
  const bounds = [];
  
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
      let statusColor = '#ef4444';
      if (issue.status === 'In Progress') statusColor = '#eab308';
      else if (issue.status === 'Resolved') statusColor = '#22c55e';
      else if (issue.status === 'Rejected') statusColor = '#b91c1c';
      marker.bindTooltip(`
        <div style="min-width:180px;">
          <strong style="font-size:0.875rem;">${issue.title || issue.category}</strong><br/>
          <span style="font-size:0.8rem; color:#666;">📍 ${issue.location ? issue.location.substring(0, 40) : '--'}</span><br/>
          <span style="font-size:0.8rem;">📂 ${issue.category}</span><br/>
          <span style="font-size:0.8rem; color:${statusColor}; font-weight:600;">● ${issue.status}</span>
        </div>
      `, { direction: 'top', opacity: 0.95 });

      // Rich popup on click
      const created = new Date(issue.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric"
      });
      const popupContent = `
        <div style="min-width:220px; max-width:280px; font-family: inherit;">
          ${issue.image ? `<img src="${issue.image.startsWith('http') ? issue.image : issue.image}" alt="${issue.title}" style="width:100%; height:120px; object-fit:cover; border-radius:0.375rem; margin-bottom:0.5rem;">` : ''}
          <h4 style="margin:0 0 0.25rem 0; font-size:0.95rem; color:#1e293b;">${issue.title || 'Untitled'}</h4>
          <div style="display:flex; gap:0.35rem; flex-wrap:wrap; margin-bottom:0.35rem;">
            <span style="background:rgba(59,130,246,0.1); color:#3b82f6; padding:0.1rem 0.5rem; border-radius:9999px; font-size:0.7rem; font-weight:600;">${issue.category}</span>
            <span style="background:${statusColor}20; color:${statusColor}; padding:0.1rem 0.5rem; border-radius:9999px; font-size:0.7rem; font-weight:600;">${issue.status}</span>
          </div>
          <p style="margin:0 0 0.25rem 0; font-size:0.8rem; color:#64748b;">📍 ${issue.location || '--'}</p>
          <p style="margin:0 0 0.5rem 0; font-size:0.75rem; color:#94a3b8;">Submitted: ${created}</p>
          ${issue.description ? `<p style="margin:0 0 0.5rem 0; font-size:0.8rem; color:#475569; line-height:1.4;">${issue.description.substring(0, 100)}${issue.description.length > 100 ? '...' : ''}</p>` : ''}
          <button onclick="openStaffIssueDetails(window.staffAllIssues.find(i => i._id === '${issue._id}'))" style="width:100%; padding:0.4rem; background:#3b82f6; color:white; border:none; border-radius:0.375rem; font-size:0.8rem; font-weight:600; cursor:pointer;">View Full Details</button>
        </div>
      `;
      marker.bindPopup(popupContent, { maxWidth: 300 });

      window.staffAllIssuesMarkers.addLayer(marker);
    }
  });

  if (bounds.length > 0) {
    if (bounds.length === 1) {
      window.staffAllIssuesMapInstance.setView(bounds[0], 15);
    } else {
      window.staffAllIssuesMapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  } else {
    window.staffAllIssuesMapInstance.setView([19.2952, 73.0544], 13);
  }

  setTimeout(() => window.staffAllIssuesMapInstance.invalidateSize(), 100);
}

function renderStaffPagination(totalItems, totalPages = 0) {
  const paginationContainer = document.getElementById('staffIssuePagination');
  if (!paginationContainer) return;

  if (totalItems <= staffIssuesPerPage) {
    paginationContainer.style.display = 'none';
    return;
  }

  paginationContainer.style.display = 'flex';

  let html = `
    <button class="btn btn-outline btn-small" ${currentStaffPage === 1 ? 'disabled' : ''} onclick="changeStaffIssuePage(${currentStaffPage - 1})">
      <span class="material-icons-round" style="font-size: 1.2rem;">chevron_left</span> Previous
    </button>
    <div style="display: flex; align-items: center; gap: 0.5rem; margin: 0 1rem; color: var(--text-secondary); font-size: 0.9rem;">
      Page <strong style="color: var(--text-primary);">${currentStaffPage}</strong> of <strong>${totalPages}</strong>
    </div>
    <button class="btn btn-outline btn-small" ${currentStaffPage === totalPages ? 'disabled' : ''} onclick="changeStaffIssuePage(${currentStaffPage + 1})">
      Next <span class="material-icons-round" style="font-size: 1.2rem;">chevron_right</span>
    </button>
  `;

  paginationContainer.innerHTML = html;
}

function changeStaffIssuePage(newPage) {
  currentStaffPage = newPage;
  renderStaffIssues();
}

function updateStaffIssueSearchResultsInfo(filteredIssues, totalIssues) {
  const totalCount = totalIssues;
  const resultCount = filteredIssues.length;
  const resultsInfo = document.getElementById('staffIssueSearchResultsInfo');

  if (currentStaffIssueSearchTerm || currentStaffIssueStatusFilter) {
    resultsInfo.style.display = 'flex';
    document.getElementById('staffIssueResultCount').textContent = resultCount;
    document.getElementById('staffIssueTotalCount').textContent = totalCount;
  } else {
    resultsInfo.style.display = 'none';
  }
}

window.clearStaffIssueSearch = function () {
  document.getElementById('staffIssueSearchInput').value = '';
  currentStaffIssueSearchTerm = '';
  currentStaffPage = 1;
  document.getElementById('clearStaffIssueSearchBtn').style.display = 'none';
  renderStaffIssues();
};

window.resetStaffIssueFilters = function () {
  currentStaffIssueSearchTerm = '';
  currentStaffIssueStatusFilter = '';
  currentStaffPage = 1;

  document.getElementById('staffIssueSearchInput').value = '';
  document.getElementById('staffIssueStatusFilter').value = '';
  document.getElementById('clearStaffIssueSearchBtn').style.display = 'none';
  document.getElementById('staffIssueSearchResultsInfo').style.display = 'none';

  renderStaffIssues();
};


document.addEventListener("DOMContentLoaded", async () => {
  // Set user profile in sidebar
  const userName_stored = localStorage.getItem('staff_userName');
  const userEmail_stored = localStorage.getItem('staff_userEmail');
  if (userName_stored) {
    const nameEl = document.getElementById('userName');
    if (nameEl) nameEl.textContent = userName_stored;
  }
  if (userEmail_stored) {
    const emailEl = document.getElementById('userEmail');
    if (emailEl) emailEl.textContent = userEmail_stored;
  }

  const staffIssuesBody = document.querySelector("#staffIssuesBody");
  const tabDashboardLink = document.querySelector("#tab-dashboard");
  const tabAllIssuesLink = document.querySelector("#tab-all-issues");
  const tabMyAssignedLink = document.querySelector("#tab-my-assigned");

  loadStaffData().catch(err => {
    console.error(err);
    showToast('error', err.message || "A system error occurred while loading data. Please refresh the page or contact support.");
  });

  if (window.loadLeafletApi) await window.loadLeafletApi();

  // Handle browser back/forward buttons and initial load
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    activateStaffTab(hash);
  });

  // initial load
  const initialHash = window.location.hash.replace('#', '') || 'dashboard';
  activateStaffTab(initialHash);

  // Handle Dashboard click
  if (tabDashboardLink) {
    tabDashboardLink.addEventListener("click", (e) => {
      e.preventDefault();
      history.pushState(null, null, '#dashboard');
      activateStaffTab('dashboard');
    });
  }

  // Handle All Issues click
  tabAllIssuesLink.addEventListener("click", (e) => {
    e.preventDefault();
    history.pushState(null, null, '#all');
    activateStaffTab('all');
  });

  // Handle My Assigned Issues click
  tabMyAssignedLink.addEventListener("click", (e) => {
    e.preventDefault();
    history.pushState(null, null, '#assigned');
    activateStaffTab('assigned');
  });

  // Handle Map View click
  const tabMapViewLink = document.getElementById("tab-map-view");
  if (tabMapViewLink) {
    tabMapViewLink.addEventListener("click", (e) => {
      e.preventDefault();
      history.pushState(null, null, '#map');
      activateStaffTab('map');
    });
  }

  // Main activate tab logic
  function activateStaffTab(hash) {
    if (hash === 'profile') {
      window.openProfileModal(true);
      return;
    }

    // hide profile container if active
    const profileContainer = document.getElementById('profile-view-container');
    if (profileContainer) profileContainer.style.display = 'none';

    if (hash === 'assigned') {
      currentStaffView = "assigned";
      tabMyAssignedLink.classList.add("active", "nav-link--active");
      tabAllIssuesLink.classList.remove("active", "nav-link--active");
      if (tabDashboardLink) tabDashboardLink.classList.remove("active", "nav-link--active");
      const mapTabLink = document.getElementById('tab-map-view');
      if (mapTabLink) mapTabLink.classList.remove("active", "nav-link--active");
    } else if (hash === 'all') {
      currentStaffView = "all";
      tabAllIssuesLink.classList.add("active", "nav-link--active");
      tabMyAssignedLink.classList.remove("active", "nav-link--active");
      if (tabDashboardLink) tabDashboardLink.classList.remove("active", "nav-link--active");
      const mapTabLink = document.getElementById('tab-map-view');
      if (mapTabLink) mapTabLink.classList.remove("active", "nav-link--active");
    } else if (hash === 'map') {
      currentStaffView = "map";
      const mapTabLink = document.getElementById('tab-map-view');
      if (mapTabLink) mapTabLink.classList.add("active", "nav-link--active");
      tabAllIssuesLink.classList.remove("active", "nav-link--active");
      tabMyAssignedLink.classList.remove("active", "nav-link--active");
      if (tabDashboardLink) tabDashboardLink.classList.remove("active", "nav-link--active");
    } else {
      currentStaffView = "dashboard";
      if (tabDashboardLink) tabDashboardLink.classList.add("active", "nav-link--active");
      tabAllIssuesLink.classList.remove("active", "nav-link--active");
      tabMyAssignedLink.classList.remove("active", "nav-link--active");
      const mapTabLink = document.getElementById('tab-map-view');
      if (mapTabLink) mapTabLink.classList.remove("active", "nav-link--active");
    }

    // Ensure details view is closed when switching tabs
    const detailsTab = document.getElementById("staff-issue-details-container");
    const mainTab = document.getElementById("staff-main-container");
    const dashboardTab = document.getElementById("staff-dashboard-container");
    const assignedTab = document.getElementById("staff-my-assigned-container");
    const mapViewTab = document.getElementById("staff-map-view-container");
    
    if (detailsTab) detailsTab.style.display = "none";
    
    if (currentStaffView === 'dashboard') {
      if (dashboardTab) dashboardTab.style.display = "block";
      if (mainTab) mainTab.style.display = "none";
      if (assignedTab) assignedTab.style.display = "none";
      if (mapViewTab) mapViewTab.style.display = "none";
    } else if (currentStaffView === 'all') {
      if (dashboardTab) dashboardTab.style.display = "none";
      if (mainTab) mainTab.style.display = "block";
      if (assignedTab) assignedTab.style.display = "none";
      if (mapViewTab) mapViewTab.style.display = "none";
    } else if (currentStaffView === 'assigned') {
      if (dashboardTab) dashboardTab.style.display = "none";
      if (mainTab) mainTab.style.display = "block";
      if (assignedTab) assignedTab.style.display = "none";
      if (mapViewTab) mapViewTab.style.display = "none";
    } else if (currentStaffView === 'map') {
      if (dashboardTab) dashboardTab.style.display = "none";
      if (mainTab) mainTab.style.display = "none";
      if (assignedTab) assignedTab.style.display = "none";
      if (mapViewTab) mapViewTab.style.display = "block";
    }

    renderStaffIssues();

    // Auto-close sidebar on mobile
    if (window.innerWidth <= 1024) {
      document.querySelector('.sidebar').classList.remove('active');
    }
  }

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

  // Event listener for status changes in table is removed; changes are made via modal only.

  // Event listeners for search and filter
  const searchInput = document.getElementById('staffIssueSearchInput');
  const clearSearchBtn = document.getElementById('clearStaffIssueSearchBtn');
  const statusFilter = document.getElementById('staffIssueStatusFilter');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentStaffIssueSearchTerm = e.target.value;
      currentStaffPage = 1;

      if (clearSearchBtn) {
        clearSearchBtn.style.display = currentStaffIssueSearchTerm ? 'block' : 'none';
      }

      renderStaffIssues();
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      currentStaffIssueStatusFilter = e.target.value;
      currentStaffPage = 1;
      renderStaffIssues();
    });
  }
});

// Helper function to open modal from table button
function openStaffIssueDetailsFromTable(button) {
  const row = button.closest("tr");
  const issueData = JSON.parse(row.dataset.issue);
  openStaffIssueDetails(issueData);
}

// Details functions for staff
function openStaffIssueDetails(issue) {
  const created = new Date(issue.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric"
  });

  let statusClass = "pending";
  if (issue.status === "In Progress") statusClass = "progress";
  if (issue.status === "Resolved") statusClass = "resolved";
  if (issue.status === "Rejected") statusClass = "rejected";

  // Set title
  document.getElementById("staffDetailsTitle").textContent = `Issue #${issue._id.slice(-6)}: ${issue.title || 'Untitled'}`;

  // Set image
  const imageContainer = document.getElementById("staffModalImageContainer");
  if (issue.image) {
    imageContainer.innerHTML = `<img src="${issue.image.startsWith('http') ? issue.image : '' + issue.image}" alt="Issue Image" style="width:100%; height:100%; object-fit:cover;">`;
  } else {
    imageContainer.innerHTML = `
      <div class="issue-modal-no-image" style="display:flex; flex-direction:column; align-items:center; color:var(--text-secondary); padding: 3rem;">
        <span class="material-icons-round" style="font-size:3rem; margin-bottom:1rem;">image_not_supported</span>
        <span>No image provided</span>
      </div>
    `;
  }

  // Set badges
  const badgesHtml = `
    <span class="issue-modal-badge category" style="padding: 0.25rem 0.75rem; border-radius: 9999px; font-weight: 500; font-size: 0.875rem; background: var(--primary-color-light); color: var(--primary-color);">${issue.category}</span>
    <span class="issue-modal-badge status issue-card-status ${statusClass}" style="padding: 0.25rem 0.75rem; border-radius: 9999px; font-weight: 500; font-size: 0.875rem;">${issue.status}</span>
  `;
  document.getElementById("staffModalBadges").innerHTML = badgesHtml;

  // Set description
  document.getElementById("staffModalDescription").textContent = issue.description || "No description provided.";

  // Set details
  document.getElementById("staffModalComplaintId").textContent = issue._id ? `#${issue._id.slice(-6)}` : "---";
  document.getElementById("staffModalLocation").textContent = issue.location || "--";

  document.getElementById("staffModalCategory").textContent = issue.category ? (issue.category.name || issue.category) : "--";
  document.getElementById("staffModalDepartment").textContent = issue.department ? issue.department.name : "Unassigned";
  document.getElementById("staffModalPriority").textContent = issue.priority || "--";
  document.getElementById("staffModalDate").textContent = created;
  document.getElementById("staffModalCitizen").textContent = issue.citizen ? issue.citizen.name : "Anonymous";
  document.getElementById("staffModalEmail").textContent = issue.citizen ? issue.citizen.email : "--";

  // Set status form or show resolved message
  const statusForm = document.getElementById("staffModalStatusForm");
  const resolvedMsg = document.getElementById("staffModalStatusResolvedMsg");
  const rejectedMsg = document.getElementById("staffModalStatusRejectedMsg");
  const rejectSection = document.getElementById("staffModalRejectRequestSection");
  const statusSelect = document.getElementById("staffModalStatusSelect");
  const noteInput = document.getElementById("staffModalStatusNote");
  const imageInput = document.getElementById("staffModalStatusImage");
  const rejectNoteInput = document.getElementById("staffModalRejectNote");

  if (issue.status === "Resolved") {
    if (statusForm) statusForm.style.display = "none";
    if (resolvedMsg) resolvedMsg.style.display = "block";
    if (rejectedMsg) rejectedMsg.style.display = "none";
    if (rejectSection) rejectSection.style.display = "none";
  } else if (issue.status === "Rejected") {
    if (statusForm) statusForm.style.display = "none";
    if (resolvedMsg) resolvedMsg.style.display = "none";
    if (rejectedMsg) rejectedMsg.style.display = "block";
    if (rejectSection) rejectSection.style.display = "none";
  } else {
    if (statusForm) statusForm.style.display = "block";
    if (resolvedMsg) resolvedMsg.style.display = "none";
    if (rejectedMsg) rejectedMsg.style.display = "none";
    if (statusSelect) {
      statusSelect.value = issue.status;
      statusSelect.dataset.issueId = issue._id;

      // Enable all status options (backward transitions allowed)
      Array.from(statusSelect.options).forEach(opt => {
        opt.disabled = false;
      });
    }
    if (noteInput) noteInput.value = "";
    if (imageInput) imageInput.value = "";
    if (rejectSection) rejectSection.style.display = currentStaffView === "all" ? "none" : "block";
    if (rejectNoteInput) rejectNoteInput.value = "";
  }

  // Set Feedback
  const feedbackSection = document.getElementById("staffModalFeedbackSection");
  if (issue.feedback && issue.feedback.rating) {
    feedbackSection.style.display = "block";
    const starsDiv = document.getElementById("staffModalExistingRatingStars");
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      starsHtml += `<span class="material-icons-round" style="font-size:1.25rem;">${i <= issue.feedback.rating ? 'star' : 'star_border'}</span>`;
    }
    starsDiv.innerHTML = starsHtml;

    const textEl = document.getElementById("staffModalExistingFeedbackText");
    if (issue.feedback.text) {
      textEl.textContent = `"${issue.feedback.text}"`;
      textEl.style.display = "block";
    } else {
      textEl.style.display = "none";
    }
  } else {
    feedbackSection.style.display = "none";
  }

  // Render Timeline
  const timelineContent = document.getElementById("staffModalTimelineContent");
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
  const mapContainer = document.getElementById('staffModalMapContainer');
  const mapEl = document.getElementById('staffModalMap');

  if (issue.lat && issue.lng && window.isLeafletLoaded) {
    mapContainer.style.display = 'block';

    setTimeout(() => {
      // Clear previous map instance if it exists
      if (window.staffIssueMap) {
        window.staffIssueMap.remove();
      }

      const pos = [issue.lat, issue.lng];
      window.staffIssueMap = L.map(mapEl).setView(pos, 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(window.staffIssueMap);

      L.marker(pos).addTo(window.staffIssueMap);

      // Fix map styling glitch
      setTimeout(() => { window.staffIssueMap.invalidateSize() }, 100);
    }, 100);
  } else {
    mapContainer.style.display = 'none';
  }

  // Hide or show the status update section based on current view
  const statusUpdateSection = document.getElementById("staffModalStatusUpdateSection");
  if (statusUpdateSection) {
    if (currentStaffView === "all") {
      statusUpdateSection.style.display = "none";
    } else {
      statusUpdateSection.style.display = "block";
    }
  }

  // Show details view
  const detailsTab = document.getElementById("staff-issue-details-container");
  const mainTab = document.getElementById("staff-main-container");
  const dashboardTab = document.getElementById("staff-dashboard-container");
  const mapViewTab = document.getElementById("staff-map-view-container");
  if (mainTab) mainTab.style.display = "none";
  if (dashboardTab) dashboardTab.style.display = "none";
  if (mapViewTab) mapViewTab.style.display = "none";
  if (detailsTab) detailsTab.style.display = "block";
  window.scrollTo(0, 0);
}

function closeStaffIssueDetails() {
  const detailsTab = document.getElementById("staff-issue-details-container");
  const mainTab = document.getElementById("staff-main-container");
  const dashboardTab = document.getElementById("staff-dashboard-container");
  const mapViewTab = document.getElementById("staff-map-view-container");
  if (detailsTab) detailsTab.style.display = "none";
  
  if (currentStaffView === "dashboard") {
    if (dashboardTab) dashboardTab.style.display = "block";
  } else if (currentStaffView === "map") {
    if (mapViewTab) mapViewTab.style.display = "block";
    // Refresh map size after re-showing
    setTimeout(() => {
      if (window.staffAllIssuesMapInstance) window.staffAllIssuesMapInstance.invalidateSize();
    }, 100);
  } else {
    if (mainTab) mainTab.style.display = "block";
  }
}

async function updateStaffIssueStatus() {
  const statusSelect = document.getElementById("staffModalStatusSelect");
  const issueId = statusSelect.dataset.issueId;
  const newStatus = statusSelect.value;
  const noteContent = document.getElementById("staffModalStatusNote").value;
  const imageInput = document.getElementById("staffModalStatusImage");
  const file = imageInput.files[0];
  if (newStatus !== "Rejected" && (newStatus === "In Progress" || newStatus === "Resolved") && !file) {
    showToast('warning', `An image proof is required to change status to ${newStatus}.`);
    return;
  }

  const token = localStorage.getItem("staff_token");

  // Show loading state
  const btn = document.getElementById("staffModalStatusSubmitBtn");
  const originalHtml = btn.innerHTML;
  btn.innerHTML = 'Updating...';
  btn.disabled = true;

  try {
    if (newStatus === "Rejected") {
      const res = await fetch(`/api/issues/${issueId}/reject`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({ note: noteContent || "" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reject issue.");
      showToast('success', 'Issue rejected successfully.');
    } else {
      if ((newStatus === "In Progress" || newStatus === "Resolved") && !file) {
        showToast('warning', `An image proof is required to change status to ${newStatus}.`);
        return;
      }

      const formData = new FormData();
      formData.append("status", newStatus);
      if (noteContent) formData.append("note", noteContent);
      if (file) formData.append("image", file);

      const res = await fetch(`/api/issues/${issueId}/status`, {
        method: "PATCH",
        headers: {
          Authorization: "Bearer " + token
        },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update status.");
      showToast('success', `Issue status successfully updated to "${newStatus}".`);
    }
    closeStaffIssueDetails();
    loadStaffData();
  } catch (err) {
    console.error("Error updating status:", err);
    showToast('error', err.message);
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
}

async function requestStaffIssueReject() {
  const statusSelect = document.getElementById("staffModalStatusSelect");
  const issueId = statusSelect.dataset.issueId;
  const noteContent = document.getElementById("staffModalRejectNote").value;
  const token = localStorage.getItem("staff_token");
  const btn = document.getElementById("staffModalRejectSubmitBtn");
  const originalHtml = btn.innerHTML;

  btn.innerHTML = 'Sending...';
  btn.disabled = true;

  try {
    const res = await fetch(`/api/issues/${issueId}/reject-request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ note: noteContent || "" })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to send rejection request.");
    showToast('success', 'Rejection request sent to admins.');
    closeStaffIssueDetails();
  } catch (err) {
    console.error("Error requesting rejection:", err);
    showToast('error', err.message);
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
}

// Expose for inline HTML
window.closeStaffIssueDetails = closeStaffIssueDetails;
window.updateStaffIssueStatus = updateStaffIssueStatus;
window.requestStaffIssueReject = requestStaffIssueReject;

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
  window.CityPlusApi.clearSession('staff');
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

// Expose for inline HTML
window.showLogoutConfirmation = showLogoutConfirmation;

async function refreshStaffData(btn) {
  const icon = btn.querySelector('.material-icons-round');
  const originalHtml = btn.innerHTML;

  if (icon) icon.classList.add('spin-animation');
  btn.disabled = true;
  btn.innerHTML = `<span class="material-icons-round spin-animation">refresh</span> Refreshing...`;

  try {
    await loadStaffData();
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
}

window.refreshStaffData = refreshStaffData;

// Open profile view
window.openProfileModal = function (fromHash = false) {
  if (!fromHash) {
    history.pushState(null, null, '#profile');
  }

  // Populate profile data
  const userName_stored = localStorage.getItem('staff_userName');
  const userEmail_stored = localStorage.getItem('staff_userEmail');

  let profileDepartmentName = "-";
  
  if (typeof staffAssignedIssues !== 'undefined' && staffAssignedIssues.length > 0) {
    const issueWithDept = staffAssignedIssues.find(i => i.department && i.department.name);
    if (issueWithDept) {
      profileDepartmentName = issueWithDept.department.name;
    }
  }

  document.querySelector('#profileName').textContent = userName_stored || 'Staff User';
  document.querySelector('#profileFullName').textContent = userName_stored || '-';
  document.querySelector('#profileEmail').textContent = userEmail_stored || '-';
  
  const deptEl = document.querySelector('#profileDepartment');
  if (deptEl) {
    deptEl.textContent = profileDepartmentName !== "-" ? profileDepartmentName : (localStorage.getItem('departmentName') || "Loading...");
    // Let's also check if renderStaffAnalytics calculated something we can use, but the above is safer.
  }

  // Setup change password form
  const cpEmail = document.querySelector('#cpEmail');
  if (cpEmail) cpEmail.value = userEmail_stored || '';

  const cpForm = document.querySelector('#changePasswordForm');
  if (cpForm) cpForm.style.display = 'none';
  if (document.querySelector('#cpCurrentPassword')) document.querySelector('#cpCurrentPassword').value = '';
  if (document.querySelector('#cpNewPassword')) document.querySelector('#cpNewPassword').value = '';

  // Hide other views and show profile view
  const mainTab = document.getElementById("staff-main-container");
  if (mainTab) mainTab.style.display = "none";
  const dashboardTab = document.getElementById("staff-dashboard-container");
  if (dashboardTab) dashboardTab.style.display = "none";
  const detailsTab = document.getElementById("staff-issue-details-container");
  if (detailsTab) detailsTab.style.display = "none";

  document.getElementById('profile-view-container').style.display = 'block';
  window.scrollTo(0, 0);
};

// Close profile view
window.closeProfileView = function () {
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  if (hash === 'profile') {
    history.pushState(null, null, '#dashboard');
    window.dispatchEvent(new Event('hashchange'));
  } else {
    window.dispatchEvent(new Event('hashchange'));
  }
};

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
    showToast('error', 'All fields are required.');
    return;
  }

  const btn = document.querySelector('#submitPasswordBtn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Updating...';

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: window.CityPlusApi.authHeaders('staff', { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.json();

    if (res.ok) {
      showToast('success', 'Password changed successfully!');
      document.querySelector('#cpCurrentPassword').value = '';
      document.querySelector('#cpNewPassword').value = '';
      toggleChangePasswordForm();
    } else {
      showToast('error', data.message || 'Failed to change password.');
    }
  } catch (err) {
    console.error(err);
    showToast('error', 'Network error. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
};
// Map Filters Logic
let staffMapStatusFilter = "";

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

function setupStaffMapFilters(issues) {
  const statusSelect = document.getElementById('staffMapStatusFilter');
  const resetButton = document.getElementById('staffMapResetFilters');
  if (!statusSelect) return;

  populateMapSelect(statusSelect, "All Statuses", ["Pending", "In Progress", "Resolved", "Rejected"]);
  statusSelect.value = staffMapStatusFilter;

  statusSelect.onchange = (e) => {
    staffMapStatusFilter = e.target.value;
    renderStaffIssues();
  };

  if (resetButton) {
    resetButton.onclick = () => {
      staffMapStatusFilter = "";
      setupStaffMapFilters(issues);
      renderStaffIssues();
    };
  }
}
