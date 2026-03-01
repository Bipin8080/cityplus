// Global variables
let currentSortField = 'createdAt';
let sortDirection = 'asc';
let currentSearchTerm = '';
let currentRoleFilter = '';
let currentStatusFilter = '';

let currentIssueSearchTerm = '';
let currentIssueStatusFilter = '';
window.adminIssuesList = [];

// Pagination variables
let currentPage = 1;
const issuesPerPage = 10;
let currentUserPage = 1;
const usersPerPage = 10;

async function loadAdminData() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token || role !== "admin") {
    window.location.href = "login.html";
    return;
  }

  try {
    // 1) Summary + users + staff + issues in parallel
    const [summaryRes, usersRes, staffRes, issuesRes] = await Promise.all([
      fetch("/api/admin/summary", {
        headers: { Authorization: "Bearer " + token }
      }),
      fetch("/api/admin/users", {
        headers: { Authorization: "Bearer " + token }
      }),
      fetch("/api/admin/staff", {
        headers: { Authorization: "Bearer " + token }
      }),
      fetch("/api/issues/all", {
        headers: { Authorization: "Bearer " + token }
      })
    ]);

    const summaryData = await summaryRes.json();
    const usersData = await usersRes.json();
    const staffData = await staffRes.json();
    const issuesData = await issuesRes.json();

    if (!summaryRes.ok) throw new Error(summaryData.message || "Unable to retrieve system summary. Please refresh the page or try again later.");
    if (!usersRes.ok) throw new Error(usersData.message || "Unable to retrieve user data. Please refresh the page or try again later.");
    if (!staffRes.ok) throw new Error(staffData.message || "Unable to retrieve staff data. Please refresh the page or try again later.");
    if (!issuesRes.ok) throw new Error(issuesData.message || "Unable to retrieve issue data. Please refresh the page or try again later.");

    // Store staff data globally for modal
    window.adminStaffList = staffData.staff || [];
    // Store users data globally for sorting
    window.adminUsersList = usersData.users || [];

    // ----- Summary cards -----
    const u = summaryData.users;
    const i = summaryData.issues;

    document.querySelector("#uTotal").textContent = u.total;
    document.querySelector("#uBreakdown").textContent =
      `Citizens: ${u.citizens} • Staff: ${u.staff} • Admins: ${u.admins}`;

    document.querySelector("#iTotal").textContent = i.total;
    document.querySelector("#iOpen").textContent = i.open;
    document.querySelector("#iProgress").textContent = i.inProgress;
    document.querySelector("#iResolved").textContent = i.resolved;


    // ----- Update Analytics Section -----
    updateAnalytics(summaryData, usersData);

    // ----- Display and sort users -----
    displayUsers(window.adminUsersList);

    // ----- Assign Issues table -----
    window.adminIssuesList = issuesData.issues || [];
    displayIssues(window.adminIssuesList);

  } catch (err) {
    console.error(err);
    showToast('error', err.message || "A system error occurred while loading dashboard data. Please refresh the page or contact support.");
  }
}

// Update Analytics Section
function updateAnalytics(summaryData, usersData) {
  const u = summaryData.users;
  const i = summaryData.issues;

  // Update issue status charts
  const total = i.total || 1; // Prevent division by zero
  const openPercent = (i.open / total) * 100;
  const progressPercent = (i.inProgress / total) * 100;
  const resolvedPercent = (i.resolved / total) * 100;

  document.getElementById("chart-open").style.width = openPercent + "%";
  document.getElementById("chart-progress").style.width = progressPercent + "%";
  document.getElementById("chart-resolved").style.width = resolvedPercent + "%";

  document.getElementById("chart-open-val").textContent = i.open;
  document.getElementById("chart-progress-val").textContent = i.inProgress;
  document.getElementById("chart-resolved-val").textContent = i.resolved;

  // Update user distribution
  document.getElementById("stat-citizens").textContent = u.citizens;
  document.getElementById("stat-staff").textContent = u.staff;
  document.getElementById("stat-admins").textContent = u.admins;

  // Calculate and update user status stats
  const users = usersData.users || [];
  const activeCount = users.filter(u => u.status === 'active');
  const blockedCount = users.filter(u => u.status === 'blocked').length;
  const terminatedCount = users.filter(u => u.status === 'terminated').length;

  document.getElementById("stat-active").textContent = activeCount.length;
  document.getElementById("stat-blocked").textContent = blockedCount;
  document.getElementById("stat-terminated").textContent = terminatedCount;
}

