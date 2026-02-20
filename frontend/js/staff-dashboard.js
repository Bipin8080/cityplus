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
    tr.innerHTML = `
      <td>${issue._id.slice(-6)}</td>
      <td>${issue.category}</td>
      <td>${issue.location}</td>
      <td>${issue.priority}</td>
      <td>${citizenName}</td>
      <td>${imageCell}</td>
      <td>
        <select class="form-select status-select" data-id="${issue._id}">
          ${statusOptions}
        </select>
      </td>
      <td><button class="btn btn-primary btn-small" onclick="openStaffIssueModalFromTable(this)">View</button></td>
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

  // Event listener for status changes in table
  staffIssuesBody.addEventListener("change", async (e) => {
    if (e.target.classList.contains("status-select")) {
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
        alert(`Issue status updated to "${newStatus}".`);
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
    alert(`Issue status updated to "${newStatus}".`);
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
