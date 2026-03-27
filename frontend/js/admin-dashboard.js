// Global variables
let currentSortField = 'createdAt';
let sortDirection = 'asc';
let currentSearchTerm = '';
let currentRoleFilter = '';
let currentStatusFilter = '';

let currentIssueSearchTerm = '';
let currentIssueStatusFilter = '';
let currentIssueDepartmentFilter = '';
let currentIssueViewMode = 'list';
window.adminIssuesList = [];
window.adminAllIssuesMapInstance = null;

// Pagination variables
let currentPage = 1;
const issuesPerPage = 10;
let currentUserPage = 1;
const usersPerPage = 10;

function getUserStatusMeta(status) {
  const normalized = (status || "active").toLowerCase();
  if (normalized === "pending_setup") {
    return { label: "Pending Setup", className: "pending_setup" };
  }

  return {
    label: normalized.charAt(0).toUpperCase() + normalized.slice(1),
    className: normalized
  };
}

async function loadAdminData() {
  const token = window.CityPlusApi.getToken("admin");

  if (!token) {
    window.location.href = "login.html";
    return;
  }

  try {
    // 1) Summary + users + staff + issues + departments in parallel
    const [summaryRes, usersRes, staffRes, issuesRes, departmentsRes] = await Promise.all([
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
      }),
      fetch("/api/departments", {
        headers: { Authorization: "Bearer " + token }
      })
    ]);

    const summaryData = await summaryRes.json();
    const usersData = await usersRes.json();
    const staffData = await staffRes.json();
    const issuesData = await issuesRes.json();
    const departmentsData = await departmentsRes.json();

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
    setupAdminMapFilters(window.adminIssuesList);

    // ----- Populate Departments Dropdown & Table -----
    window.adminDepartmentsList = departmentsData.data || [];
    populateDepartmentsDropdown(window.adminDepartmentsList);
    displayDepartments(window.adminDepartmentsList);

    // Populate Issue Department Filter
    const issueDeptFilter = document.getElementById('issueDepartmentFilter');
    if (issueDeptFilter) {
      issueDeptFilter.innerHTML = '<option value="">All Departments</option>';
      window.adminDepartmentsList.forEach(dept => {
        issueDeptFilter.innerHTML += `<option value="${dept._id}">${dept.name}</option>`;
      });
    }

    // ----- Populate Staff Registration History -----
    if (typeof loadStaffRegistrationHistory === 'function') {
      loadStaffRegistrationHistory();
    }

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
  const rejectedPercent = (i.rejected || 0) / total * 100;

  document.getElementById("chart-open").style.width = openPercent + "%";
  document.getElementById("chart-progress").style.width = progressPercent + "%";
  document.getElementById("chart-resolved").style.width = resolvedPercent + "%";
  const rejectedChart = document.getElementById("chart-rejected");
  if (rejectedChart) rejectedChart.style.width = rejectedPercent + "%";

  document.getElementById("chart-open-val").textContent = i.open;
  document.getElementById("chart-progress-val").textContent = i.inProgress;
  document.getElementById("chart-resolved-val").textContent = i.resolved;
  const rejectedVal = document.getElementById("chart-rejected-val");
  if (rejectedVal) rejectedVal.textContent = i.rejected || 0;

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
    const statusMeta = getUserStatusMeta(userStatus);

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
        <span class="status-pill status-${statusMeta.className}">${statusMeta.label}</span>
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
  const token = localStorage.getItem("admin_token");
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

