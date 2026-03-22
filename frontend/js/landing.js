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
  const elPending = document.getElementById("landing-pending");

  if (elTotal) elTotal.innerHTML = '<span class="skeleton skeleton-value">&nbsp;</span>';
  if (elResolved) elResolved.innerHTML = '<span class="skeleton skeleton-value">&nbsp;</span>';
  if (elProgress) elProgress.innerHTML = '<span class="skeleton skeleton-value">&nbsp;</span>';
  if (elPending) elPending.innerHTML = '<span class="skeleton skeleton-value">&nbsp;</span>';

  if (container) {
    // Show skeleton cards while loading
    let skeletons = '';
    for (let i = 0; i < 4; i++) {
      skeletons += `<div class="skeleton-card">
        <div class="skeleton skeleton-card__image"></div>
        <div class="skeleton-card__body">
          <div class="skeleton skeleton-text skeleton-text--short"></div>
          <div class="skeleton skeleton-text skeleton-text--long"></div>
          <div class="skeleton skeleton-text skeleton-text--medium"></div>
        </div>
      </div>`;
    }
    container.innerHTML = skeletons;
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
        if (elPending) elPending.textContent = 0;
      }
      return;
    }

    const issues = data.issues || data || [];

    // --- Update Metrics ---
    if (elTotal) elTotal.textContent = issues.length;
    if (elResolved) elResolved.textContent = issues.filter(i => i.status === "Resolved").length;
    if (elProgress) elProgress.textContent = issues.filter(i => i.status === "In Progress").length;
    if (elPending) elPending.textContent = issues.filter(i => i.status === "Pending").length;

    if (!container) return;

    // Sort by newest first and take only the latest 20
    const displayIssues = [...issues]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);
      
    window.publicIssuesList = displayIssues;

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

        </div>
        <div class="issue-card-date">Submitted: ${created}</div>
      `;

      // Add click handler to open in-page details
      card.addEventListener("click", () => openIssueDetails(issue));

      container.appendChild(card);
    });

    // Set up and apply filters for the map view
    setupPublicMapFilters(issues);
    applyPublicMapFilters();

  } catch (err) {
    console.error("Error loading issues:", err);
    if (container) {
      container.innerHTML = '<p style="color: var(--text-secondary);">Unable to load complaints at this time.</p>';
    }
    // If the API fails, set metrics to 0 so they don't show old data.
    if (elTotal) elTotal.textContent = 0;
    if (elResolved) elResolved.textContent = 0;
    if (elProgress) elProgress.textContent = 0;
    if (elPending) elPending.textContent = 0;
  }
}

function renderPublicIssuesMap(issues) {
  if (!window.isLeafletLoaded || typeof L === 'undefined') return;
  
  const mapEl = document.getElementById('publicIssuesMap');
  if (!mapEl) return;
  
  if (!window.publicIssuesMapInstance) {
    // Centered on Bhiwandi
    window.publicIssuesMapInstance = L.map(mapEl).setView([19.2952, 73.0544], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(window.publicIssuesMapInstance);

    if (L.Control && L.Control.geocoder) {
      L.Control.geocoder({
        defaultMarkGeocode: false
      }).on('markgeocode', function(e) {
        var bbox = e.geocode.bbox;
        window.publicIssuesMapInstance.fitBounds(bbox);
      }).addTo(window.publicIssuesMapInstance);
    }
  }
  
  if (window.publicIssuesMarkers) {
    window.publicIssuesMapInstance.removeLayer(window.publicIssuesMarkers);
  }
  
  window.publicIssuesMarkers = L.layerGroup().addTo(window.publicIssuesMapInstance);
  
  issues.forEach(issue => {
    if (issue.lat && issue.lng) {
      let markerColor = '#ef4444'; // Red default
      if (issue.status === 'In Progress') markerColor = '#eab308'; // Yellow
      else if (issue.status === 'Resolved') markerColor = '#22c55e'; // Green
      
      const svgIcon = L.divIcon({
        className: 'custom-map-marker',
        html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="${markerColor}" stroke="white" stroke-width="2">
                 <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
               </svg>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });
      
      const marker = L.marker([issue.lat, issue.lng], { icon: svgIcon });

      // Rich tooltip on hover
      let statusColor = '#ef4444';
      if (issue.status === 'In Progress') statusColor = '#eab308';
      else if (issue.status === 'Resolved') statusColor = '#22c55e';
      marker.bindTooltip(`
        <div style="min-width:180px;">
          <strong style="font-size:0.875rem;">${issue.title || issue.category}</strong><br/>
          <span style="font-size:0.8rem; color:#666;">📍 ${issue.location ? issue.location.substring(0, 40) : '--'}</span><br/>
          <span style="font-size:0.8rem;">📂 ${issue.category}</span><br/>
          <span style="font-size:0.8rem; color:${statusColor}; font-weight:600;">● ${issue.status}</span>
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
            <span style="background:${statusColor}20; color:${statusColor}; padding:0.1rem 0.5rem; border-radius:9999px; font-size:0.7rem; font-weight:600;">${issue.status}</span>
          </div>
          <p style="margin:0 0 0.25rem 0; font-size:0.8rem; color:#64748b;">📍 ${issue.location || '--'}</p>
          <p style="margin:0 0 0.5rem 0; font-size:0.75rem; color:#94a3b8;">Submitted: ${created}</p>
          ${issue.description ? `<p style="margin:0 0 0.5rem 0; font-size:0.8rem; color:#475569; line-height:1.4;">${issue.description.substring(0, 100)}${issue.description.length > 100 ? '...' : ''}</p>` : ''}
          <button onclick="openIssueDetails(window.publicIssuesList.find(i => i._id === '${issue._id}'))" style="width:100%; padding:0.4rem; background:#3b82f6; color:white; border:none; border-radius:0.375rem; font-size:0.8rem; font-weight:600; cursor:pointer;">View Full Details</button>
        </div>
      `;
      marker.bindPopup(popupContent, { maxWidth: 300 });

      window.publicIssuesMarkers.addLayer(marker);
    }
  });

  setTimeout(() => { 
    window.publicIssuesMapInstance.invalidateSize();
  }, 100);
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


  // Status with badge style
  let statusColor = "var(--slate-500)";
  let statusBg = "var(--slate-100)";
  if (issue.status === "Pending") { statusColor = "var(--yellow-600)"; statusBg = "rgba(234, 179, 8, 0.1)"; }
  if (issue.status === "In Progress") { statusColor = "var(--blue-600)"; statusBg = "rgba(59, 130, 246, 0.1)"; }
  if (issue.status === "Resolved") { statusColor = "var(--green-600)"; statusBg = "rgba(34, 197, 94, 0.1)"; }
  document.getElementById("pageStatus").innerHTML = `<span style="background: ${statusBg}; color: ${statusColor}; padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600;">${issue.status || '--'}</span>`;
  // Date received
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

// --- Map Filters Logic ---
let publicMapStateFilter = "";
let publicMapCityFilter = "";

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

function getUniqueLocationsForMap(issues) {
  const states = new Set();
  const cities = new Set();
  
  issues.forEach(issue => {
    const loc = parseLocationForMap(issue.location);
    if(loc.state) states.add(loc.state);
    if(loc.city) cities.add(loc.city);
  });
  return { states: Array.from(states).filter(Boolean).sort(), cities: Array.from(cities).filter(Boolean).sort() };
}

function setupPublicMapFilters(issues) {
  const stateSelect = document.getElementById('publicMapStateFilter');
  const citySelect = document.getElementById('publicMapCityFilter');
  if(!stateSelect || !citySelect) return;
  
  const { states, cities } = getUniqueLocationsForMap(issues);
  
  stateSelect.innerHTML = '<option value="">All States</option>' + states.map(s => `<option value="${s}">${s}</option>`).join('');
  citySelect.innerHTML = '<option value="">All Cities</option>' + cities.map(c => `<option value="${c}">${c}</option>`).join('');

  // Remove old event listeners if overriding
  const newStateSelect = stateSelect.cloneNode(true);
  const newCitySelect = citySelect.cloneNode(true);
  stateSelect.parentNode.replaceChild(newStateSelect, stateSelect);
  citySelect.parentNode.replaceChild(newCitySelect, citySelect);

  newStateSelect.addEventListener('change', (e) => {
    publicMapStateFilter = e.target.value;
    applyPublicMapFilters();
  });
  
  newCitySelect.addEventListener('change', (e) => {
    publicMapCityFilter = e.target.value;
    applyPublicMapFilters();
  });
}

function applyPublicMapFilters() {
  if (!window.publicIssuesList) return;
  const filtered = window.publicIssuesList.filter(issue => {
    const loc = parseLocationForMap(issue.location);
    const matchState = !publicMapStateFilter || loc.state === publicMapStateFilter;
    const matchCity = !publicMapCityFilter || loc.city === publicMapCityFilter;
    return matchState && matchCity;
  });
  renderPublicIssuesMap(filtered);
}