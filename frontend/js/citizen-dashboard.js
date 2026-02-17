let allIssues = [];

function applyFiltersAndRender() {
  const search = document.querySelector("#searchInput").value.toLowerCase();
  const statusFilter = document.querySelector("#statusFilter").value;
  const categoryFilter = document.querySelector("#categoryFilter").value;
  const wardFilter = document.querySelector("#wardFilter").value.toLowerCase();

  const container = document.querySelector("#issuesBody");
  container.innerHTML = "";

  let total = 0, open = 0, progress = 0, resolved = 0;

  allIssues
    .filter(issue => {
      if (statusFilter && issue.status !== statusFilter) return false;
      if (categoryFilter && issue.category !== categoryFilter) return false;
      if (wardFilter && !issue.ward.toLowerCase().includes(wardFilter)) return false;

      if (search) {
        const haystack = (
          issue.title +
          " " +
          issue.location +
          " " +
          issue.description
        ).toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      return true;
    })
    .forEach(issue => {
      total++;
      if (issue.status === "Open") open++;
      else if (issue.status === "In Progress") progress++;
      else if (issue.status === "Resolved") resolved++;

      const created = new Date(issue.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric"
      });

      let statusClass = "open";
      if (issue.status === "In Progress") statusClass = "progress";
      if (issue.status === "Resolved") statusClass = "resolved";

      const imageHtml = issue.image
        ? `<img src="http://localhost:5000${issue.image}" alt="${issue.title}" class="issue-card-image">`
        : "";

      const card = document.createElement("div");
      card.setAttribute("data-id", issue._id);
      card.classList.add("issue-card");
      card.innerHTML = `
        ${imageHtml}
        <div class="issue-card-header">
          <span class="issue-card-id">Complaint #${issue._id.slice(-6)}</span>
        </div>
        <div class="issue-card-title">${issue.title}</div>
        <div class="issue-card-meta">
          <span class="issue-card-category">${issue.category}</span>
          <span class="issue-card-status ${statusClass}">${issue.status}</span>
        </div>
        <div class="issue-card-details">
          <div class="issue-card-detail-row">
            <span class="issue-card-detail-label">Location:</span>
            <span class="issue-card-detail-value">${issue.location}</span>
          </div>
          <div class="issue-card-detail-row">
            <span class="issue-card-detail-label">Ward:</span>
            <span class="issue-card-detail-value">${issue.ward}</span>
          </div>
          <div class="issue-card-detail-row">
            <span class="issue-card-detail-label">Priority:</span>
            <span class="issue-card-detail-value">${issue.priority}</span>
          </div>
        </div>
        <div class="issue-card-date">Submitted: ${created}</div>
      `;
      container.appendChild(card);
    });

  document.querySelector("#statTotal").textContent = total;
  document.querySelector("#statOpen").textContent = open;
  document.querySelector("#statProgress").textContent = progress;
  document.querySelector("#statResolved").textContent = resolved;
}

async function loadCitizenIssues() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token || role !== "citizen") {
    window.location.href = "login.html";
    return;
  }

  try {
    const res = await fetch("http://localhost:5000/api/issues/my", {
      headers: { Authorization: "Bearer " + token }
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Unable to retrieve your complaints. Please refresh the page or try again later.");
      return;
    }

    allIssues = data.issues || [];
    applyFiltersAndRender();
  } catch (err) {
    console.error(err);
    alert("A system error occurred while loading your complaints. Please refresh the page or contact support.");
  }
}

// Modal helpers
function openIssueModal(issueId) {
  const issue = allIssues.find(i => i._id === issueId);
  if (!issue) return;

  document.querySelector("#modalTitle").textContent = issue.title;
  document.querySelector("#modalCategory").textContent = issue.category;
  document.querySelector("#modalWard").textContent = issue.ward;
  document.querySelector("#modalLocation").textContent = issue.location;
  document.querySelector("#modalPriority").textContent = issue.priority;
  document.querySelector("#modalStatus").textContent = issue.status;
  document.querySelector("#modalDescription").textContent = issue.description;

  document.querySelector("#issueModal").style.display = "flex";
}

function closeIssueModal() {
  document.querySelector("#issueModal").style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
  loadCitizenIssues();

  document.querySelector("#searchInput").addEventListener("input", applyFiltersAndRender);
  document.querySelector("#statusFilter").addEventListener("change", applyFiltersAndRender);
  document.querySelector("#categoryFilter").addEventListener("change", applyFiltersAndRender);
  document.querySelector("#wardFilter").addEventListener("input", applyFiltersAndRender);

  document.querySelector("#issuesBody").addEventListener("click", (e) => {
    const card = e.target.closest(".issue-card");
    if (!card) return;
    const id = card.getAttribute("data-id");
    openIssueModal(id);
  });
});

// expose for inline HTML
window.closeIssueModal = closeIssueModal;
