// Global variables
let currentSortField = 'createdAt';
let sortDirection = 'asc';
let currentSearchTerm = '';
let currentRoleFilter = '';
let currentStatusFilter = '';

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
      fetch("http://localhost:5000/api/admin/summary", {
        headers: { Authorization: "Bearer " + token }
      }),
      fetch("http://localhost:5000/api/admin/users", {
        headers: { Authorization: "Bearer " + token }
      }),
      fetch("http://localhost:5000/api/admin/staff", {
        headers: { Authorization: "Bearer " + token }
      }),
      fetch("http://localhost:5000/api/issues/all", {
        headers: { Authorization: "Bearer " + token }
      })
    ]);

    const summaryData = await summaryRes.json();
    const usersData   = await usersRes.json();
    const staffData   = await staffRes.json();
    const issuesData  = await issuesRes.json();

    if (!summaryRes.ok) throw new Error(summaryData.message || "Unable to retrieve system summary. Please refresh the page or try again later.");
    if (!usersRes.ok)   throw new Error(usersData.message || "Unable to retrieve user data. Please refresh the page or try again later.");
    if (!staffRes.ok)   throw new Error(staffData.message || "Unable to retrieve staff data. Please refresh the page or try again later.");
    if (!issuesRes.ok)  throw new Error(issuesData.message || "Unable to retrieve issue data. Please refresh the page or try again later.");

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
    const staffList = staffData.staff || [];
    const tbodyIssues = document.querySelector("#adminIssuesBody");
    tbodyIssues.innerHTML = "";

    (issuesData.issues || []).forEach(issue => {
      const tr = document.createElement("tr");
      const assignedId = issue.assignedTo ? issue.assignedTo._id : "";
      const assignedName = issue.assignedTo ? issue.assignedTo.name : "";
      const citizenName = issue.citizen ? issue.citizen.name : "-";

      const staffOptions = staffList.map(s => {
        const selected = s._id === assignedId ? "selected" : "";
        return `<option value="${s._id}" ${selected}>${s.name}</option>`;
      }).join("");

      const statusOptions = ["Open", "In Progress", "Resolved"]
        .map(s => `<option value="${s}" ${issue.status === s ? "selected" : ""}>${s}</option>`)
        .join("");
      const imageCell = issue.image
        ? `<a href="http://localhost:5000${issue.image}" target="_blank" title="View full image"><img src="http://localhost:5000${issue.image}" alt="Issue" style="width: 60px; height: 40px; object-fit: cover; border-radius: 4px;"></a>`
        : "-";

      tr.innerHTML = `
        <td><code style="font-size:11px; color:#666;">#${issue._id.slice(-6)}</code></td>
        <td><strong>${issue.category}</strong></td>
        <td>${issue.location}</td>
        <td>${citizenName}</td>
        <td>
          <select class="form-select assign-select" data-id="${issue._id}">
            <option value="">-- Select Staff --</option>
            ${staffOptions}
          </select>
          ${assignedName ? `<div style="font-size:11px; color:#666; margin-top:4px;">Current: ${assignedName}</div>` : ""}
        </td>
        <td>${imageCell}</td>
        <td>
          <select class="form-select status-select" data-id="${issue._id}">
            ${statusOptions}
          </select>
        </td>
        <td class="action-buttons">
          <button class="btn btn-primary btn-small assign-btn" data-id="${issue._id}">Assign</button>
          <button class="btn btn-secondary btn-small view-btn" onclick="openAdminIssueModalFromTable(this)" data-issue='${JSON.stringify(issue)}'>View</button>
        </td>
      `;
      tbodyIssues.appendChild(tr);
    });

    // Event listener for assign button clicks
    tbodyIssues.addEventListener("click", async (e) => {
      if (e.target.classList.contains("assign-btn")) {
        const id = e.target.getAttribute("data-id");
        const select = tbodyIssues.querySelector(`.assign-select[data-id="${id}"]`);
        const staffId = select.value;

        if (!staffId) {
          alert("Please select a staff member from the dropdown menu before assigning this issue.");
          return;
        }

        const token = localStorage.getItem("token");
        await submitStaffAssignment(token, id, staffId);
      }
    });

    // Add event listener for status changes
    tbodyIssues.addEventListener("change", async (e) => {
      if (e.target.classList.contains("status-select")) {
        const id = e.target.getAttribute("data-id");
        const status = e.target.value;
        const token = localStorage.getItem("token");
        await updateIssueStatus(token, id, status);
      }
    });

  } catch (err) {
    console.error(err);
    alert(err.message || "A system error occurred while loading dashboard data. Please refresh the page or contact support.");
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

  sortedUsers.forEach(user => {
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
        ${user.role === 'admin' ? '<span style="font-size: 12px; color: #64748b;">(Admin)</span>' : `
          <select class="form-select user-action-select" data-id="${user._id}" data-name="${user.name}" style="width: 150px;">
            <option value="" disabled selected>Take Action...</option>
            <option value="active" ${userStatus === 'active' ? 'disabled' : ''}>Set Active</option>
            <option value="blocked" ${userStatus === 'blocked' ? 'disabled' : ''}>Block Account</option>
            <option value="terminated" ${userStatus === 'terminated' ? 'disabled' : ''}>Terminate Account</option>
          </select>
        `}
      </td>
    `;
    tbodyUsers.appendChild(tr);
  });
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

async function updateIssueStatus(token, issueId, status) {
  try {
    const res = await fetch(`http://localhost:5000/api/issues/${issueId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to update status.");
    alert(`Issue status successfully updated to "${status}".`);
  } catch (err) {
    console.error(err);
    alert("A system error occurred while updating the status. Please try again later.");
  } finally {
    // Reload data to reflect the change and revert dropdown on failure
    loadAdminData();
  }
}

async function submitStaffAssignment(token, issueId, staffId) {
  try {
    const res = await fetch(`http://localhost:5000/api/issues/${issueId}/assign`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ staffId })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.message || "Unable to assign issue. Please verify the selection and try again.");
      return;
    }

    alert("Issue has been successfully assigned to the selected staff member.");
    // refresh to reflect changes
    loadAdminData();
  } catch (err) {
    console.error(err);
    alert("A system error occurred while assigning the issue. Please try again later.");
  }
}