// Display and sort users
function displayUsers(users) {
  const tbodyUsers = document.querySelector("#adminUsersBody");
  tbodyUsers.innerHTML = "";

  // Sort users based on current sorting
  const sortedUsers = sortUsers(users, currentSortField, sortDirection);

  if (sortedUsers.length === 0) {
    renderUserPagination(0);
    return;
  }

  // Calculate pagination
  const totalItems = sortedUsers.length;
  const totalPages = Math.ceil(totalItems / usersPerPage);

  if (currentUserPage > totalPages) {
    currentUserPage = totalPages > 0 ? totalPages : 1;
  }

  const startIndex = (currentUserPage - 1) * usersPerPage;
  const endIndex = Math.min(startIndex + usersPerPage, totalItems);
  const currentUsersSlice = sortedUsers.slice(startIndex, endIndex);

  currentUsersSlice.forEach(user => {
    const joined = new Date(user.createdAt).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
    const tr = document.createElement("tr");
    const userStatus = user.status || 'active';

    // Apply visual style for non-active users
    if (userStatus !== 'active') {
      tr.style.opacity = '0.6';
      if (userStatus === 'terminated') {
        tr.style.textDecoration = 'line-through';
      }
    }

    tr.innerHTML = `
      <td><strong>${user.name}</strong></td>
      <td>${user.email}</td>
      <td><span class="role-badge ${user.role}">${user.role}</span></td>
      <td>${joined}</td>
      <td>
        <span class="status-pill status-${userStatus.toLowerCase()}">${userStatus}</span>
      </td>
      <td class="action-buttons">
        <button class="btn btn-secondary btn-small view-btn" onclick="openAdminUserDetailsFromTableEncoded(this)" data-user-encoded='${encodeURIComponent(JSON.stringify(user))}'>View</button>
      </td>
    `;
    tr.style.cursor = "pointer";
    tr.onclick = (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
      openAdminUserDetails(user);
    };
    tbodyUsers.appendChild(tr);
  });

  renderUserPagination(totalItems, totalPages);
}

function renderUserPagination(totalItems, totalPages = 0) {
  const paginationContainer = document.getElementById('userPagination');
  if (!paginationContainer) return;

  if (totalItems <= usersPerPage) {
    paginationContainer.style.display = 'none';
    return;
  }

  paginationContainer.style.display = 'flex';

  let html = `
    <button class="btn btn-outline btn-small" ${currentUserPage === 1 ? 'disabled' : ''} onclick="changeUserPage(${currentUserPage - 1})">
      <span class="material-icons-round" style="font-size: 1.2rem;">chevron_left</span> Previous
    </button>
    <div style="display: flex; align-items: center; gap: 0.5rem; margin: 0 1rem; color: var(--text-secondary); font-size: 0.9rem;">
      Page <strong style="color: var(--text-primary);">${currentUserPage}</strong> of <strong>${totalPages}</strong>
    </div>
    <button class="btn btn-outline btn-small" ${currentUserPage === totalPages ? 'disabled' : ''} onclick="changeUserPage(${currentUserPage + 1})">
      Next <span class="material-icons-round" style="font-size: 1.2rem;">chevron_right</span>
    </button>
  `;

  paginationContainer.innerHTML = html;
}

function changeUserPage(newPage) {
  currentUserPage = newPage;
  applySearchAndFilters();
}

// Sort users function
function sortUsers(users, field, direction) {
  const sorted = [...users];

  sorted.sort((a, b) => {
    let aVal = a[field];
    let bVal = b[field];

    // Handle different field types
    if (field === 'createdAt') {
      aVal = new Date(aVal);
      bVal = new Date(bVal);
    } else if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}

async function updateIssueStatus(token, issueId, formData) {
  try {
    // If formData is just a string (for compatibility if any other place calls it without passing FormData)
    let bodyData = formData;
    let headers = { Authorization: "Bearer " + token };

    if (!(formData instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      bodyData = JSON.stringify({ status: formData });
    }

    const res = await fetch(`/api/issues/${issueId}/status`, {
      method: "PATCH",
      headers: headers,
      body: bodyData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to update status.");
    showToast('success', `Issue status successfully updated.`);
  } catch (err) {
    console.error(err);
    showToast('error', err.message || "A system error occurred while updating the status. Please try again later.");
  } finally {
    // Reload data to reflect the change and revert dropdown on failure
    loadAdminData();
  }
}

async function submitStaffAssignment(token, issueId, staffId) {
  try {
    const res = await fetch(`/api/issues/${issueId}/assign`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ staffId })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast('error', data.message || "Unable to assign issue. Please verify the selection and try again.");
      return;
    }

    showToast('success', "Issue has been successfully assigned to the selected staff member.");
    // refresh to reflect changes
    loadAdminData();
  } catch (err) {
    console.error(err);
    showToast('error', "A system error occurred while assigning the issue. Please try again later.");
  }
}

async function updateUserStatusAdmin(userId, status) {
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`/api/admin/users/${userId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ status }),
    });

    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error(
        `Received an unexpected response from the server. This can happen if your session has expired. Please try logging out and logging in again. (Status: ${res.status})`
      );
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Failed to update user status.`);
    }

    showToast('success', `User account has been successfully set to "${status}".`);
    loadAdminData(); // Reload to show changes
  } catch (err) {
    console.error(err);
    showToast('error', err.message);
    // Reload data to revert UI changes in case of failure
    loadAdminData();
  }
}

