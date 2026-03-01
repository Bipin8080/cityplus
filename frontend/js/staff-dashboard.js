let staffAllIssues = [];
let staffAssignedIssues = [];
let currentStaffView = "all"; // "all" or "assigned"

// Search and pagination variables
let currentStaffIssueSearchTerm = '';
let currentStaffIssueStatusFilter = '';
let currentStaffPage = 1;
const staffIssuesPerPage = 10;

async function loadStaffData() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token || role !== "staff") {
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
  staffAssignedIssues = assignedData.issues || [];

  renderStaffIssues();
}

function renderStaffIssues() {
  const tbody = document.querySelector("#staffIssuesBody");
  tbody.innerHTML = "";

  const source = currentStaffView === "all" ? staffAllIssues : staffAssignedIssues;
  const isViewOnly = currentStaffView === "all";

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

  if (filteredIssues.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No issues found matching your search criteria.</td></tr>`;
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

    const imageCell = issue.image
      ? `<a href="${issue.image.startsWith('http') ? issue.image : '' + issue.image}" target="_blank" title="View full image"><img src="${issue.image.startsWith('http') ? issue.image : '' + issue.image}" alt="Issue" style="width: 60px; height: 40px; object-fit: cover; border-radius: 4px;"></a>`
      : "-";

    const statusOptions = ["Pending", "In Progress", "Resolved"]
      .map(s => `<option value="${s}" ${issue.status === s ? "selected" : ""}>${s}</option>`)
      .join("");

    const tr = document.createElement("tr");
    tr.setAttribute("data-id", issue._id);

    // For "All Issues" view: disable action. For "Assigned" view, show view button.
    const statusClass = issue.status === 'Resolved' ? 'resolved' : issue.status === 'In Progress' ? 'progress' : 'pending';
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
  const userName_stored = localStorage.getItem('userName');
  const userEmail_stored = localStorage.getItem('userEmail');
  if (userName_stored) {
    const nameEl = document.getElementById('userName');
    if (nameEl) nameEl.textContent = userName_stored;
  }
  if (userEmail_stored) {
    const emailEl = document.getElementById('userEmail');
    if (emailEl) emailEl.textContent = userEmail_stored;
  }

  const staffIssuesBody = document.querySelector("#staffIssuesBody");
  const tabAllIssuesLink = document.querySelector("#tab-all-issues");
  const tabMyAssignedLink = document.querySelector("#tab-my-assigned");

  loadStaffData().catch(err => {
    console.error(err);
    showToast('error', err.message || "A system error occurred while loading data. Please refresh the page or contact support.");
  });

  if (window.loadLeafletApi) await window.loadLeafletApi();

  // Handle All Issues click
  tabAllIssuesLink.addEventListener("click", (e) => {
    e.preventDefault();
    currentStaffView = "all";
    tabAllIssuesLink.classList.add("active", "nav-link--active");
    tabMyAssignedLink.classList.remove("active", "nav-link--active");

    // Ensure details view is closed when switching tabs
    const detailsTab = document.getElementById("staff-issue-details-container");
    const mainTab = document.getElementById("staff-main-container");
    if (detailsTab) detailsTab.style.display = "none";
    if (mainTab) mainTab.style.display = "block";

    renderStaffIssues();

    // Auto-close sidebar on mobile
    if (window.innerWidth <= 1024) {
      document.querySelector('.sidebar').classList.remove('active');
    }
  });

  // Handle My Assigned Issues click
  tabMyAssignedLink.addEventListener("click", (e) => {
    e.preventDefault();
    currentStaffView = "assigned";
    tabMyAssignedLink.classList.add("active", "nav-link--active");
    tabAllIssuesLink.classList.remove("active", "nav-link--active");

    // Ensure details view is closed when switching tabs
    const detailsTab = document.getElementById("staff-issue-details-container");
    const mainTab = document.getElementById("staff-main-container");
    if (detailsTab) detailsTab.style.display = "none";
    if (mainTab) mainTab.style.display = "block";

    renderStaffIssues();

    // Auto-close sidebar on mobile
    if (window.innerWidth <= 1024) {
      document.querySelector('.sidebar').classList.remove('active');
    }
  });

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

  // Set title
  document.getElementById("staffDetailsTitle").textContent = `Issue #${issue._id.slice(-6)}`;

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
  document.getElementById("staffModalWard").textContent = issue.ward || "--";
  document.getElementById("staffModalPriority").textContent = issue.priority || "--";
  document.getElementById("staffModalDate").textContent = created;
  document.getElementById("staffModalCitizen").textContent = issue.citizen ? issue.citizen.name : "Anonymous";
  document.getElementById("staffModalEmail").textContent = issue.citizen ? issue.citizen.email : "--";

  // Set status form or show resolved message
  const statusForm = document.getElementById("staffModalStatusForm");
  const resolvedMsg = document.getElementById("staffModalStatusResolvedMsg");
  const statusSelect = document.getElementById("staffModalStatusSelect");
  const noteInput = document.getElementById("staffModalStatusNote");
  const imageInput = document.getElementById("staffModalStatusImage");

  if (issue.status === "Resolved") {
    if (statusForm) statusForm.style.display = "none";
    if (resolvedMsg) resolvedMsg.style.display = "block";
  } else {
    if (statusForm) statusForm.style.display = "block";
    if (resolvedMsg) resolvedMsg.style.display = "none";
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
  if (mainTab) mainTab.style.display = "none";
  if (detailsTab) detailsTab.style.display = "block";
  window.scrollTo(0, 0);
}

function closeStaffIssueDetails() {
  const detailsTab = document.getElementById("staff-issue-details-container");
  const mainTab = document.getElementById("staff-main-container");
  if (detailsTab) detailsTab.style.display = "none";
  if (mainTab) mainTab.style.display = "block";
}

async function updateStaffIssueStatus() {
  const statusSelect = document.getElementById("staffModalStatusSelect");
  const issueId = statusSelect.dataset.issueId;
  const newStatus = statusSelect.value;
  const noteContent = document.getElementById("staffModalStatusNote").value;
  const imageInput = document.getElementById("staffModalStatusImage");
  const file = imageInput.files[0];

  if ((newStatus === "In Progress" || newStatus === "Resolved") && !file) {
    showToast('warning', `An image proof is required to change status to ${newStatus}.`);
    return;
  }

  const formData = new FormData();
  formData.append("status", newStatus);
  if (noteContent) formData.append("note", noteContent);
  if (file) formData.append("image", file);

  const token = localStorage.getItem("token");

  // Show loading state
  const btn = document.getElementById("staffModalStatusSubmitBtn");
  const originalHtml = btn.innerHTML;
  btn.innerHTML = 'Updating...';
  btn.disabled = true;

  try {
    const res = await fetch(`/api/issues/${issueId}/status`, {
      method: "PATCH",
      headers: {
        Authorization: "Bearer " + token
      },
      body: formData
    });
    const data = await res.json();
    // Show toast notification
    showToast('success', `Issue status successfully updated to "${newStatus}".`);
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

// Expose for inline HTML
window.closeStaffIssueDetails = closeStaffIssueDetails;
window.updateStaffIssueStatus = updateStaffIssueStatus;

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
  const theme = localStorage.getItem('cityplus-theme');
  localStorage.clear();
  if (theme) localStorage.setItem('cityplus-theme', theme);
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
window.openProfileModal = function () {
  // Populate profile data
  const userName_stored = localStorage.getItem('userName');
  const userEmail_stored = localStorage.getItem('userEmail');

  document.querySelector('#profileName').textContent = userName_stored || 'Staff User';
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
  const mainTab = document.getElementById("staff-main-container");
  if (mainTab) mainTab.style.display = "none";
  const detailsTab = document.getElementById("staff-issue-details-container");
  if (detailsTab) detailsTab.style.display = "none";

  document.getElementById('profile-view-container').style.display = 'block';
  window.scrollTo(0, 0);
};

// Close profile view
window.closeProfileView = function () {
  document.getElementById('profile-view-container').style.display = 'none';
  const mainTab = document.getElementById("staff-main-container");
  if (mainTab) mainTab.style.display = "block";
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
  const otp = document.querySelector('#cpOtpCode').value.trim();
  const currentPassword = document.querySelector('#cpCurrentPassword').value;
  const newPassword = document.querySelector('#cpNewPassword').value;

  if (!email || !otp || !currentPassword || !newPassword) {
    showToast('error', 'All fields, including OTP, are required.');
    return;
  }

  const btn = document.querySelector('#submitPasswordBtn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Updating...';

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, currentPassword, newPassword, otp })
    });
    const data = await res.json();

    if (res.ok) {
      showToast('success', 'Password changed successfully!');
      document.querySelector('#changePasswordForm').style.display = 'none';
      document.querySelector('#cpOtpCode').value = '';
      document.querySelector('#cpCurrentPassword').value = '';
      document.querySelector('#cpNewPassword').value = '';
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

// Send OTP for Change Password
window.sendChangePasswordOTP = async function () {
  const email = document.querySelector('#cpEmail').value.trim();
  if (!email) {
    showToast('error', 'Email is required to send OTP.');
    return;
  }

  const btn = document.querySelector('#sendCpOtpBtn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/auth/send-change-password-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ email })
    });
    const data = await res.json();

    if (res.ok) {
      showToast('success', 'OTP sent to your email.');
    } else {
      showToast('error', data.message || 'Failed to send OTP.');
    }
  } catch (err) {
    console.error(err);
    showToast('error', 'Network error. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
};
