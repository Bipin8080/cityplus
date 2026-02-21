let staffAllIssues = [];
let staffAssignedIssues = [];
let currentStaffView = "all"; // "all" or "assigned"

async function loadStaffData() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token || role !== "staff") {
    window.location.href = "login.html";
    return;
  }

  const [allRes, assignedRes] = await Promise.all([
    fetch("http://localhost:5000/api/issues/all", {
      headers: { Authorization: "Bearer " + token }
    }),
    fetch("http://localhost:5000/api/issues/assigned/mine", {
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

  source.forEach(issue => {
    const created = new Date(issue.createdAt).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric"
    });

    const citizenName = issue.citizen ? issue.citizen.name : "-";

    const imageCell = issue.image
      ? `<a href="http://localhost:5000${issue.image}" target="_blank" title="View full image"><img src="http://localhost:5000${issue.image}" alt="Issue" style="width: 60px; height: 40px; object-fit: cover; border-radius: 4px;"></a>`
      : "-";

    const statusOptions = ["Open", "In Progress", "Resolved"]
      .map(s => `<option value="${s}" ${issue.status === s ? "selected" : ""}>${s}</option>`)
      .join("");

    const tr = document.createElement("tr");
    tr.setAttribute("data-id", issue._id);

    // For "All Issues" view: disable status select and show view-only message
    const statusCell = isViewOnly
      ? `<td><span class="status-pill status-${issue.status.toLowerCase().replace(' ', '-')}">${issue.status}</span></td>`
      : `<td><select class="form-select status-select" data-id="${issue._id}">${statusOptions}</select></td>`;

    const actionCell = isViewOnly
      ? `<td><button class="btn btn-primary btn-small" onclick="openStaffIssueModalFromTable(this)" disabled style="opacity: 0.5; cursor: not-allowed;">View Only</button></td>`
      : `<td><button class="btn btn-primary btn-small" onclick="openStaffIssueModalFromTable(this)">View</button></td>`;

    tr.innerHTML = `
      <td>${issue._id.slice(-6)}</td>
      <td>${issue.category}</td>
      <td>${issue.location}</td>
      <td>${issue.priority}</td>
      <td>${citizenName}</td>
      <td>${imageCell}</td>
      ${statusCell}
      ${actionCell}
    `;
    tr.dataset.issue = JSON.stringify(issue);
    tbody.appendChild(tr);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const staffIssuesBody = document.querySelector("#staffIssuesBody");
  const tabAllIssuesLink = document.querySelector("#tab-all-issues");
  const tabMyAssignedLink = document.querySelector("#tab-my-assigned");

  loadStaffData().catch(err => {
    console.error(err);
    alert(err.message || "A system error occurred while loading data. Please refresh the page or contact support.");
  });

  // Handle All Issues click
  tabAllIssuesLink.addEventListener("click", (e) => {
    e.preventDefault();
    currentStaffView = "all";
    tabAllIssuesLink.classList.add("active");
    tabMyAssignedLink.classList.remove("active");
    renderStaffIssues();
  });

  // Handle My Assigned Issues click
  tabMyAssignedLink.addEventListener("click", (e) => {
    e.preventDefault();
    currentStaffView = "assigned";
    tabMyAssignedLink.classList.add("active");
    tabAllIssuesLink.classList.remove("active");
    renderStaffIssues();
  });

  // Event listener for status changes in table (only for assigned issues)
  staffIssuesBody.addEventListener("change", async (e) => {
    if (e.target.classList.contains("status-select")) {
      // Prevent status updates when viewing "All Issues"
      if (currentStaffView === "all") {
        alert("You cannot update status for all issues. Use 'My Assigned Issues' tab.");
        loadStaffData();
        return;
      }

      const issueId = e.target.dataset.id;
      const newStatus = e.target.value;
      const token = localStorage.getItem("token");

      try {
        const res = await fetch(`http://localhost:5000/api/issues/${issueId}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token
          },
          body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to update status.");

        // Show notification instead of alert
        showStatusNotification(issueId, newStatus);
        loadStaffData();
      } catch (err) {
        console.error("Error updating status:", err);
        alert(err.message);
        loadStaffData();
      }
    }
  });
});

// Helper function to open modal from table button
function openStaffIssueModalFromTable(button) {
  const row = button.closest("tr");
  const issueData = JSON.parse(row.dataset.issue);
  openStaffIssueModal(issueData);
}

// Modal functions for staff
function openStaffIssueModal(issue) {
  const modal = document.getElementById("staffIssueModal");
  const created = new Date(issue.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric"
  });

  let statusClass = "open";
  if (issue.status === "In Progress") statusClass = "progress";
  if (issue.status === "Resolved") statusClass = "resolved";

  // Set title
  document.getElementById("staffModalTitle").textContent = issue.title || "Issue Details";

  // Set image
  const imageContainer = document.getElementById("staffModalImageContainer");
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

  // Set status dropdown
  const statusSelect = document.getElementById("staffModalStatusSelect");
  statusSelect.value = issue.status;
  statusSelect.dataset.issueId = issue._id;

  // Hide or show the status update section based on current view
  const statusUpdateSection = document.querySelector(".issue-modal-section:has(.issue-modal-section-title:contains('Update Status'))")
    || Array.from(document.querySelectorAll(".issue-modal-section")).find(
      el => el.textContent.includes("Update Status")
    );

  if (statusUpdateSection) {
    if (currentStaffView === "all") {
      statusUpdateSection.style.display = "none";
    } else {
      statusUpdateSection.style.display = "block";
    }
  }

  // Show modal
  modal.classList.add("active");

  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeStaffIssueModal();
    }
  });

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeStaffIssueModal();
    }
  });
}

function closeStaffIssueModal() {
  const modal = document.getElementById("staffIssueModal");
  modal.classList.remove("active");
}

async function updateStaffIssueStatus() {
  const statusSelect = document.getElementById("staffModalStatusSelect");
  const issueId = statusSelect.dataset.issueId;
  const newStatus = statusSelect.value;
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`http://localhost:5000/api/issues/${issueId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to update status.");

    // Show notification instead of alert
    showStatusNotification(issueId, newStatus);
    closeStaffIssueModal();
    loadStaffData();
  } catch (err) {
    console.error("Error updating status:", err);
    alert(err.message);
  }
}

// Expose for inline HTML
window.closeStaffIssueModal = closeStaffIssueModal;
window.updateStaffIssueStatus = updateStaffIssueStatus;
window.closeStatusNotification = closeStatusNotification;

// Status notification functions
let notificationTimeout;

function showStatusNotification(issueId, newStatus) {
  const notification = document.getElementById("statusNotification");
  const notificationMessage = document.getElementById("notificationMessage");

  // Create a detailed message
  const shortId = issueId.slice(-6);
  notificationMessage.textContent = `Issue #${shortId} status updated to "${newStatus}".`;

  // Add show class with animation
  notification.classList.add("show");

  // Clear existing timeout
  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
  }

  // Auto-close after 4 seconds
  notificationTimeout = setTimeout(() => {
    closeStatusNotification();
  }, 4000);
}

function closeStatusNotification() {
  const notification = document.getElementById("statusNotification");
  notification.classList.remove("show");

  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
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
window.showLogoutConfirmation = showLogoutConfirmation;