// Helper function to open modal from table button
function openAdminIssueDetailsFromTable(button) {
  const issue = JSON.parse(button.getAttribute("data-issue"));
  openAdminIssueDetails(issue, window.adminStaffList);
}

// Details functions for Admin
function openAdminIssueDetails(issue, staffList) {
  const created = new Date(issue.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric"
  });

  let statusClass = "pending";
  if (issue.status === "In Progress") statusClass = "progress";
  if (issue.status === "Resolved") statusClass = "resolved";

  // Set title
  document.getElementById("adminDetailsTitle").textContent = `Issue #${issue._id.slice(-6)}`;

  // Set image
  const imageContainer = document.getElementById("adminModalImageContainer");
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
  document.getElementById("adminModalBadges").innerHTML = badgesHtml;

  // Set description
  document.getElementById("adminModalDescription").textContent = issue.description || "No description provided.";

  // Set details
  document.getElementById("adminModalComplaintId").textContent = issue._id ? `#${issue._id.slice(-6)}` : "---";
  document.getElementById("adminModalLocation").textContent = issue.location || "--";
  document.getElementById("adminModalWard").textContent = issue.ward || "--";
  document.getElementById("adminModalPriority").textContent = issue.priority || "--";
  document.getElementById("adminModalDate").textContent = created;
  document.getElementById("adminModalReporter").textContent = issue.citizen ? issue.citizen.name : "Anonymous";
  document.getElementById("adminModalEmail").textContent = issue.citizen ? issue.citizen.email : "--";

  // Set staff dropdown
  const staffSelect = document.getElementById("adminModalStaffSelect");
  staffSelect.innerHTML = '<option value="">Select Staff Member...</option>';
  (staffList || []).forEach(staff => {
    const option = document.createElement("option");
    option.value = staff._id;
    option.textContent = staff.name;
    if (issue.assignedTo && issue.assignedTo._id === staff._id) {
      option.selected = true;
    }
    staffSelect.appendChild(option);
  });
  staffSelect.dataset.issueId = issue._id;

  // Dynamic assign/reassign button text
  const assignBtn = document.getElementById("adminAssignIssueBtn");
  if (assignBtn) {
    assignBtn.textContent = issue.assignedTo ? "Reassign Issue" : "Assign Issue";
  }

  // Set status form or show resolved message
  const statusForm = document.getElementById("adminModalStatusForm");
  const resolvedMsg = document.getElementById("adminModalStatusResolvedMsg");
  const statusSelect = document.getElementById("adminModalStatusSelect");
  const noteInput = document.getElementById("adminModalStatusNote");
  const imageInput = document.getElementById("adminModalStatusImage");

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
  const feedbackSection = document.getElementById("adminModalFeedbackSection");
  if (issue.feedback && issue.feedback.rating) {
    feedbackSection.style.display = "block";
    const starsDiv = document.getElementById("adminModalExistingRatingStars");
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      starsHtml += `<span class="material-icons-round" style="font-size:1.25rem;">${i <= issue.feedback.rating ? 'star' : 'star_border'}</span>`;
    }
    starsDiv.innerHTML = starsHtml;

    const textEl = document.getElementById("adminModalExistingFeedbackText");
    if (issue.feedback.text) {
      textEl.textContent = `"${issue.feedback.text}"`;
      textEl.style.display = "block";
    } else {
      textEl.style.display = "none";
    }
  } else {
    feedbackSection.style.display = "none";
  }

  // Initialize Map if coordinates present
  const mapContainer = document.getElementById('adminModalMapContainer');
  const mapEl = document.getElementById('adminModalMap');

  if (issue.lat && issue.lng && window.isLeafletLoaded) {
    mapContainer.style.display = 'block';

    setTimeout(() => {
      // Clear previous map instance if it exists
      if (window.adminIssueMap) {
        window.adminIssueMap.remove();
      }

      const pos = [issue.lat, issue.lng];
      window.adminIssueMap = L.map(mapEl).setView(pos, 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(window.adminIssueMap);

      L.marker(pos).addTo(window.adminIssueMap);

      // Fix map styling glitch
      setTimeout(() => { window.adminIssueMap.invalidateSize() }, 100);
    }, 100);
  } else {
    mapContainer.style.display = 'none';
  }

  // Render Timeline
  const timelineContent = document.getElementById("adminModalTimelineContent");
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


  // Show details view
  document.querySelectorAll('.admin-tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.querySelectorAll('.admin-nav-tab').forEach(btn => {
    btn.classList.remove('active');
    btn.classList.remove('nav-link--active');
  });

  const detailsTab = document.getElementById("issue-details-tab");
  if (detailsTab) detailsTab.classList.add("active");
  window.scrollTo(0, 0);
}