async function deleteUserAdmin(userId) {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        Authorization: "Bearer " + token,
      },
    });

    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error(
        `Received an unexpected response from the server. This can happen if your session has expired. Please try logging out and logging in again. (Status: ${res.status})`
      );
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Failed to delete user account.`);
    }

    showToast('success', `User account has been successfully deleted.`);
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
  if (issue.status === "Rejected") statusClass = "rejected";

  // Set title
  document.getElementById("adminDetailsTitle").textContent = `Issue #${issue._id.slice(-6)}: ${issue.title || 'Untitled'}`;

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

  document.getElementById("adminModalCategory").textContent = issue.category ? (issue.category.name || issue.category) : "--";
  document.getElementById("adminModalDepartment").textContent = issue.department ? issue.department.name : "Unassigned";
  document.getElementById("adminModalPriority").textContent = issue.priority || "--";
  document.getElementById("adminModalDate").textContent = created;
  document.getElementById("adminModalReporter").textContent = issue.citizen ? issue.citizen.name : "Anonymous";
  document.getElementById("adminModalEmail").textContent = issue.citizen ? issue.citizen.email : "--";

  // Set department dropdown
  const deptSelect = document.getElementById("adminModalDepartmentSelect");
  deptSelect.innerHTML = '<option value="">Select Department...</option>';
  (window.adminDepartmentsList || []).forEach(dept => {
    const option = document.createElement("option");
    option.value = dept._id;
    option.textContent = dept.name;
    // Default to the issue's department if it has one
    if (issue.department && issue.department._id === dept._id) {
      option.selected = true;
    }
    deptSelect.appendChild(option);
  });
  deptSelect.dataset.issueId = issue._id;

  // Initial call to filter staff based on the selected department
  filterStaffByDepartment(issue.assignedTo);

  // Dynamic assign/reassign button text
  const assignBtn = document.getElementById("adminAssignIssueBtn");
  if (assignBtn) {
    assignBtn.textContent = issue.assignedTo ? "Reassign Issue" : "Assign Issue";
  }

  // Set status form or show resolved message
  const statusForm = document.getElementById("adminModalStatusForm");
  const resolvedMsg = document.getElementById("adminModalStatusResolvedMsg");
  const rejectedMsg = document.getElementById("adminModalStatusRejectedMsg");
  const statusSelect = document.getElementById("adminModalStatusSelect");
  const noteInput = document.getElementById("adminModalStatusNote");
  const imageInput = document.getElementById("adminModalStatusImage");

  if (issue.status === "Resolved") {
    if (statusForm) statusForm.style.display = "none";
    if (resolvedMsg) resolvedMsg.style.display = "block";
    if (rejectedMsg) rejectedMsg.style.display = "none";
  } else if (issue.status === "Rejected") {
    if (statusForm) statusForm.style.display = "none";
    if (resolvedMsg) resolvedMsg.style.display = "none";
    if (rejectedMsg) rejectedMsg.style.display = "block";
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

function filterStaffByDepartment(assignedToObj = null) {
  const deptSelect = document.getElementById("adminModalDepartmentSelect");
  const staffSelect = document.getElementById("adminModalStaffSelect");
  const selectedDeptId = deptSelect.value;
  const issueId = deptSelect.dataset.issueId;

  staffSelect.innerHTML = '<option value="">Select Staff Member...</option>';
  staffSelect.dataset.issueId = issueId;

  if (!selectedDeptId) return;

  const staffList = window.adminStaffList || [];
  const filteredStaff = staffList.filter(staff => staff.department && staff.department._id === selectedDeptId);

  filteredStaff.forEach(staff => {
    const option = document.createElement("option");
    option.value = staff._id;
    option.textContent = staff.name;
    if (assignedToObj && assignedToObj._id === staff._id) {
      option.selected = true;
    }
    staffSelect.appendChild(option);
  });
}

async function assignIssueToStaffModal() {
  const staffSelect = document.getElementById("adminModalStaffSelect");
  const issueId = staffSelect.dataset.issueId;
  const staffId = staffSelect.value;
  const token = localStorage.getItem("admin_token");

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
  if (newStatus !== "Rejected" && (newStatus === "In Progress" || newStatus === "Resolved") && !file) {
    showToast('warning', `An image proof is required to change status to ${newStatus}.`);
    return;
  }

  const token = localStorage.getItem("admin_token");

  // Show loading state
  const btn = document.getElementById("adminModalStatusSubmitBtn");
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
      await loadAdminData();
    } else {
      const formData = new FormData();
      formData.append("status", newStatus);
      if (noteContent) formData.append("note", noteContent);
      if (file) formData.append("image", file);

      await updateIssueStatus(token, issueId, formData);
    }
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
  window.CityPlusApi.clearSession('admin');
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
    tbodyIssues.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No issues found matching your search.</td></tr>`;
    renderPagination(0);
    return;
  }
  
  // Re-render map if we are currently looking at it, or just initialize it stealthily
  const mapTab = document.getElementById('map-view-tab');
  if (mapTab && mapTab.classList.contains('active')) { // Check if the map-view tab is active
    renderAdminAllIssuesMap(issues);
  } else {
    // just init but don't show
    renderAdminAllIssuesMap(issues);
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
    const departmentName = issue.department ? issue.department.name : "-";

    const statusClass = issue.status === 'Resolved' ? 'resolved' : issue.status === 'In Progress' ? 'progress' : issue.status === 'Rejected' ? 'rejected' : 'pending';
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
      <td>${departmentName}</td>
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

  if (currentIssueDepartmentFilter) {
    filteredIssues = filteredIssues.filter(issue => 
      issue.department && (issue.department._id === currentIssueDepartmentFilter || issue.department === currentIssueDepartmentFilter)
    );
  }

  // Only display issues in the table if the list view is active
  const listContainer = document.getElementById('issues-tab');
  const mapContainer = document.getElementById('map-view-tab');
  const paginationContainer = document.getElementById('issuePagination');

  if (listContainer && listContainer.classList.contains('active')) {
    displayIssues(filteredIssues);
    if(paginationContainer && filteredIssues.length > issuesPerPage) paginationContainer.style.display = 'flex';
  } else if (mapContainer && mapContainer.classList.contains('active')) {
    let mapFilteredIssues = filteredIssues;
    if (adminMapStatusFilter) {
       mapFilteredIssues = mapFilteredIssues.filter(issue => {
         return !adminMapStatusFilter || issue.status === adminMapStatusFilter;
       });
    }
    renderAdminAllIssuesMap(mapFilteredIssues);
    if(paginationContainer) paginationContainer.style.display = 'none';
  }

  updateIssueSearchResultsInfo(filteredIssues);
}

// --- Map View Logic ---
function renderAdminAllIssuesMap(issues) {
  if (!window.isLeafletLoaded || typeof L === 'undefined') return;
  
  const mapEl = document.getElementById('adminAllIssuesMap');
  if (!mapEl) return;
  
  // Initialize map if it doesn't exist
  if (!window.adminAllIssuesMapInstance) {
    // Centered on Bhiwandi
    window.adminAllIssuesMapInstance = L.map(mapEl).setView([19.2952, 73.0544], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(window.adminAllIssuesMapInstance);

    if (L.Control && L.Control.geocoder) {
      L.Control.geocoder({
        defaultMarkGeocode: false
      }).on('markgeocode', function(e) {
        var bbox = e.geocode.bbox;
        window.adminAllIssuesMapInstance.fitBounds(bbox);
      }).addTo(window.adminAllIssuesMapInstance);
    }
  }
  
  // Clear existing markers
  if (window.adminAllIssuesMarkers) {
    window.adminAllIssuesMapInstance.removeLayer(window.adminAllIssuesMarkers);
  }
  
  window.adminAllIssuesMarkers = L.layerGroup().addTo(window.adminAllIssuesMapInstance);
  
  const bounds = [];
  
  issues.forEach(issue => {
    if (issue.lat && issue.lng) {
      const pos = [issue.lat, issue.lng];
      bounds.push(pos);
      
      let markerColor = '#ef4444'; // Pending (red)
      if (issue.status === 'In Progress') markerColor = '#eab308'; // yellow
      if (issue.status === 'Resolved') markerColor = '#22c55e'; // green
      if (issue.status === 'Rejected') markerColor = '#b91c1c'; // dark red
      
      const svgIcon = L.divIcon({
        html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.3));"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${markerColor}" stroke="#ffffff" stroke-width="1.5"/></svg>`,
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        tooltipAnchor: [0, -32]
      });
      
      const marker = L.marker(pos, { icon: svgIcon }).addTo(window.adminAllIssuesMarkers);
      
      // Rich tooltip on hover
      marker.bindTooltip(`
        <div style="min-width:180px;">
          <strong style="font-size:0.875rem;">${issue.title || issue.category}</strong><br/>
          <span style="font-size:0.8rem; color:#666;">📍 ${issue.location ? issue.location.substring(0, 40) : '--'}</span><br/>
          <span style="font-size:0.8rem;">📂 ${issue.category}</span><br/>
          <span style="font-size:0.8rem; color:${markerColor}; font-weight:600;">● ${issue.status}</span>
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
            <span style="background:${markerColor}20; color:${markerColor}; padding:0.1rem 0.5rem; border-radius:9999px; font-size:0.7rem; font-weight:600;">${issue.status}</span>
          </div>
          <p style="margin:0 0 0.25rem 0; font-size:0.8rem; color:#64748b;">📍 ${issue.location || '--'}</p>
          <p style="margin:0 0 0.5rem 0; font-size:0.75rem; color:#94a3b8;">Submitted: ${created}</p>
          ${issue.description ? `<p style="margin:0 0 0.5rem 0; font-size:0.8rem; color:#475569; line-height:1.4;">${issue.description.substring(0, 100)}${issue.description.length > 100 ? '...' : ''}</p>` : ''}
          <button onclick="openAdminIssueDetails(window.adminIssuesList.find(i => i._id === '${issue._id}'), window.adminStaffList)" style="width:100%; padding:0.4rem; background:#3b82f6; color:white; border:none; border-radius:0.375rem; font-size:0.8rem; font-weight:600; cursor:pointer;">View Full Details</button>
        </div>
      `;
      marker.bindPopup(popupContent, { maxWidth: 300 });
    }
  });

  if (bounds.length > 0) {
    if (bounds.length === 1) {
      window.adminAllIssuesMapInstance.setView(bounds[0], 15);
    } else {
      window.adminAllIssuesMapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  } else {
    window.adminAllIssuesMapInstance.setView([19.2952, 73.0544], 13);
  }
  
  // Fix map sizing glitch when initially hidden
  setTimeout(() => { 
    window.adminAllIssuesMapInstance.invalidateSize();
  }, 100);
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
  currentIssueDepartmentFilter = '';
  currentPage = 1;

  document.getElementById('issueSearchInput').value = '';
  document.getElementById('issueStatusFilter').value = '';
  const deptFilter = document.getElementById('issueDepartmentFilter');
  if (deptFilter) deptFilter.value = '';
  document.getElementById('clearIssueSearchBtn').style.display = 'none';
  document.getElementById('issueSearchResultsInfo').style.display = 'none';

  displayIssues(window.adminIssuesList);
}

