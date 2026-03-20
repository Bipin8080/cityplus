async function submitIssue(event) {
  event.preventDefault();

  const token = localStorage.getItem("citizen_token");
  const isLoggedIn = !!token;

  const form = event.target;
  const title = form.querySelector("#title").value.trim();
  const departmentNode = form.querySelector("#department");
  const department = departmentNode ? departmentNode.value.trim() : "";
  const category = form.querySelector("#category").value.trim();

  const location = form.querySelector("#location").value.trim();
  const description = form.querySelector("#description").value.trim();

  if (!title || !department || !category || !location || !description) {
    showToast('warning', "Please complete all required fields before submitting your complaint.");
    return;
  }

  const imageInput = form.querySelector("#image");
  if (!imageInput || !imageInput.files || imageInput.files.length === 0) {
    showToast('warning', "Please upload a photo of the issue before submitting.");
    return;
  }

  // If user is not a logged-in citizen, show a modal prompting them to log in.
  if (!isLoggedIn) {
    if (typeof openLoginModal === "function") {
      openLoginModal();
    } else {
      // Fallback in case the modal function isn't available
      showToast('warning', "Please log in as a citizen to report an issue. This helps prevent spam and allows you to track your report's status.");
      setTimeout(() => { window.location.href = "login.html"; }, 2000);
    }
    return;
  }

  try {
    // Use FormData to send both text and file data
    const formData = new FormData(form);

    const headers = {
      // Token is guaranteed to be present due to the check above
      Authorization: "Bearer " + token,
    };

    const res = await fetch("/api/issues", {
      method: "POST",
      headers: headers,
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      showToast('error', data.message || "Unable to submit your report. Please check the details and try again.");
      return;
    }

    const issueId = data.issue ? data.issue._id : '';
    const idText = issueId ? ` Issue ID: #${issueId.slice(-6).toUpperCase()}.` : '';

    showToast('success', `Issue Submitted Successfully!${idText} Redirecting to your dashboard...`);

    // Since only logged-in citizens can submit, always redirect to their dashboard.
    setTimeout(() => { window.location.href = "citizen-dashboard.html"; }, 3000);
  } catch (err) {
    console.error(err);
    showToast('error', "A system error occurred while submitting your report. Please try again later.");
  }
}

// ──── Google Maps Integration ─────────────────────────────────────────────

let map;
let marker;

// Initialize the map
async function initIssueMap() {
  const mapElement = document.getElementById("map");
  if (!mapElement) return;

  try {
    // Check if the global loader exists from theme.js
    if (window.loadLeafletApi) {
      await window.loadLeafletApi();
    } else {
      console.error("Global Leaflet loader not found");
      document.getElementById("mapStatus").textContent = "Map unavailable (loader missing)";
      return;
    }

    if (!window.isLeafletLoaded || !window.L) {
      document.getElementById("mapStatus").textContent = "Map unavailable (API failed to load)";
      return;
    }

    mapElement.innerHTML = ""; // Clear loading status

    // Default center (can be customized)
    const defaultCenter = { lat: 28.6139, lng: 77.2090 }; // New Delhi

    // Initialize Leaflet Map
    map = L.map('map').setView([defaultCenter.lat, defaultCenter.lng], 12);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add draggable marker
    marker = L.marker([defaultCenter.lat, defaultCenter.lng], {
      draggable: true
    }).addTo(map);

    if (L.Control && L.Control.geocoder) {
      L.Control.geocoder({
        defaultMarkGeocode: false
      }).on('markgeocode', async function(e) {
        const bbox = e.geocode.bbox;
        const center = e.geocode.center;
        map.fitBounds(bbox);
        marker.setLatLng(center);
        updateHiddenCoordinates(center.lat, center.lng);
        await reverseGeocode(center.lat, center.lng);
      }).addTo(map);
    }

    // Set initial hidden values
    updateHiddenCoordinates(defaultCenter.lat, defaultCenter.lng);

    // Update hidden coordinates when marker is dragged
    marker.on('dragend', async function (event) {
      const position = marker.getLatLng();
      updateHiddenCoordinates(position.lat, position.lng);
      await reverseGeocode(position.lat, position.lng);
    });

    // Update marker position when map is clicked
    map.on('click', async function (e) {
      const position = e.latlng;
      marker.setLatLng(position);
      updateHiddenCoordinates(position.lat, position.lng);
      await reverseGeocode(position.lat, position.lng);
    });

    // Fix map styling glitch in some modal/containers
    setTimeout(() => { map.invalidateSize() }, 100);

  } catch (err) {
    console.error("Failed to initialize map:", err);
    document.getElementById("mapStatus").textContent = "Failed to load map";
  }
}

// Function to fetch address from coordinates using Nominatim API
async function reverseGeocode(lat, lng) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    const data = await response.json();
    if (data && data.display_name) {
      // Auto-fill the location text input
      const locationInput = document.getElementById("location");
      if (locationInput) {
        locationInput.value = data.display_name;
        // Optionally flash the input field green briefly to show it was auto-filled
        locationInput.style.transition = 'background-color 0.3s ease';
        locationInput.style.backgroundColor = '#dcfce7'; // light green
        setTimeout(() => { locationInput.style.backgroundColor = ''; }, 1500);
      }
    }
  } catch (err) {
    console.error("Reverse geocoding failed:", err);
  }
}