function closeAdminIssueDetails() {
  const detailsTab = document.getElementById("issue-details-tab");
  if (detailsTab) detailsTab.classList.remove("active");

  const issuesTabBtn = document.querySelector('.admin-nav-tab[data-tab="issues"]');
  if (issuesTabBtn) {
    issuesTabBtn.click();
  } else {
    document.getElementById("issues-tab").classList.add("active");
  }
}

async function assignIssueToStaffModal() {
  const staffSelect = document.getElementById("adminModalStaffSelect");
  const issueId = staffSelect.dataset.issueId;
  const staffId = staffSelect.value;
  const token = localStorage.getItem("token");

  if (!staffId) {
    showToast('warning', "Please select a staff member before assigning.");
    return;
  }

  await submitStaffAssignment(token, issueId, staffId);
  closeAdminIssueDetails();
}

async function updateAdminIssueStatus() {
  const statusSelect = document.getElementById("adminModalStatusSelect");
  const issueId = statusSelect.dataset.issueId;
  const newStatus = statusSelect.value;
  const noteContent = document.getElementById("adminModalStatusNote").value;
  const imageInput = document.getElementById("adminModalStatusImage");
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
  const btn = document.getElementById("adminModalStatusSubmitBtn");
  const originalHtml = btn.innerHTML;
  btn.innerHTML = 'Updating...';
  btn.disabled = true;

  try {
    await updateIssueStatus(token, issueId, formData);
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
    closeAdminIssueDetails();
  }
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
  const theme = localStorage.getItem('cityplus-theme');
  localStorage.clear();
  if (theme) localStorage.setItem('cityplus-theme', theme);
  window.location.href = 'login.html';
}

// Search and Filter Functions
function applySearchAndFilters() {
  let filteredUsers = window.adminUsersList;

  // Apply search filter
  if (currentSearchTerm.trim()) {
    const searchLower = currentSearchTerm.toLowerCase();
    filteredUsers = filteredUsers.filter(user =>
      user.name.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower)
    );
  }

  // Apply role filter
  if (currentRoleFilter) {
    filteredUsers = filteredUsers.filter(user => user.role === currentRoleFilter);
  }

  // Apply status filter
  if (currentStatusFilter) {
    filteredUsers = filteredUsers.filter(user => user.status === currentStatusFilter);
  }

  // Display filtered users
  displayUsers(filteredUsers);

  // Update result info
  updateSearchResultsInfo(filteredUsers);
}

function updateSearchResultsInfo(filteredUsers) {
  const totalCount = window.adminUsersList.length;
  const resultCount = filteredUsers.length;
  const resultsInfo = document.getElementById('searchResultsInfo');
  const noUsersMessage = document.getElementById('noUsersMessage');

  if (currentSearchTerm || currentRoleFilter || currentStatusFilter) {
    resultsInfo.style.display = 'flex';
    document.getElementById('resultCount').textContent = resultCount;
    document.getElementById('totalCount').textContent = totalCount;
  } else {
    resultsInfo.style.display = 'none';
  }

  if (resultCount === 0 && (currentSearchTerm || currentRoleFilter || currentStatusFilter)) {
    noUsersMessage.style.display = 'block';
  } else {
    noUsersMessage.style.display = 'none';
  }
}

function clearSearch() {
  document.getElementById('userSearchInput').value = '';
  currentSearchTerm = '';
  currentUserPage = 1;
  document.getElementById('clearSearchBtn').style.display = 'none';
  applySearchAndFilters();
}

function resetFilters() {
  currentSearchTerm = '';
  currentRoleFilter = '';
  currentStatusFilter = '';
  currentUserPage = 1;

  document.getElementById('userSearchInput').value = '';
  document.getElementById('roleFilter').value = '';
  document.getElementById('statusFilter').value = '';
  document.getElementById('clearSearchBtn').style.display = 'none';
  document.getElementById('searchResultsInfo').style.display = 'none';

  displayUsers(window.adminUsersList);
  attachUserActionListeners();
}

