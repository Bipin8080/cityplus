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

    // ----- Users table -----
    const tbodyUsers = document.querySelector("#adminUsersBody");
    tbodyUsers.innerHTML = "";
    (usersData.users || []).forEach(user => {
      const joined = new Date(user.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric"
      });
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${user.name}</strong></td>
        <td>${user.email}</td>
        <td><span class="role-badge ${user.role}">${user.role}</span></td>
        <td>${joined}</td>
      `;
      tbodyUsers.appendChild(tr);
    });

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

document.addEventListener("DOMContentLoaded", loadAdminData);

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

// Expose for inline HTML
window.closeAdminIssueModal = closeAdminIssueModal;
window.assignIssueToStaff = assignIssueToStaffModal;
window.updateAdminIssueStatus = updateAdminIssueStatus;
window.showLogoutConfirmation = showLogoutConfirmation;
