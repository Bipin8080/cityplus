async function loadRecentIssues() {
  // Target the container - try ID first, then fallback to class
  let container = document.querySelector("#public-issues-grid");
  if (!container) {
    container = document.querySelector(".issue-cards-container");
  }


  // --- Force-update metrics to a loading state ---
  // This will immediately clear the old "fake" data from your HTML if the IDs are present.
  const elTotal = document.getElementById("landing-total");
  const elResolved = document.getElementById("landing-resolved");
  const elProgress = document.getElementById("landing-progress");

  if (elTotal) elTotal.textContent = "--";
  if (elResolved) elResolved.textContent = "--";
  if (elProgress) elProgress.textContent = "--";

  if (container) {
    // Clear any static demo content immediately and show loading state
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">Loading reported issues...</div>';
  }

  try {
    // Fetch all issues (assuming public endpoint exists at GET /api/issues)
    const res = await fetch("http://localhost:5000/api/issues");
    const data = await res.json();

    if (!res.ok) {
      console.warn("Could not fetch public issues:", data.message);
      if (container) {
        container.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 20px; color: var(--text-secondary);">
            <p>Please <a href="login.html" style="color: var(--accent-primary); text-decoration: none; font-weight: 500;">log in</a> to view reported issues.</p>
          </div>
        `;
        // If the API fails, set metrics to 0 so they don't show old data.
        if (elTotal) elTotal.textContent = 0;
        if (elResolved) elResolved.textContent = 0;
        if (elProgress) elProgress.textContent = 0;
      }
      return;
    }

    const issues = data.issues || data || [];

    // --- Update Metrics ---
    if (elTotal) elTotal.textContent = issues.length;
    if (elResolved) elResolved.textContent = issues.filter(i => i.status === "Resolved").length;
    if (elProgress) elProgress.textContent = issues.filter(i => i.status === "In Progress").length;

    if (!container) return;

    if (issues.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 20px; color: var(--text-secondary);">
          <p>No complaints have been reported yet.</p>
        </div>
      `;
      return;
    }

    // Clear container
    container.innerHTML = "";

    // Render cards
    issues.forEach((issue, index) => {
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
      card.classList.add("issue-card");
      card.style.cursor = "pointer";
      card.setAttribute("data-index", index);

      card.innerHTML = `
        ${imageHtml}
        <div class="issue-card-header">
          <span class="issue-card-id">Complaint #${issue._id ? issue._id.slice(-6) : '---'}</span>
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
        </div>
        <div class="issue-card-date">Submitted: ${created}</div>
      `;

      // Add click handler to open modal
      card.addEventListener("click", () => openIssueModal(issue));

      container.appendChild(card);
    });

  } catch (err) {
    console.error("Error loading issues:", err);
    if (container) {
      container.innerHTML = '<p style="color: var(--text-secondary);">Unable to load complaints at this time.</p>';
    }
    // If the API fails, set metrics to 0 so they don't show old data.
    if (elTotal) elTotal.textContent = 0;
    if (elResolved) elResolved.textContent = 0;
    if (elProgress) elProgress.textContent = 0;
  }
}

// Modal functions
function openIssueModal(issue) {
  const modal = document.getElementById("issueModal");
  const created = new Date(issue.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric"
  });

  let statusClass = "open";
  if (issue.status === "In Progress") statusClass = "progress";
  if (issue.status === "Resolved") statusClass = "resolved";

  // Set title
  document.getElementById("modalIssueTitle").textContent = issue.title;

  // Set image or placeholder
  const imageContainer = document.getElementById("modalImageContainer");
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
  document.getElementById("modalBadges").innerHTML = badgesHtml;

  // Set description
  document.getElementById("modalDescription").textContent = issue.description || "No description provided.";

  // Set details
  document.getElementById("modalComplaintId").textContent = issue._id ? `#${issue._id.slice(-6)}` : "---";
  document.getElementById("modalLocation").textContent = issue.location || "--";
  document.getElementById("modalWard").textContent = issue.ward || "--";
  document.getElementById("modalStatus").textContent = issue.status || "--";
  document.getElementById("modalDate").textContent = created;

  // Set reporter info
  document.getElementById("modalReporter").textContent = issue.reporterName || "Anonymous";
  document.getElementById("modalEmail").textContent = issue.reporterEmail || "--";

  // Show modal
  modal.classList.add("active");

  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeIssueModal();
    }
  });

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeIssueModal();
    }
  });
}

function closeIssueModal() {
  const modal = document.getElementById("issueModal");
  modal.classList.remove("active");
}

document.addEventListener("DOMContentLoaded", loadRecentIssues);