function displayIssues(issues) {
  const tbodyIssues = document.querySelector("#adminIssuesBody");
  tbodyIssues.innerHTML = "";

  if (issues.length === 0) {
    tbodyIssues.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No issues found matching your search criteria.</td></tr>`;
    renderPagination(0);
    return;
  }

  // Calculate pagination
  const totalItems = issues.length;
  const totalPages = Math.ceil(totalItems / issuesPerPage);

  if (currentPage > totalPages) {
    currentPage = totalPages > 0 ? totalPages : 1;
  }

  const startIndex = (currentPage - 1) * issuesPerPage;
  const endIndex = Math.min(startIndex + issuesPerPage, totalItems);
  const currentIssues = issues.slice(startIndex, endIndex);

  currentIssues.forEach(issue => {
    const tr = document.createElement("tr");
    const assignedName = issue.assignedTo ? issue.assignedTo.name : "";
    const citizenName = issue.citizen ? issue.citizen.name : "-";

    const statusClass = issue.status === 'Resolved' ? 'resolved' : issue.status === 'In Progress' ? 'progress' : 'pending';
    const statusBadge = `<span class="issue-card-status ${statusClass}" style="padding: 0.25rem 0.75rem; border-radius: 9999px; font-weight: 500; font-size: 0.875rem;">${issue.status}</span>`;
    const imageCell = issue.image
      ? `<a href="${issue.image.startsWith('http') ? issue.image : '' + issue.image}" target="_blank" title="View full image"><img src="${issue.image.startsWith('http') ? issue.image : '' + issue.image}" alt="Issue" style="width: 60px; height: 40px; object-fit: cover; border-radius: 4px;"></a>`
      : "-";

    // Escape characters in JSON string for HTML attributes safely
    const issueDataLink = encodeURIComponent(JSON.stringify(issue));

    tr.innerHTML = `
      <td><code style="font-size:11px; color:#666;">#${issue._id.slice(-6)}</code></td>
      <td>
        <strong>${issue.category}</strong>
        ${issue.feedback ? `<div style="color:#eab308;display:flex;align-items:center;font-size:0.875rem;margin-top:0.25rem;"><span class="material-icons-round" style="font-size:1rem;">star</span> ${issue.feedback.rating}</div>` : ''}
      </td>
      <td>${issue.location}</td>
      <td>${citizenName}</td>
      <td>${assignedName || "<span style='color:#999'>Unassigned</span>"}</td>
      <td>${imageCell}</td>
      <td>${statusBadge}</td>
      <td class="action-buttons">
        <button class="btn btn-secondary btn-small view-btn" onclick="openAdminIssueDetailsFromTableEncoded(this)" data-issue-encoded='${issueDataLink}'>View</button>
      </td>
    `;
    tr.style.cursor = "pointer";
    tr.onclick = (e) => {
      if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'A' || e.target.closest('a')) return;
      openAdminIssueDetails(issue, window.adminStaffList);
    };
    tbodyIssues.appendChild(tr);
  });

  renderPagination(totalItems, totalPages);
}

function renderPagination(totalItems, totalPages = 0) {
  const paginationContainer = document.getElementById('issuePagination');
  if (!paginationContainer) return;

  if (totalItems <= issuesPerPage) {
    paginationContainer.style.display = 'none';
    return;
  }

  paginationContainer.style.display = 'flex';

  let html = `
    <button class="btn btn-outline btn-small" ${currentPage === 1 ? 'disabled' : ''} onclick="changeIssuePage(${currentPage - 1})">
      <span class="material-icons-round" style="font-size: 1.2rem;">chevron_left</span> Previous
    </button>
    <div style="display: flex; align-items: center; gap: 0.5rem; margin: 0 1rem; color: var(--text-secondary); font-size: 0.9rem;">
      Page <strong style="color: var(--text-primary);">${currentPage}</strong> of <strong>${totalPages}</strong>
    </div>
    <button class="btn btn-outline btn-small" ${currentPage === totalPages ? 'disabled' : ''} onclick="changeIssuePage(${currentPage + 1})">
      Next <span class="material-icons-round" style="font-size: 1.2rem;">chevron_right</span>
    </button>
  `;

  paginationContainer.innerHTML = html;
}

function changeIssuePage(newPage) {
  currentPage = newPage;
  applyIssueSearchAndFilters();
}

function openAdminIssueDetailsFromTableEncoded(button) {
  const issue = JSON.parse(decodeURIComponent(button.getAttribute("data-issue-encoded")));
  openAdminIssueDetails(issue, window.adminStaffList);
}

function applyIssueSearchAndFilters() {
  let filteredIssues = window.adminIssuesList;

  if (currentIssueSearchTerm.trim()) {
    const searchLower = currentIssueSearchTerm.toLowerCase();
    filteredIssues = filteredIssues.filter(issue =>
      (issue._id && issue._id.toLowerCase().includes(searchLower)) ||
      (issue.category && issue.category.toLowerCase().includes(searchLower)) ||
      (issue.location && issue.location.toLowerCase().includes(searchLower)) ||
      (issue.citizen && issue.citizen.name && issue.citizen.name.toLowerCase().includes(searchLower))
    );
  }

  if (currentIssueStatusFilter) {
    filteredIssues = filteredIssues.filter(issue => issue.status === currentIssueStatusFilter);
  }

  displayIssues(filteredIssues);
  updateIssueSearchResultsInfo(filteredIssues);
}

function updateIssueSearchResultsInfo(filteredIssues) {
  const totalCount = window.adminIssuesList.length;
  const resultCount = filteredIssues.length;
  const resultsInfo = document.getElementById('issueSearchResultsInfo');

  if (currentIssueSearchTerm || currentIssueStatusFilter) {
    resultsInfo.style.display = 'flex';
    document.getElementById('issueResultCount').textContent = resultCount;
    document.getElementById('issueTotalCount').textContent = totalCount;
  } else {
    resultsInfo.style.display = 'none';
  }
}

function clearIssueSearch() {
  document.getElementById('issueSearchInput').value = '';
  currentIssueSearchTerm = '';
  currentPage = 1;
  document.getElementById('clearIssueSearchBtn').style.display = 'none';
  applyIssueSearchAndFilters();
}

function resetIssueFilters() {
  currentIssueSearchTerm = '';
  currentIssueStatusFilter = '';
  currentPage = 1;

  document.getElementById('issueSearchInput').value = '';
  document.getElementById('issueStatusFilter').value = '';
  document.getElementById('clearIssueSearchBtn').style.display = 'none';
  document.getElementById('issueSearchResultsInfo').style.display = 'none';

  displayIssues(window.adminIssuesList);
}

// Tab Navigation
function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.admin-nav-tab');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');

      // Remove active class from all buttons and content
      tabButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.classList.remove('nav-link--active');
      });
      document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.remove('active');
      });
      // Ensure details tab is hidden
      const detailsTab = document.getElementById("issue-details-tab");
      if (detailsTab) detailsTab.classList.remove('active');

      // Add active class to clicked button and corresponding content
      button.classList.add('active');
      button.classList.add('nav-link--active');
      const tabContent = document.getElementById(tabName + '-tab');
      if (tabContent) {
        tabContent.classList.add('active');
      }


      // Close sidebar on mobile
      const sidebar = document.querySelector('.sidebar');
      if (sidebar && window.innerWidth <= 768) {
        sidebar.classList.remove('active');
      }
    });
  });
}

// Setup search and filter listeners
function setupSearchAndFilters() {
  const searchInput = document.getElementById('userSearchInput');
  const roleFilter = document.getElementById('roleFilter');
  const statusFilter = document.getElementById('statusFilter');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchTerm = e.target.value;
      currentUserPage = 1;
      clearSearchBtn.style.display = currentSearchTerm ? 'flex' : 'none';
      applySearchAndFilters();
    });
  }

  if (roleFilter) {
    roleFilter.addEventListener('change', (e) => {
      currentRoleFilter = e.target.value;
      currentUserPage = 1;
      applySearchAndFilters();
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      currentStatusFilter = e.target.value;
      currentUserPage = 1;
      applySearchAndFilters();
    });
  }
}

function setupIssueSearchAndFilters() {
  const searchInput = document.getElementById('issueSearchInput');
  const statusFilter = document.getElementById('issueStatusFilter');
  const clearSearchBtn = document.getElementById('clearIssueSearchBtn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentIssueSearchTerm = e.target.value;
      currentPage = 1;
      clearSearchBtn.style.display = currentIssueSearchTerm ? 'flex' : 'none';
      applyIssueSearchAndFilters();
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      currentIssueStatusFilter = e.target.value;
      currentPage = 1;
      applyIssueSearchAndFilters();
    });
  }
}

// Setup sortable headers
function setupSortableHeaders() {
  const sortHeaders = document.querySelectorAll('.sortable');

  sortHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const sortField = header.getAttribute('data-sort');

      // Toggle sort direction if same field is clicked
      if (currentSortField === sortField) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        currentSortField = sortField;
        sortDirection = 'asc';
      }

      currentUserPage = 1;

      // Update visual indicators
      sortHeaders.forEach(h => h.classList.remove('asc', 'desc'));
      header.classList.add(sortDirection);

      // Re-display users with new sort
      displayUsers(window.adminUsersList);
    });
  });
}

// Attach user action listeners - OBSOLETE, removed body to avoid errors
function attachUserActionListeners() {
  // Logic absorbed by user detail view
}

// User Detail Functions
function openAdminUserDetailsFromTableEncoded(button) {
  const user = JSON.parse(decodeURIComponent(button.getAttribute("data-user-encoded")));
  openAdminUserDetails(user);
}

function openAdminUserDetails(user) {
  const joined = new Date(user.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric"
  });

  document.getElementById("adminUserDetailsTitle").textContent = user.name;
  document.getElementById("adminUserDetailName").textContent = user.name;
  document.getElementById("adminUserDetailEmail").textContent = user.email;

  // Format Role
  const roleDisplay = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  document.getElementById("adminUserDetailRole").innerHTML = `<span class="role-badge ${user.role}">${roleDisplay}</span>`;
  document.getElementById("adminUserDetailJoined").textContent = joined;

  // Status Badge
  const statusStr = user.status || 'active';
  const statusCap = statusStr.charAt(0).toUpperCase() + statusStr.slice(1);
  document.getElementById("adminUserDetailStatusBadge").className = `status-pill status-${statusStr.toLowerCase()}`;
  document.getElementById("adminUserDetailStatusBadge").textContent = statusCap;

  // Action Form
  const actionGroup = document.getElementById("adminUserDetailActionGroup");
  const updateBtn = document.getElementById("adminUserDetailUpdateBtn");
  const actionMsg = document.getElementById("adminUserDetailActionMessage");
  const actionSelect = document.getElementById("adminUserDetailActionSelect");

  if (user.role === 'admin') {
    actionGroup.style.display = 'none';
    updateBtn.style.display = 'none';
    actionMsg.style.display = 'block';
  } else {
    actionGroup.style.display = 'block';
    updateBtn.style.display = 'block';
    actionMsg.style.display = 'none';

    actionSelect.value = "";
    actionSelect.dataset.userId = user._id;
    actionSelect.dataset.userName = user.name;

    // Disable current user status option
    Array.from(actionSelect.options).forEach(opt => {
      opt.disabled = (opt.value === statusStr.toLowerCase());
    });
  }

  // Activity
  renderUserActivity(user);

  // Show Tab
  document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.admin-nav-tab').forEach(b => { b.classList.remove('active'); b.classList.remove('nav-link--active'); });
  document.getElementById("user-details-tab").classList.add("active");
  window.scrollTo(0, 0);
}

function renderUserActivity(user) {
  const listContainer = document.getElementById("adminUserDetailActivityList");
  const summaryText = document.getElementById("adminUserDetailActivitySummary");
  listContainer.innerHTML = "";

  if (!window.adminIssuesList || window.adminIssuesList.length === 0) {
    summaryText.textContent = "No activity data available.";
    return;
  }

  let userIssues = [];
  if (user.role === 'citizen') {
    userIssues = window.adminIssuesList.filter(i => i.citizen && i.citizen._id === user._id);
  } else if (user.role === 'staff') {
    userIssues = window.adminIssuesList.filter(i => i.assignedTo && i.assignedTo._id === user._id);
  }

  // Sort by newest first
  userIssues.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (userIssues.length === 0) {
    summaryText.textContent = user.role === 'citizen' ? "This citizen hasn't reported any issues." : "This staff member has no assigned issues.";
    return;
  }

  if (user.role === 'citizen') {
    summaryText.textContent = `Reported ${userIssues.length} issue(s).`;
  } else {
    summaryText.textContent = `Assigned to ${userIssues.length} issue(s).`;
  }

  userIssues.forEach(issue => {
    const d = new Date(issue.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const statusClass = issue.status === 'Resolved' ? 'resolved' : issue.status === 'In Progress' ? 'progress' : 'pending';

    const div = document.createElement("div");
    div.style.cssText = "padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 0.5rem; background: var(--surface); display: flex; flex-direction: column; gap: 0.25rem;";

    // Create an encoded issue data object for clicking
    const issueDataLink = encodeURIComponent(JSON.stringify(issue));

    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <strong style="color: var(--text-primary); cursor: pointer;" onclick="openAdminIssueDetailsFromTableEncoded({getAttribute: ()=> '${issueDataLink}'})">${issue.category} (#${issue._id.slice(-6)})</strong>
        <span class="issue-card-status ${statusClass}" style="padding: 0.15rem 0.5rem; border-radius: 9999px; font-weight: 500; font-size: 0.75rem;">${issue.status}</span>
      </div>
      <div style="font-size: 0.875rem; color: var(--text-secondary);">${issue.location}</div>
      <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">${d}</div>
    `;
    listContainer.appendChild(div);
  });
}