async function updateUserStatusAdmin(userId, status) {
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`http://localhost:5000/api/admin/users/${userId}/status`, {
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

    alert(`User account has been successfully set to "${status}".`);
    loadAdminData(); // Reload to show changes
  } catch (err) {
    console.error(err);
    alert(err.message);
    // Reload data to revert UI changes in case of failure
    loadAdminData();
  }
}

// Helper function to open modal from table button
function openAdminIssueModalFromTable(button) {
  const issue = JSON.parse(button.getAttribute("data-issue"));
  openAdminIssueModal(issue, window.adminStaffList);
}

// Modal functions for Admin
function openAdminIssueModal(issue, staffList) {
  const modal = document.getElementById("adminIssueModal");
  const created = new Date(issue.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric"
  });

  let statusClass = "open";
  if (issue.status === "In Progress") statusClass = "progress";
  if (issue.status === "Resolved") statusClass = "resolved";

  // Set title
  document.getElementById("adminModalTitle").textContent = issue.title || "Issue Details";

  // Set image
  const imageContainer = document.getElementById("adminModalImageContainer");
  if (issue.image) {
    imageContainer.innerHTML = `<img src="http://localhost:5000${issue.image}" alt="${issue.title}" class="issue-modal-image">`;
  } else {
    imageContainer.innerHTML = `
      <div class="issue-modal-no-image">
        <span class="material-icons-round">image_not_supported</span>
        <span>No image provided</span>
      </div>
    `;
  }

  // Set badges
  const badgesHtml = `
    <span class="issue-modal-badge category">${issue.category}</span>
    <span class="issue-modal-badge status issue-card-status ${statusClass}">${issue.status}</span>
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

  // Set status dropdown
  const statusSelect = document.getElementById("adminModalStatusSelect");
  statusSelect.value = issue.status;
  statusSelect.dataset.issueId = issue._id;

  // Show modal
  modal.classList.add("active");

  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeAdminIssueModal();
    }
  });

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAdminIssueModal();
    }
  });
}

function closeAdminIssueModal() {
  const modal = document.getElementById("adminIssueModal");
  modal.classList.remove("active");
}

async function assignIssueToStaffModal() {
  const staffSelect = document.getElementById("adminModalStaffSelect");
  const issueId = staffSelect.dataset.issueId;
  const staffId = staffSelect.value;
  const token = localStorage.getItem("token");

  if (!staffId) {
    alert("Please select a staff member before assigning.");
    return;
  }

  await submitStaffAssignment(token, issueId, staffId);
  closeAdminIssueModal();
}

async function updateAdminIssueStatus() {
  const statusSelect = document.getElementById("adminModalStatusSelect");
  const issueId = statusSelect.dataset.issueId;
  const newStatus = statusSelect.value;
  const token = localStorage.getItem("token");

  await updateIssueStatus(token, issueId, newStatus);
  closeAdminIssueModal();
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

  // Re-attach event listeners
  attachUserActionListeners();
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
  document.getElementById('clearSearchBtn').style.display = 'none';
  applySearchAndFilters();
}

function resetFilters() {
  currentSearchTerm = '';
  currentRoleFilter = '';
  currentStatusFilter = '';

  document.getElementById('userSearchInput').value = '';
  document.getElementById('roleFilter').value = '';
  document.getElementById('statusFilter').value = '';
  document.getElementById('clearSearchBtn').style.display = 'none';
  document.getElementById('searchResultsInfo').style.display = 'none';

  displayUsers(window.adminUsersList);
  attachUserActionListeners();
}

// Tab Navigation
function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.admin-nav-tab');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');

      // Remove active class from all buttons and content
      tabButtons.forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.remove('active');
      });

      // Add active class to clicked button and corresponding content
      button.classList.add('active');
      const tabContent = document.getElementById(tabName + '-tab');
      if (tabContent) {
        tabContent.classList.add('active');
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
      clearSearchBtn.style.display = currentSearchTerm ? 'flex' : 'none';
      applySearchAndFilters();
    });
  }

  if (roleFilter) {
    roleFilter.addEventListener('change', (e) => {
      currentRoleFilter = e.target.value;
      applySearchAndFilters();
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      currentStatusFilter = e.target.value;
      applySearchAndFilters();
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

      // Update visual indicators
      sortHeaders.forEach(h => h.classList.remove('asc', 'desc'));
      header.classList.add(sortDirection);

      // Re-display users with new sort
      displayUsers(window.adminUsersList);

      // Re-attach event listeners
      attachUserActionListeners();
    });
  });
}

// Attach user action listeners
function attachUserActionListeners() {
  const tbodyUsers = document.querySelector("#adminUsersBody");
  if (tbodyUsers) {
    tbodyUsers.addEventListener('change', async (e) => {
      if (e.target.classList.contains('user-action-select')) {
        const select = e.target;
        const userId = select.dataset.id;
        const userName = select.dataset.name;
        const newStatus = select.value;

        if (!newStatus) return;

        const confirmation = confirm(`Are you sure you want to ${newStatus} the account for "${userName}"?`);
        if (confirmation) {
          await updateUserStatusAdmin(userId, newStatus);
        }
        select.value = ""; // Reset select after action
      }
    });
  }
}

// Setup logout confirmation listeners
document.addEventListener('DOMContentLoaded', () => {
  // Load initial data
  loadAdminData();

  // Remove the main navigation menu on dashboard pages for a cleaner look
  const menu = document.querySelector('.navbar-menu');
  if (menu) {
    menu.remove();
  }

  // Setup tab navigation
  setupTabNavigation();

  // Setup search and filters
  setupSearchAndFilters();

  // Setup sortable headers
  setupSortableHeaders();

  // Attach user action listeners
  attachUserActionListeners();

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
window.closeAdminIssueModal = closeAdminIssueModal;
window.assignIssueToStaff = assignIssueToStaffModal;
window.updateAdminIssueStatus = updateAdminIssueStatus;
window.showLogoutConfirmation = showLogoutConfirmation;
window.openAdminIssueModalFromTable = openAdminIssueModalFromTable;
window.clearSearch = clearSearch;
window.resetFilters = resetFilters;