// Map visibility toggle
window.toggleMap = function () {
  const mapElement = document.getElementById("map");
  const toggleBtn = document.getElementById("toggleMapBtn");

  if (mapElement.style.display === "none" || !mapElement.style.display) {
    mapElement.style.display = "flex";
    toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Map';
    // Let DOM update then resize map
    setTimeout(() => {
      if (map) map.invalidateSize();
    }, 100);
  } else {
    mapElement.style.display = "none";
    toggleBtn.innerHTML = '<i class="fas fa-map"></i> Choose Location on Map';
  }
};

// Load Leaflet API and Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Only run if we are on the report-issue page (where #map exists)
  if (document.getElementById("map")) {
    initIssueMap();
    fetchDepartments();
  }
});

let allDepartments = [];

async function fetchDepartments() {
  try {
    const res = await fetch("/api/departments");
    const data = await res.json();
    if (res.ok) {
      const responseData = data.data || data; // Handle both wrapper styles just in case
      allDepartments = responseData;
      const deptSelect = document.getElementById("department");
      if (deptSelect) {
        deptSelect.innerHTML = '<option value="">Select a department</option>';
        
        const unknownOption = document.createElement("option");
        unknownOption.value = "unknown";
        unknownOption.textContent = "I Don't Know";
        deptSelect.appendChild(unknownOption);

        responseData.forEach(dept => {
          const option = document.createElement("option");
          option.value = dept._id;
          option.textContent = dept.name;
          deptSelect.appendChild(option);
        });
      }
    } else {
      console.error("Failed to fetch departments", data);
    }
  } catch (err) {
    console.error("Error fetching departments:", err);
  }
}

window.handleDepartmentChange = function() {
  const deptSelect = document.getElementById("department");
  const catSelect = document.getElementById("category");
  
  if (!deptSelect || !catSelect) return;
  
  const selectedDeptId = deptSelect.value;
  catSelect.innerHTML = '<option value="">Select a category</option>';
  
  if (!selectedDeptId) {
    catSelect.innerHTML = '<option value="">Select a department first</option>';
    return;
  }
  
  if (selectedDeptId === "unknown") {
    const allValidCategories = new Set();
    allDepartments.forEach(dept => {
      if (dept.supportedCategories) {
        dept.supportedCategories.forEach(cat => allValidCategories.add(cat));
      }
    });

    if (allValidCategories.size === 0) {
      const defaultCats = [
        "Potholes / Damaged Road", "Broken Footpath", "Road Crack / Sinkhole", "Damaged Divider", "Road Sign Missing",
        "Speed Breaker Damage", "Dangerous Open Construction", "Damaged Public Infrastructure",
        "Streetlight Not Working", "Flickering Streetlight", "Broken Streetlight Pole", "Exposed Electrical Wires", "Dark Area / No Streetlights",
        "Garbage Not Collected", "Overflowing Garbage Bin", "Illegal Garbage Dump", "Construction Waste Dump", "Dead Animal on Road",
        "Dirty Street / Public Area", "Waste Burning",
        "No Water Supply", "Low Water Pressure", "Water Leakage", "Contaminated Water", "Broken Water Pipeline",
        "Blocked Drain", "Sewage Overflow", "Open Manhole", "Broken Drain Cover", "Waterlogging / Flooded Road",
        "Mosquito Breeding Area", "Stray Animal Issue", "Food Hygiene Complaint", "Unhygienic Public Toilet", "Public Health Hazard",
        "Park Maintenance Issue", "Broken Park Equipment", "Unclean Garden", "Tree Fallen", "Overgrown Trees / Branches",
        "Illegal Street Vendor", "Footpath Encroachment", "Illegal Construction", "Roadside Obstruction",
        "Broken Traffic Signal", "Missing Road Signs", "Illegal Parking", "Dangerous Intersection"
      ];
      defaultCats.forEach(c => allValidCategories.add(c));
    }
    
    Array.from(allValidCategories).sort().forEach(cat => {
      const option = document.createElement("option");
      option.value = cat;
      option.textContent = cat;
      catSelect.appendChild(option);
    });
    return;
  }
  
  const selectedDept = allDepartments.find(d => d._id === selectedDeptId);
  if (selectedDept && selectedDept.supportedCategories && selectedDept.supportedCategories.length > 0) {
    selectedDept.supportedCategories.forEach(cat => {
      const option = document.createElement("option");
      option.value = cat;
      option.textContent = cat;
      catSelect.appendChild(option);
    });
  } else {
    // Fallback if no specific categories are found
    catSelect.innerHTML = '<option value="">No categories available for this department</option>';
  }
};

function updateHiddenCoordinates(lat, lng) {
  document.getElementById("lat").value = lat;
  document.getElementById("lng").value = lng;
}

// "Use My Location" functionality
window.getCurrentLocation = function () {
  const btn = document.getElementById("useMyLocationBtn");
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Locating...';
  btn.disabled = true;

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        if (map && marker) {
          map.setView([pos.lat, pos.lng], 15);
          marker.setLatLng([pos.lat, pos.lng]);
        }
        updateHiddenCoordinates(pos.lat, pos.lng);
        // Reverse geocode string
        reverseGeocode(pos.lat, pos.lng);

        btn.innerHTML = '<i class="fas fa-check"></i> Found';
        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.disabled = false;
        }, 2000);
      },
      (error) => {
        console.error("Geolocation error:", error);
        showToast('error', "Could not get your location. Please check your browser permissions.");
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    );
  } else {
    showToast('error', "Geolocation is not supported by this browser.");
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
};