function closeAdminUserDetails() {
  document.getElementById("user-details-tab").classList.remove("active");
  const usersTabBtn = document.querySelector('.admin-nav-tab[data-tab="users"]');
  if (usersTabBtn) {
    usersTabBtn.click();
  } else {
    document.getElementById("users-tab").classList.add("active");
  }
}

async function updateUserDetailsStatus() {
  const select = document.getElementById("adminUserDetailActionSelect");
  const newStatus = select.value;
  const userId = select.dataset.userId;
  const userName = select.dataset.userName;

  if (!newStatus) return;

  showConfirmModal(
    "Confirm Action",
    `Are you sure you want to ${newStatus} the account for "${userName}"?`,
    async () => {
      // Show loading
      const btn = document.getElementById("adminUserDetailUpdateBtn");
      const originalText = btn.innerHTML;
      btn.innerHTML = 'Updating...';
      btn.disabled = true;
      try {
        await updateUserStatusAdmin(userId, newStatus);
        closeAdminUserDetails();
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    }
  );
}

// Setup logout confirmation listeners
document.addEventListener('DOMContentLoaded', async () => {
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

  // Load initial data
  loadAdminData();

  // Load Leaflet API
  if (window.loadLeafletApi) await window.loadLeafletApi();

  // Remove the main navigation menu on dashboard pages for a cleaner look
  const menu = document.querySelector('.navbar-menu');
  if (menu) {
    menu.remove();
  }

  // Setup tab navigation
  setupTabNavigation();

  // Setup search and filters
  setupSearchAndFilters();
  setupIssueSearchAndFilters();

  // Setup sortable headers
  setupSortableHeaders();

  // Attach user action listeners
  attachUserActionListeners();

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

// Expose for inline HTML
window.closeAdminIssueDetails = closeAdminIssueDetails;
window.assignIssueToStaff = assignIssueToStaffModal;
window.updateAdminIssueStatus = updateAdminIssueStatus;
window.showLogoutConfirmation = showLogoutConfirmation;
window.openAdminIssueDetailsFromTable = openAdminIssueDetailsFromTable;
window.openAdminIssueDetailsFromTableEncoded = openAdminIssueDetailsFromTableEncoded;
window.clearSearch = clearSearch;
window.resetFilters = resetFilters;
window.clearIssueSearch = clearIssueSearch;
window.resetIssueFilters = resetIssueFilters;
window.changeIssuePage = changeIssuePage;
window.changeUserPage = changeUserPage;
window.openAdminUserDetailsFromTableEncoded = openAdminUserDetailsFromTableEncoded;
window.closeAdminUserDetails = closeAdminUserDetails;
window.updateUserDetailsStatus = updateUserDetailsStatus;

async function refreshAdminData(btn) {
  const icon = btn.querySelector('.material-icons-round');
  const originalHtml = btn.innerHTML;

  // Add spinning style and disable button
  if (icon) icon.classList.add('spin-animation');
  btn.disabled = true;
  btn.innerHTML = `<span class="material-icons-round spin-animation">refresh</span> Refreshing...`;

  try {
    await loadAdminData();
  } finally {
    // Restore original state
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
}

window.refreshAdminData = refreshAdminData;



// Function callable from popup HTML strings safely
// Function callable from popup HTML strings safely
window.openAdminIssueModalFromHtml = function (issueObj) {
  openAdminIssueDetails(issueObj, window.adminStaffList);
}

// Open profile view
window.openProfileModal = function () {
  // Populate profile data
  const userName_stored = localStorage.getItem('userName');
  const userEmail_stored = localStorage.getItem('userEmail');

  document.querySelector('#profileName').textContent = userName_stored || 'Admin User';
  document.querySelector('#profileFullName').textContent = userName_stored || '-';
  document.querySelector('#profileEmail').textContent = userEmail_stored || '-';

  // Setup change password form
  const cpEmail = document.querySelector('#cpEmail');
  if (cpEmail) cpEmail.value = userEmail_stored || '';

  const cpForm = document.querySelector('#changePasswordForm');
  if (cpForm) cpForm.style.display = 'none';
  if (document.querySelector('#cpCurrentPassword')) document.querySelector('#cpCurrentPassword').value = '';
  if (document.querySelector('#cpNewPassword')) document.querySelector('#cpNewPassword').value = '';

  // Hide all tab contents and show profile view
  document.querySelectorAll('.admin-tab-content').forEach(tab => {
    tab.style.display = 'none';
  });
  document.getElementById('profile-view-container').style.display = 'block';
  window.scrollTo(0, 0);
};

// Close profile view
window.closeProfileView = function () {
  document.getElementById('profile-view-container').style.display = 'none';
  // Return to the tab highlighted in sidebar
  const activeSidebarLink = document.querySelector('.sidebar__nav-link.active');
  if (activeSidebarLink && activeSidebarLink.getAttribute('onclick')) {
    const match = activeSidebarLink.getAttribute('onclick').match(/'([^']+)'/);
    if (match && match[1]) {
      const tabId = match[1];
      const targetTab = document.getElementById(`${tabId}-tab`);
      if (targetTab) {
        targetTab.style.display = 'block';
        return;
      }
    }
  }
  if (document.getElementById('dashboard-tab')) {
    document.getElementById('dashboard-tab').style.display = 'block';
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