// Tab Navigation
function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.admin-nav-tab');

  tabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const tabName = button.getAttribute('data-tab');

      // Update URL hash without jumping
      history.pushState(null, null, `#${tabName}`);

      activateTab(tabName);
    });
  });

  // Handle browser back/forward buttons
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    activateTab(hash);
  });
}

function activateTab(tabName) {
  if (tabName === 'profile') {
    window.openProfileModal(true);
    return;
  }

  // Hide profile view if active
  const profileContainer = document.getElementById('profile-view-container');
  if (profileContainer) profileContainer.style.display = 'none';

  const tabButtons = document.querySelectorAll('.admin-nav-tab');
  
  // Remove active class from all buttons and content
  tabButtons.forEach(btn => {
    btn.classList.remove('active', 'nav-link--active');
  });
  document.querySelectorAll('.admin-tab-content').forEach(content => {
    content.classList.remove('active');
    content.style.display = ''; // Clear inline styles that might hide content
  });
  
  // Ensure details tab is hidden
  const detailsTab = document.getElementById("issue-details-tab");
  if (detailsTab) detailsTab.classList.remove('active');
  const userDetailsTab = document.getElementById("user-details-tab");
  if (userDetailsTab) userDetailsTab.classList.remove('active');

  // Add active class to target button and corresponding content
  const targetBtn = document.querySelector(`.admin-nav-tab[data-tab="${tabName}"]`);
  if (targetBtn) {
    targetBtn.classList.add('active', 'nav-link--active');
  }
  const tabContent = document.getElementById(tabName + '-tab');
  if (tabContent) {
    tabContent.classList.add('active');
  }

  // Trigger specific actions based on the activated tab
  if (tabName === 'issues') {
    applyIssueSearchAndFilters();
  } else if (tabName === 'users') {
    applySearchAndFilters(); // This is for users, previously named applyUserSearchAndFilters
  } else if (tabName === 'departments') {
    // Assuming refreshDepartments() exists or displayDepartments(window.adminDepartmentsList)
    displayDepartments(window.adminDepartmentsList);
  } else if (tabName === 'map-view') {
    // Ensure map is rendered when switching to map-view tab
    if (window.adminIssuesList) {
      setTimeout(() => renderAdminAllIssuesMap(window.adminIssuesList), 100);
    }
  }

  // Close sidebar on mobile
  const sidebar = document.querySelector('.sidebar');
  if (sidebar && window.innerWidth <= 768) {
    sidebar.classList.remove('active');
  }
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
  const deptFilter = document.getElementById('issueDepartmentFilter');
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

  if (deptFilter) {
    deptFilter.addEventListener('change', (e) => {
      currentIssueDepartmentFilter = e.target.value;
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

  const deptContainer = document.getElementById("adminUserDetailDeptContainer");
  if (user.role === 'staff') {
    document.getElementById("adminUserDetailDepartment").textContent = user.department ? (user.department.name || user.department) : "Unassigned";
    deptContainer.style.display = "grid";
  } else {
    deptContainer.style.display = "none";
  }

  // Status Badge
  const statusStr = user.status || 'active';
  const statusMeta = getUserStatusMeta(statusStr);
  document.getElementById("adminUserDetailStatusBadge").className = `status-pill status-${statusMeta.className}`;
  document.getElementById("adminUserDetailStatusBadge").textContent = statusMeta.label;

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
    const statusClass = issue.status === 'Resolved' ? 'resolved' : issue.status === 'In Progress' ? 'progress' : issue.status === 'Rejected' ? 'rejected' : 'pending';

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
    `Are you sure you want to ${newStatus} the account for "${userName}"?${newStatus === 'delete' ? ' This action cannot be undone.' : ''}`,
    async () => {
      // Show loading
      const btn = document.getElementById("adminUserDetailUpdateBtn");
      const originalText = btn.innerHTML;
      btn.innerHTML = 'Updating...';
      btn.disabled = true;
      try {
        if (newStatus === 'delete') {
          await deleteUserAdmin(userId);
        } else {
          await updateUserStatusAdmin(userId, newStatus);
        }
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

  // Read initial hash or default to 'dashboard'
  const initialHash = window.location.hash.replace('#', '') || 'dashboard';
  setTimeout(() => activateTab(initialHash), 0);

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

// --- Map Filters Logic ---
let adminMapStatusFilter = "";

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

function setupAdminMapFilters(issues) {
  const statusSelect = document.getElementById('adminMapStatusFilter');
  const resetButton = document.getElementById('adminMapResetFilters');
  if (!statusSelect) return;

  populateMapSelect(statusSelect, "All Statuses", ["Pending", "In Progress", "Resolved", "Rejected"]);
  statusSelect.value = adminMapStatusFilter;

  statusSelect.onchange = (e) => {
    adminMapStatusFilter = e.target.value;
    applyIssueSearchAndFilters();
  };

  if (resetButton) {
    resetButton.onclick = () => {
      adminMapStatusFilter = "";
      setupAdminMapFilters(issues);
      applyIssueSearchAndFilters();
    };
  }
}

window.updateUserDetailsStatus = updateUserDetailsStatus;

// --- Staff Registration Logic ---
window.populateDepartmentsDropdown = function(departments) {
  const select = document.getElementById("staffDepartment");
  if (!select) return;
  
  select.innerHTML = '<option value="" disabled selected>Select a Department...</option>';
  departments.forEach(dept => {
    const opt = document.createElement("option");
    opt.value = dept._id;
    opt.textContent = dept.name;
    select.appendChild(opt);
  });
};

window.handleStaffRegistration = async function(e) {
  e.preventDefault();
  
  const name = document.getElementById("staffFullName").value.trim();
  const email = document.getElementById("staffEmail").value.trim();
  const staffId = document.getElementById("staffIdInput").value.trim();
  const department = document.getElementById("staffDepartment").value;
  
  const msgEl = document.getElementById("registerStaffMessage");
  const btn = document.getElementById("registerStaffSubmitBtn");
  
  // Basic validation
  if(!name || !email || !staffId || !department) {
    msgEl.textContent = "All fields are required.";
    msgEl.className = "error-message";
    msgEl.style.display = "block";
    msgEl.style.color = "#ef4444";
    msgEl.style.backgroundColor = "#fee2e2";
    return;
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    msgEl.textContent = "Please enter a valid email address.";
    msgEl.className = "error-message";
    msgEl.style.display = "block";
    msgEl.style.color = "#ef4444";
    msgEl.style.backgroundColor = "#fee2e2";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Registering Staff...";
  msgEl.style.display = "none";
  
  try {
    const res = await fetch("/api/auth/register-staff", {
      method: "POST",
      headers: window.CityPlusApi.authHeaders("admin", {
        "Content-Type": "application/json"
      }),
      body: JSON.stringify({ name, email, staffId, department })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      msgEl.textContent = "Staff member successfully registered! A setup link was sent to their email.";
      msgEl.className = "success-message";
      msgEl.style.display = "block";
      msgEl.style.color = "#16a34a";
      msgEl.style.backgroundColor = "#dcfce7";
      
      // reset form
      document.getElementById("adminRegisterStaffForm").reset();
      
      // Refresh background data
      loadAdminData();
    } else {
      throw new Error(data.message || "Failed to register staff member.");
    }
  } catch (err) {
    console.error(err);
    msgEl.textContent = err.message || "Network error. Please try again.";
    msgEl.className = "error-message";
    msgEl.style.display = "block";
    msgEl.style.color = "#ef4444";
    msgEl.style.backgroundColor = "#fee2e2";
  } finally {
    btn.disabled = false;
    btn.textContent = "Register Staff Member";
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById("adminRegisterStaffForm");
  if(registerForm) {
    registerForm.addEventListener('submit', window.handleStaffRegistration);
  }
});

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
window.openProfileModal = function (fromHash = false) {
  if (!fromHash) {
    history.pushState(null, null, '#profile');
  }

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
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  activateTab(hash);
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
      headers: window.CityPlusApi.authHeaders('admin', { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.json();

    if (res.ok) {
      showToast('success', 'Password changed successfully!');
      btn.disabled = false;
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

// ==========================================
// Department Management
// ==========================================

function displayDepartments(departments) {
  const tbody = document.getElementById('adminDepartmentsBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (departments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No departments found. Create one to get started.</td></tr>`;
    return;
  }

  departments.forEach(dept => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${dept.name}</strong></td>
      <td>${dept.description || '-'}</td>
      <td>${(dept.supportedCategories || []).join(', ') || '-'}</td>
      <td>${new Date(dept.createdAt).toLocaleDateString()}</td>
      <td class="action-buttons">
        <button class="btn btn-secondary btn-small" onclick="openEditDepartmentModal('${encodeURIComponent(JSON.stringify(dept))}')">Edit</button>
        <button class="btn btn-primary btn-small" onclick="openManageDeptStaffModal('${dept._id}', '${dept.name.replace(/'/g, "\\'")}')">Manage Staff</button>
        <button class="btn btn-danger btn-small" onclick="softDeleteDepartment('${dept._id}')"><span class="material-icons-round" style="font-size: 1rem;">delete</span></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openCreateDepartmentModal() {
  document.getElementById('departmentModalTitle').textContent = 'Create Department';
  document.getElementById('deptId').value = '';
  document.getElementById('deptName').value = '';
  document.getElementById('deptDescription').value = '';
  document.querySelectorAll('input[name="deptCategories"]').forEach(cb => cb.checked = false);
  document.getElementById('departmentModal').style.display = 'flex';
}

function openEditDepartmentModal(encodedDept) {
  const dept = JSON.parse(decodeURIComponent(encodedDept));
  document.getElementById('departmentModalTitle').textContent = 'Edit Department';
  document.getElementById('deptId').value = dept._id;
  document.getElementById('deptName').value = dept.name;
  document.getElementById('deptDescription').value = dept.description || '';
  
  const supportedCategories = dept.supportedCategories || [];
  document.querySelectorAll('input[name="deptCategories"]').forEach(cb => {
    cb.checked = supportedCategories.includes(cb.value);
  });
  
  document.getElementById('departmentModal').style.display = 'flex';
}

function closeDepartmentModal() {
  document.getElementById('departmentModal').style.display = 'none';
}

async function submitDepartment() {
  const id = document.getElementById('deptId').value;
  const name = document.getElementById('deptName').value.trim();
  const description = document.getElementById('deptDescription').value.trim();
  
  const checkedBoxes = Array.from(document.querySelectorAll('input[name="deptCategories"]:checked'));
  const supportedCategories = checkedBoxes.map(cb => cb.value);

  if (!name) return showToast('error', 'Department name is required');

  const token = localStorage.getItem('admin_token');
  const method = id ? 'PUT' : 'POST';
  const url = id ? '/api/departments/' + id : '/api/departments';

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ name, description, supportedCategories })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to save department');
    
    showToast('success', 'Department saved successfully');
    closeDepartmentModal();
    loadAdminData(); // Refresh UI
  } catch (err) {
    showToast('error', err.message);
  }
}

async function softDeleteDepartment(id) {
  if (!confirm('Are you sure you want to delete this department?')) return;
  
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch('/api/departments/' + id, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token }
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete department');
    
    showToast('success', 'Department deleted successfully');
    loadAdminData(); // Refresh UI
  } catch (err) {
    showToast('error', err.message);
  }
}

// Manage Staff Modal
let currentManageDeptId = null;

function openManageDeptStaffModal(deptId, deptName) {
  currentManageDeptId = deptId;
  document.getElementById('manageStaffDeptName').textContent = deptName;
  
  // Filter staff that belong to this department
  const deptStaff = window.adminStaffList.filter(s => s.department && s.department._id === deptId);
  
  // Staff available to be assigned to THIS department (not currently in THIS department)
  const availableStaff = window.adminStaffList.filter(s => !s.department || s.department._id !== deptId);
  
  const list = document.getElementById('currentDeptStaffList');
  list.innerHTML = '';
  
  if (deptStaff.length === 0) {
    list.innerHTML = '<div style="color: var(--text-secondary); padding: 0.5rem 0;">No staff assigned to this department yet.</div>';
  } else {
    deptStaff.forEach(staff => {
      const div = document.createElement('div');
      div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-secondary); border-radius: 0.5rem; border: 1px solid var(--border-color);';
      div.innerHTML = `
        <div>
          <strong style="display: block; color: var(--text-primary);">${staff.name}</strong>
          <small style="color: var(--text-secondary);">${staff.email}</small>
        </div>
        <button class="btn btn-outline btn-small" onclick="removeStaffFromDept('${staff._id}')" style="color: #ef4444; border-color: #fca5a5; padding: 0.25rem 0.5rem;">Remove</button>
      `;
      list.appendChild(div);
    });
  }
  
  const select = document.getElementById('unassignedStaffSelect');
  select.innerHTML = '<option value="">Select Staff Member...</option>';
  availableStaff.forEach(staff => {
    // Show current dept if they are in another one
    const currDept = staff.department ? ` (currently in ${staff.department.name})` : '';
    select.innerHTML += `<option value="${staff._id}">${staff.name} ${staff.email}${currDept}</option>`;
  });
  
  document.getElementById('manageDeptStaffModal').style.display = 'flex';
}

function closeManageDeptStaffModal() {
  document.getElementById('manageDeptStaffModal').style.display = 'none';
  currentManageDeptId = null;
}

async function assignStaffToCurrentDept() {
  const select = document.getElementById('unassignedStaffSelect');
  const staffId = select.value;
  if (!staffId || !currentManageDeptId) return;
  
  await updateStaffDepartment(staffId, currentManageDeptId);
}

window.removeStaffFromDept = async function(staffId) {
  if (!confirm('Remove this staff member from the department?')) return;
  await updateStaffDepartment(staffId, null);
};

async function updateStaffDepartment(staffId, departmentId) {
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`/api/admin/staff/${staffId}/department`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ departmentId })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update user department');
    
    showToast('success', 'Staff assignment updated');
    const currentDeptId = currentManageDeptId;
    const currentDeptName = document.getElementById('manageStaffDeptName').textContent;
    
    await loadAdminData();
    
    if (document.getElementById('manageDeptStaffModal').style.display === 'flex') {
       openManageDeptStaffModal(currentDeptId, currentDeptName);
    }
  } catch (err) {
    showToast('error', err.message);
  }
}

// --- Staff Registration History Logic ---
async function loadStaffRegistrationHistory() {
  const container = document.getElementById("staffRegistrationHistoryList");
  if (!container) return;

  container.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
    <span class="material-icons-round spin-animation" style="font-size: 2rem; color: var(--primary-color);">refresh</span>
    <p style="margin-top: 0.5rem;">Loading history...</p>
  </div>`;

  try {
    const token = window.CityPlusApi.getToken("admin");
    const res = await fetch("/api/admin/staff", {
      headers: { Authorization: "Bearer " + token }
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to load staff history");
    
    // Update global staff list
    window.adminStaffList = data.staff || [];
    renderStaffRegistrationHistory(window.adminStaffList);
    
  } catch (err) {
    console.error("Failed to load staff registration history:", err);
    container.innerHTML = `<div style="text-align: center; padding: 2rem; color: #ef4444;">Failed to load history.</div>`;
  }
}

let currentStaffHistorySearchTerm = '';

function renderStaffRegistrationHistory(staffList) {
  const container = document.getElementById("staffRegistrationHistoryList");
  if (!container) return;
  
  container.innerHTML = "";
  
  let filteredStaff = staffList;
  if (currentStaffHistorySearchTerm) {
    const term = currentStaffHistorySearchTerm.toLowerCase();
    filteredStaff = staffList.filter(s => 
      (s.name && s.name.toLowerCase().includes(term)) ||
      (s.email && s.email.toLowerCase().includes(term)) ||
      (s.staffId && s.staffId.toLowerCase().includes(term))
    );
  }
  
  // Sort by newest first
  const sortedStaff = [...filteredStaff].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  if (sortedStaff.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No staff registered yet.</div>`;
    return;
  }
  
  sortedStaff.forEach(staff => {
    const d = new Date(staff.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const statusObj = getUserStatusMeta(staff.status);
    
    const isPending = staff.status === 'pending_setup';
    const isSuspended = staff.status === 'blocked';
    
    const div = document.createElement("div");
    div.style.cssText = "padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 0.5rem; background: var(--surface); display: flex; flex-direction: column; gap: 0.5rem;";
    
    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <strong style="color: var(--text-primary); display: block;">${staff.name}</strong>
          <span style="font-size: 0.75rem; color: var(--text-secondary);">${staff.staffId || '--'} • ${staff.department ? staff.department.name : 'No Dept'}</span>
        </div>
        <span class="status-pill status-${statusObj.className}" style="font-size: 0.7rem; padding: 0.15rem 0.5rem;">${statusObj.label}</span>
      </div>
      <div style="font-size: 0.8rem; color: var(--text-secondary); display: flex; justify-content: space-between; align-items: center; margin-top: 0.25rem;">
        <span>${staff.email}</span>
        <span>${d}</span>
      </div>
      <div style="display: flex; gap: 0.5rem; margin-top: 0.25rem;">
        ${isPending ? `<button class="btn btn-outline btn-small" onclick="resendStaffSetupLink('${staff._id}')" style="flex: 1; padding: 0.25rem; font-size: 0.75rem; border-color: var(--primary-color); color: var(--primary-color);">Resend Link</button>` : ''}
        ${isPending ? `<button class="btn btn-outline btn-small" onclick="suspendStaffRegistration('${staff._id}')" style="flex: 1; padding: 0.25rem; font-size: 0.75rem; border-color: #ef4444; color: #ef4444;">Suspend</button>` : ''}
        ${isSuspended ? `<button class="btn btn-outline btn-small" onclick="reactivateStaffRegistration('${staff._id}')" style="flex: 1; padding: 0.25rem; font-size: 0.75rem; border-color: #f59e0b; color: #f59e0b;">Reactivate</button>` : ''}
      </div>
    `;
    
    container.appendChild(div);
  });
}

window.resendStaffSetupLink = async function(staffId) {
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`/api/auth/staff/${staffId}/resend-setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to resend link");
    
    showToast('success', 'Setup link has been resent successfully.');
  } catch(err) {
    console.error(err);
    showToast('error', err.message);
  }
};

window.suspendStaffRegistration = async function(staffId) {
  if (!confirm("Are you sure you want to suspend this staff registration?")) return;
  
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`/api/admin/users/${staffId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ status: "blocked" })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to suspend registration");
    
    showToast('success', 'Staff registration suspended.');
    loadStaffRegistrationHistory();
    loadAdminData(); // Refresh overall user counts and lists
  } catch(err) {
    console.error(err);
    showToast('error', err.message);
  }
};

window.reactivateStaffRegistration = async function(staffId) {
  if (!confirm("Are you sure you want to reactivate this staff member and allow setup?")) return;
  
  const token = localStorage.getItem("admin_token");
  try {
    const res = await fetch(`/api/admin/users/${staffId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ status: "pending_setup" })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to reactivate");
    
    showToast('success', 'Staff registration reactivated (pending setup).');
    loadStaffRegistrationHistory();
    loadAdminData();
  } catch(err) {
    console.error(err);
    showToast('error', err.message);
  }
};

window.applyStaffHistorySearch = function() {
  if (window.adminStaffList) {
    renderStaffRegistrationHistory(window.adminStaffList);
  }
};

window.clearStaffHistorySearch = function() {
  document.getElementById('staffHistorySearchInput').value = '';
  currentStaffHistorySearchTerm = '';
  document.getElementById('clearStaffHistorySearchBtn').style.display = 'none';
  window.applyStaffHistorySearch();
};

function setupStaffHistorySearch() {
  const searchInput = document.getElementById('staffHistorySearchInput');
  const clearBtn = document.getElementById('clearStaffHistorySearchBtn');
  
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentStaffHistorySearchTerm = e.target.value;
      if (clearBtn) {
        clearBtn.style.display = currentStaffHistorySearchTerm ? 'flex' : 'none';
      }
      window.applyStaffHistorySearch();
    });
  }
}

// Call setup on DOM load
document.addEventListener('DOMContentLoaded', () => {
  // Existing DOM nodes might not be present if the HTML is loaded dynamically,
  // but since it's in the main HTML, it should be fine.
  setupStaffHistorySearch();
});

