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
    const res = await fetch("/api/issues");
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

    // Sort by newest first and take only the latest 20
    const displayIssues = [...issues]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);

    if (displayIssues.length === 0) {
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
    displayIssues.forEach((issue, index) => {
      const created = new Date(issue.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric"
      });

      let statusClass = "pending";
      if (issue.status === "In Progress") statusClass = "progress";
      if (issue.status === "Resolved") statusClass = "resolved";

      const imageHtml = issue.image
        ? `<img src="${issue.image.startsWith('http') ? issue.image : '' + issue.image}" alt="${issue.title}" class="issue-card-image">`
        : "";

      const card = document.createElement("div");
      card.classList.add("issue-card");
      card.style.cursor = "pointer";
      card.setAttribute("data-index", index);

      card.innerHTML = `
        ${imageHtml}
        <div class="issue-card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <span class="issue-card-id">Complaint #${issue._id ? issue._id.slice(-6) : '---'}</span>
          ${issue.feedback && issue.feedback.rating ? `<span style="color:#eab308;display:flex;align-items:center;font-size:0.875rem;font-weight:600;"><span class="material-icons-round" style="font-size:1.1rem;margin-right:2px;">star</span> ${issue.feedback.rating}</span>` : ''}
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

      // Add click handler to open in-page details
      card.addEventListener("click", () => openIssueDetails(issue));

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

// In-Page Details functions
function openIssueDetails(issue) {
  // Hide main views
  document.getElementById('home-view').style.display = 'none';
  document.getElementById('recent-issues-view').style.display = 'none';
  document.getElementById('about-view').style.display = 'none';

  // Show details view
  const detailsView = document.getElementById('issue-details-view');
  detailsView.style.display = 'block';

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const created = new Date(issue.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });

  let statusClass = "open";
  if (issue.status === "In Progress") statusClass = "progress";
  if (issue.status === "Resolved") statusClass = "resolved";

  // Set top title
  document.getElementById("pageIssueTitle").textContent = issue.title;

  // Set image or hide it
  const imgEl = document.getElementById("pageImage");
  const imgContainer = document.getElementById("pageImageContainer");
  if (issue.image) {
    imgEl.src = issue.image.startsWith('http') ? issue.image : issue.image;
    imgEl.style.display = "block";
    imgContainer.innerHTML = "";
    imgContainer.appendChild(imgEl);
  } else {
    imgContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-secondary); padding: 2rem;">
        <span class="material-icons-round" style="font-size: 3rem; margin-bottom: 0.5rem; opacity: 0.5;">image_not_supported</span>
        <span style="font-size: 0.875rem;">No image provided</span>
      </div>`;
  }

  // Set description
  let descHtml = `<p style="margin:0;">${issue.description || 'No description provided.'}</p>`;
  document.getElementById("pageDescription").innerHTML = descHtml;

  // Set Details
  document.getElementById("pageComplaintId").textContent = issue._id ? `#${issue._id.slice(-6)}` : "---";

  // Category with badge style
  document.getElementById("pageCategory").innerHTML = `<span style="background: var(--primary-10); color: var(--primary-color); padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600;">${issue.category || '--'}</span>`;

  document.getElementById("pageLocation").textContent = issue.location || "--";
  document.getElementById("pageWard").textContent = issue.ward || "--";

  // Status with badge style
  let statusColor = "var(--slate-500)";
  let statusBg = "var(--slate-100)";
  if (issue.status === "Pending") { statusColor = "var(--yellow-600)"; statusBg = "rgba(234, 179, 8, 0.1)"; }
  if (issue.status === "In Progress") { statusColor = "var(--blue-600)"; statusBg = "rgba(59, 130, 246, 0.1)"; }
  if (issue.status === "Resolved") { statusColor = "var(--green-600)"; statusBg = "rgba(34, 197, 94, 0.1)"; }
  document.getElementById("pageStatus").innerHTML = `<span style="background: ${statusBg}; color: ${statusColor}; padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600;">${issue.status || '--'}</span>`;

  document.getElementById("pageSubmitted").textContent = created;

  // Set Reporter info (anonymized properly)
  const reporterName = issue.reporterName || (issue.citizen && issue.citizen.name) || "Anonymous Citizen";
  document.getElementById("pageReporter").innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.75rem;">
      <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--primary-10); display: flex; align-items: center; justify-content: center; color: var(--primary-color);">
        <span class="material-icons-round" style="font-size: 1.25rem;">person</span>
      </div>
      <span style="font-weight: 500;">${reporterName}</span>
    </div>
  `;

  // Build Timeline Render
  const tlContent = document.getElementById("pageTimelineContent");
  tlContent.innerHTML = "";

  // Render feedback if exists
  const feedbackSection = document.getElementById("pageFeedbackSection");
  if (issue.feedback && issue.feedback.rating) {
    feedbackSection.style.display = "block";
    const starsContainer = document.getElementById("pageFeedbackStars");
    starsContainer.innerHTML = "";
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement("span");
      star.className = "material-icons-round";
      star.style.fontSize = "1.25rem";
      if (i <= issue.feedback.rating) {
        star.textContent = "star";
        star.style.color = "#eab308"; // Gold
      } else {
        star.textContent = "star_border";
        star.style.color = "var(--slate-300)";
      }
      starsContainer.appendChild(star);
    }
    const fbText = document.getElementById("pageFeedbackText");
    if (issue.feedback.text) {
      fbText.textContent = `"${issue.feedback.text}"`;
      fbText.style.fontStyle = "italic";
    } else {
      fbText.textContent = "No text feedback provided.";
      fbText.style.fontStyle = "normal";
      fbText.style.color = "var(--slate-400)";
    }
  } else {
    feedbackSection.style.display = "none";
  }

  // 1. Submitted
  tlContent.innerHTML += createTimelineItemHTML("Reported", created, "Citizen submitted the issue.", "assignment", "var(--slate-500)", null);

  // 2. In Progress
  if (issue.inProgressAt) {
    const ipDate = new Date(issue.inProgressAt).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
    tlContent.innerHTML += createTimelineItemHTML("In Progress", ipDate, issue.inProgressNote || "Staff has started working on it.", "engineering", "var(--blue-500)", issue.inProgressImage);
  }

  // 3. Resolved
  if (issue.resolvedAt) {
    const resDate = new Date(issue.resolvedAt).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
    tlContent.innerHTML += createTimelineItemHTML("Resolved", resDate, issue.resolvedNote || "Issue has been resolved.", "check_circle", "var(--green-500)", issue.resolvedImage);
  }
}

function createTimelineItemHTML(title, date, text, icon, color, image) {
  let imgHtml = "";
  if (image) {
    imgHtml = `<div style="margin-top: 0.5rem; max-width: 200px; border-radius: 0.5rem; overflow: hidden; border: 1px solid var(--border-color);">
                 <img src="${image}" alt="Timeline Update Image" style="width: 100%; display: block;">
               </div>`;
  }
  return `
    <div style="position: relative; margin-bottom: 1rem;">
      <div style="position: absolute; left: -2.3rem; top: 0; background: ${color}; width: 2rem; height: 2rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 3px solid var(--surface);">
        <span class="material-icons-round" style="font-size: 1rem;">${icon}</span>
      </div>
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
          <h4 style="margin: 0; font-size: 0.95rem; color: var(--text-primary); font-weight: 600;">${title}</h4>
          <span style="font-size: 0.75rem; color: var(--text-secondary);">${date}</span>
        </div>
        <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary); line-height: 1.5;">${text}</p>
        ${imgHtml}
      </div>
    </div>
  `;
}

function closeIssueDetails() {
  document.getElementById('issue-details-view').style.display = 'none';
  // Go back to recent issues view
  document.getElementById('recent-issues-view').style.display = 'block';
  document.getElementById('nav-recent').classList.add('active');
}

document.addEventListener("DOMContentLoaded", loadRecentIssues);