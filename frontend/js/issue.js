const IMAGE_MAX_SIZE_MB = 5;
const IMAGE_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ISSUE_DRAFT_STORAGE_PREFIX = "cityplus_report_issue_draft_v1_";
let issueDraftSaveTimer = null;
let issueDraftStatusTimer = null;
let issueMapInitialCenter = null;

function issueText(key, fallback) {
  return fallback || key;
}

function getIssueDraftStorageKey() {
  const token = localStorage.getItem("citizen_token");
  const email = token ? (localStorage.getItem("citizen_userEmail") || localStorage.getItem("citizen_email")) : null;
  return email ? `${ISSUE_DRAFT_STORAGE_PREFIX}${email}` : `${ISSUE_DRAFT_STORAGE_PREFIX}guest`;
}

function getIssueDraftStorageKeys() {
  const keys = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && key.startsWith(ISSUE_DRAFT_STORAGE_PREFIX)) {
      keys.push(key);
    }
  }

  return keys;
}

function clearAllIssueDraftStorage() {
  getIssueDraftStorageKeys().forEach((key) => localStorage.removeItem(key));
}

async function submitIssue(event) {
  event.preventDefault();

  const token = localStorage.getItem("citizen_token");
  const isLoggedIn = !!token;

  const form = event.target;
  const title = form.querySelector("#title").value.trim();
  const category = form.querySelector("#category").value.trim();
  const location = form.querySelector("#location").value.trim();
  const ward = form.querySelector("#ward").value.trim();
  const description = form.querySelector("#description").value.trim();
  const reporterEmailInput = form.querySelector("#email");
  const reporterEmail = reporterEmailInput ? reporterEmailInput.value.trim() : "";
  clearIssueFieldErrors(form);

  let hasValidationError = false;

  if (!title || !category || !location || !description) {
    hasValidationError = true;
    if (!title) setIssueFieldError(form, "title", issueText("common.titleRequired", "Please enter a short issue title."));
    if (!category) setIssueFieldError(form, "category", issueText("common.categoryRequired", "Please choose the best matching category."));
    if (!location) setIssueFieldError(form, "location", issueText("common.locationRequired", "Please add a location or use the map."));
    if (!description) setIssueFieldError(form, "description", issueText("common.descriptionRequired", "Please describe the issue in a little more detail."));
  }

  if (!isLoggedIn) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!reporterEmail) {
      hasValidationError = true;
      setIssueFieldError(form, "email", "Please enter your email address so we can send your issue ID.");
    } else if (!emailPattern.test(reporterEmail)) {
      hasValidationError = true;
      setIssueFieldError(form, "email", "Please enter a valid email address.");
    }
  }

  const imageInput = form.querySelector("#image");
  const imageFile = imageInput && imageInput.files ? imageInput.files[0] : null;
  if (!imageFile) {
    hasValidationError = true;
    setIssueFieldError(form, "image", issueText("common.imageRequired", "Please attach a photo of the issue."));
  } else {
    const imageError = validateIssueImage(imageInput, imageFile);
    if (imageError) {
      hasValidationError = true;
      setIssueFieldError(form, "image", imageError);
    }
  }

  if (hasValidationError) {
    showToast('warning', issueText("common.fixHighlightedFields", "Please fix the highlighted fields and try again."));
    return;
  }

  const submitBtn = document.getElementById("submitIssueBtn");
  const originalBtnHtml = submitBtn ? submitBtn.innerHTML : "";

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i> ${issueText("common.submitting", "Submitting...")}`;
    }

    // Use FormData to send both text and file data
    const formData = new FormData(form);

    const headers = {};
    if (token) {
      headers.Authorization = "Bearer " + token;
    }

    const res = await fetch("/api/issues", {
      method: "POST",
      headers: headers,
      body: formData,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showToast('error', data.message || issueText("common.submitError", "Unable to submit your report. Please check the details and try again."));
      return;
    }

    const issueId = data.issue ? data.issue._id : '';
    const issueReference = data.issueReference || (issueId ? issueId.slice(-6).toUpperCase() : '');
    const idText = issueReference ? ` Issue ID: #${issueReference}.` : '';
    const emailText = data.emailSent === false
      ? " We could not send the email right now, but your issue was created."
      : " A copy has been sent to your email.";
    const redirectText = isLoggedIn ? " Redirecting to your dashboard..." : " Redirecting to the homepage...";

    showToast('success', `${issueText("common.submitSuccess", "Issue Submitted Successfully!")}${idText}${emailText}${redirectText}`);
    clearIssueDraftAndResetForm();

    setTimeout(() => {
      window.location.href = isLoggedIn ? "citizen-dashboard.html" : "index.html";
    }, 3000);
  } catch (err) {
    console.error(err);
    showToast('error', issueText("common.systemError", "A system error occurred while submitting your report. Please try again later."));
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
    }
  }
}

function validateIssueImage(imageInput, imageFile) {
  const uploadArea = document.getElementById("uploadArea");
  if (uploadArea) {
    uploadArea.classList.remove("invalid");
  }

  if (!imageFile) {
    return issueText("common.imageMissing", "Please upload a photo of the issue before submitting.");
  }

  if (!IMAGE_ALLOWED_TYPES.includes(imageFile.type)) {
    if (uploadArea) uploadArea.classList.add("invalid");
    return issueText("common.imageTypeInvalid", "Please upload a JPG, PNG, GIF, or WEBP image.");
  }

  const maxBytes = IMAGE_MAX_SIZE_MB * 1024 * 1024;
  if (imageFile.size > maxBytes) {
    if (uploadArea) uploadArea.classList.add("invalid");
    return issueText("common.imageTooLarge", `Please upload an image smaller than ${IMAGE_MAX_SIZE_MB} MB.`);
  }

  return "";
}

function getIssueFieldGroup(form, fieldName) {
  const field = form.querySelector(`#${fieldName}`);
  return field ? field.closest(".form-group") : null;
}

function getIssueFieldErrorEl(form, fieldName) {
  return form.querySelector(`[data-error-for="${fieldName}"]`);
}

function setIssueFieldError(form, fieldName, message) {
  const group = getIssueFieldGroup(form, fieldName);
  const errorEl = getIssueFieldErrorEl(form, fieldName);

  if (group) {
    group.classList.add("invalid");
  }

  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = "block";
  }
}

function clearIssueFieldError(form, fieldName) {
  const group = getIssueFieldGroup(form, fieldName);
  const errorEl = getIssueFieldErrorEl(form, fieldName);

  if (group) {
    group.classList.remove("invalid");
  }

  if (errorEl) {
    errorEl.textContent = "";
    errorEl.style.display = "";
  }

  if (fieldName === "image") {
    const uploadArea = document.getElementById("uploadArea");
    if (uploadArea) uploadArea.classList.remove("invalid");
  }
}

function clearIssueFieldErrors(form) {
  ["title", "category", "location", "ward", "description", "email", "image"].forEach((fieldName) => {
    clearIssueFieldError(form, fieldName);
  });
}

function saveIssueDraft() {
  const form = document.getElementById("reportIssueForm");
  if (!form) return;

  const draft = {
    title: form.querySelector("#title")?.value || "",
    category: form.querySelector("#category")?.value || "",
    description: form.querySelector("#description")?.value || "",
    email: form.querySelector("#email")?.value || "",
    priority: form.querySelector('input[name="priority"]:checked')?.value || "",
    location: form.querySelector("#location")?.value || "",
    ward: form.querySelector("#ward")?.value || "",
    city: form.querySelector("#city")?.value || "",
    state: form.querySelector("#state")?.value || "",
    lat: form.querySelector("#lat")?.value || "",
    lng: form.querySelector("#lng")?.value || "",
    updatedAt: new Date().toISOString()
  };

  const hasContent = ["title", "category", "description", "email", "location", "ward", "city", "state", "lat", "lng"]
    .some((key) => String(draft[key] || "").trim() !== "") || (draft.priority && draft.priority !== "Medium");

  if (!hasContent) {
    clearAllIssueDraftStorage();
    setIssueDraftStatus(issueText("report.draftNoSaved", "No draft saved yet"), "cleared");
    return;
  }

  localStorage.setItem(getIssueDraftStorageKey(), JSON.stringify(draft));
  setIssueDraftStatus(issueText("report.draftSaved", "Draft saved"), "saved");
}

function clearIssueDraft() {
  localStorage.removeItem(getIssueDraftStorageKey());
  setIssueDraftStatus(issueText("report.draftCleared", "Draft cleared"), "cleared");
}

function resetIssueFormFields(form) {
  if (!form) return;

  form.reset();

  const titleInput = form.querySelector("#title");
  if (titleInput) titleInput.value = "";

  const categorySelect = form.querySelector("#category");
  if (categorySelect) categorySelect.value = "";

  const descriptionInput = form.querySelector("#description");
  if (descriptionInput) descriptionInput.value = "";

  const emailInput = form.querySelector("#email");
  if (emailInput) emailInput.value = "";

  const locationInput = form.querySelector("#location");
  if (locationInput) locationInput.value = "";

  const wardInput = form.querySelector("#ward");
  if (wardInput) wardInput.value = "";

  const cityInput = form.querySelector("#city");
  if (cityInput) cityInput.value = "";

  const stateInput = form.querySelector("#state");
  if (stateInput) stateInput.value = "";

  const priorityRadios = form.querySelectorAll('input[name="priority"]');
  priorityRadios.forEach((radio) => {
    radio.checked = false;
  });

  const fileInput = form.querySelector("#image");
  const fileName = document.getElementById("fileName");
  const imagePreview = document.getElementById("imagePreview");
  const uploadArea = document.getElementById("uploadArea");

  if (fileInput) fileInput.value = "";
  if (fileName) fileName.textContent = issueText("report.photoEmpty", "No file chosen");
  if (imagePreview) {
    imagePreview.src = "";
    imagePreview.style.display = "none";
  }
  if (uploadArea) uploadArea.classList.remove("invalid");

  const latInput = form.querySelector("#lat");
  const lngInput = form.querySelector("#lng");
  if (latInput) latInput.value = "";
  if (lngInput) lngInput.value = "";
}

function clearIssueDraftAndResetForm() {
  const form = document.getElementById("reportIssueForm");
  if (!form) return;

  clearAllIssueDraftStorage();
  clearIssueFieldErrors(form);
  resetIssueFormFields(form);

  if (issueDraftSaveTimer) {
    clearTimeout(issueDraftSaveTimer);
  }
  if (issueDraftStatusTimer) {
    clearTimeout(issueDraftStatusTimer);
  }
  setIssueDraftStatus(issueText("report.draftCleared", "Draft cleared"), "cleared");

  if (map && marker && issueMapInitialCenter) {
    map.setView([issueMapInitialCenter.lat, issueMapInitialCenter.lng], 12);
    marker.setLatLng([issueMapInitialCenter.lat, issueMapInitialCenter.lng]);
  }

}

function restoreIssueDraft() {
  const form = document.getElementById("reportIssueForm");
  if (!form) return false;

  const rawDraft = localStorage.getItem(getIssueDraftStorageKey());
  if (!rawDraft) return false;

  try {
    const draft = JSON.parse(rawDraft);
    if (!draft || typeof draft !== "object") return false;

    const setValue = (selector, value) => {
      const el = form.querySelector(selector);
      if (el && value) el.value = value;
    };

    setValue("#title", draft.title);
    setValue("#category", draft.category);
    setValue("#description", draft.description);
    setValue("#email", draft.email);
    setValue("#location", draft.location);
    setValue("#ward", draft.ward);
    setValue("#city", draft.city);
    setValue("#state", draft.state);
    setValue("#lat", draft.lat);
    setValue("#lng", draft.lng);

    if (draft.priority) {
      const priorityEl = form.querySelector(`input[name="priority"][value="${draft.priority}"]`);
      if (priorityEl) priorityEl.checked = true;
    }

    const categorySelect = form.querySelector("#category");
    if (categorySelect && draft.category) {
      categorySelect.value = draft.category;
    }

    return true;
  } catch (err) {
    console.error("Failed to restore issue draft:", err);
    localStorage.removeItem(getIssueDraftStorageKey());
    return false;
  }
}

function scheduleIssueDraftSave() {
  if (issueDraftSaveTimer) {
    clearTimeout(issueDraftSaveTimer);
  }

  setIssueDraftStatus(issueText("report.draftSaving", "Saving draft..."), "saving");

  issueDraftSaveTimer = setTimeout(() => {
    saveIssueDraft();
  }, 150);
}

function setIssueDraftStatus(text, state) {
  const statusEl = document.getElementById("draftStatus");
  const textEl = document.getElementById("draftStatusText");
  if (!statusEl || !textEl) return;

  statusEl.classList.remove("saving", "saved", "cleared");
  if (state) {
    statusEl.classList.add(state);
  }
  textEl.textContent = text;

  if (issueDraftStatusTimer) {
    clearTimeout(issueDraftStatusTimer);
  }

  if (state === "saved" || state === "cleared") {
    issueDraftStatusTimer = setTimeout(() => {
      statusEl.classList.remove("saving", "saved", "cleared");
      textEl.textContent = state === "saved" ? issueText("report.draftSaved", "Draft saved") : issueText("report.draftNoSaved", "No draft saved yet");
    }, 2500);
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
      const mapStatusEl = document.getElementById("mapStatus");
      if (mapStatusEl) mapStatusEl.textContent = "Map unavailable (loader missing)";
      return;
    }

    if (!window.isLeafletLoaded || !window.L) {
      const mapStatusEl = document.getElementById("mapStatus");
      if (mapStatusEl) mapStatusEl.textContent = "Map unavailable (API failed to load)";
      return;
    }

    mapElement.innerHTML = ""; // Clear loading status

    const draftCenter = getDraftCoordinates();
    const defaultCenter = draftCenter || await getInitialCenter();
    issueMapInitialCenter = defaultCenter;

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
      }).on('markgeocode', async function (e) {
        const bbox = e.geocode.bbox;
        const center = e.geocode.center;
        map.fitBounds(bbox);
        marker.setLatLng(center);
        updateHiddenCoordinates(center.lat, center.lng);
        await reverseGeocode(center.lat, center.lng);
      }).addTo(map);
    }

    // Set initial hidden values
    updateHiddenCoordinates(defaultCenter.lat, defaultCenter.lng, false);
    if (draftCenter) {
      await reverseGeocode(defaultCenter.lat, defaultCenter.lng);
      scheduleIssueDraftSave();
    }

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
    const mapStatusEl = document.getElementById("mapStatus");
    if (mapStatusEl) mapStatusEl.textContent = "Failed to load map";
  }
}

async function getInitialCenter() {
  const fallbackCenter = { lat: 19.076, lng: 72.8777 }; // Mumbai

  try {
    if (!navigator.geolocation || !navigator.permissions || !navigator.permissions.query) {
      return fallbackCenter;
    }

    const permission = await navigator.permissions.query({ name: "geolocation" });
    if (permission.state !== "granted") {
      return fallbackCenter;
    }

    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 600000
      });
    });

    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };
  } catch (err) {
    return fallbackCenter;
  }
}

function getDraftCoordinates() {
  const draft = getSavedIssueDraft();
  if (!draft) return null;

  const lat = parseFloat(draft.lat);
  const lng = parseFloat(draft.lng);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  return null;
}

// Function to fetch address from coordinates using Nominatim API
async function reverseGeocode(lat, lng) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
    const data = await response.json();
    if (data && data.display_name) {
      // Auto-fill the location text input
      const locationInput = document.getElementById("location");
      if (locationInput) {
        locationInput.value = data.display_name;
        flashAutoFill(locationInput);
      }

      // Auto-fill State and City from address details
      if (data.address) {
        const stateInput = document.getElementById("state");
        if (stateInput && data.address.state) {
          stateInput.value = data.address.state;
          flashAutoFill(stateInput);
        }

        const cityInput = document.getElementById("city");
        const cityValue = data.address.city || data.address.town || data.address.village || data.address.county || '';
        if (cityInput && cityValue) {
          cityInput.value = cityValue;
          flashAutoFill(cityInput);
        }
      }

      scheduleIssueDraftSave();
    }
  } catch (err) {
    console.error("Reverse geocoding failed:", err);
  }
}

// Flash an input green briefly to indicate auto-fill
function flashAutoFill(inputEl) {
  inputEl.style.transition = 'background-color 0.3s ease';
  inputEl.style.backgroundColor = '#dcfce7'; // light green
  setTimeout(() => { inputEl.style.backgroundColor = ''; }, 1500);
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
    loadIssueCategories();
    setupIssueUploadValidation();
    setupIssueDraftAutosave();
  }
});

const DEFAULT_CATEGORIES = [
  "Potholes / Damaged Road",
  "Broken Footpath",
  "Road Crack / Sinkhole",
  "Damaged Divider",
  "Road Sign Missing",
  "Speed Breaker Damage",
  "Dangerous Open Construction",
  "Damaged Public Infrastructure",
  "Streetlight Not Working",
  "Flickering Streetlight",
  "Broken Streetlight Pole",
  "Exposed Electrical Wires",
  "Dark Area / No Streetlights",
  "Garbage Not Collected",
  "Overflowing Garbage Bin",
  "Illegal Garbage Dump",
  "Construction Waste Dump",
  "Dead Animal on Road",
  "Dirty Street / Public Area",
  "Waste Burning",
  "No Water Supply",
  "Low Water Pressure",
  "Water Leakage",
  "Contaminated Water",
  "Broken Water Pipeline",
  "Blocked Drain",
  "Sewage Overflow",
  "Open Manhole",
  "Broken Drain Cover",
  "Waterlogging / Flooded Road",
  "Mosquito Breeding Area",
  "Stray Animal Issue",
  "Food Hygiene Complaint",
  "Unhygienic Public Toilet",
  "Public Health Hazard",
  "Park Maintenance Issue",
  "Broken Park Equipment",
  "Unclean Garden",
  "Tree Fallen",
  "Overgrown Trees / Branches",
  "Illegal Street Vendor",
  "Footpath Encroachment",
  "Illegal Construction",
  "Roadside Obstruction",
  "Broken Traffic Signal",
  "Missing Road Signs",
  "Illegal Parking",
  "Dangerous Intersection"
];

async function loadIssueCategories() {
  try {
    const res = await fetch("/api/departments");
    const data = await res.json();
    const categorySet = new Set();

    if (res.ok) {
      const responseData = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
      responseData.forEach((dept) => {
        if (dept.supportedCategories && Array.isArray(dept.supportedCategories)) {
          dept.supportedCategories.forEach((category) => categorySet.add(category));
        }
      });

      if (categorySet.size === 0) {
        DEFAULT_CATEGORIES.forEach((category) => categorySet.add(category));
      }

      populateCategorySelect(Array.from(categorySet).sort());
    } else {
      console.error("Failed to fetch departments", data);
      populateCategorySelect(DEFAULT_CATEGORIES);
    }
  } catch (err) {
    console.error("Error fetching departments:", err);
    populateCategorySelect(DEFAULT_CATEGORIES);
  }
}

function populateCategorySelect(categories) {
  const catSelect = document.getElementById("category");
  if (!catSelect) return;

  const token = localStorage.getItem("citizen_token");
  const currentValue = catSelect.value;
  const savedDraftCategory = token ? (getSavedIssueDraft()?.category || "") : "";
  catSelect.innerHTML = '<option value="">Select a category</option>';

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    catSelect.appendChild(option);
  });

  if (!token) {
    catSelect.value = "";
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const selectedCategory = urlParams.get("category");
  const targetValue = savedDraftCategory || selectedCategory || currentValue;

  if (targetValue && Array.from(catSelect.options).some((option) => option.value === targetValue)) {
    catSelect.value = targetValue;
  }
}

function getSavedIssueDraft() {
  const rawDraft = localStorage.getItem(getIssueDraftStorageKey());
  if (!rawDraft) return null;

  try {
    const draft = JSON.parse(rawDraft);
    return draft && typeof draft === "object" ? draft : null;
  } catch (err) {
    return null;
  }
}

function setupIssueUploadValidation() {
  const imageInput = document.getElementById("image");
  const uploadArea = document.getElementById("uploadArea");
  const fileName = document.getElementById("fileName");
  const imagePreview = document.getElementById("imagePreview");

  if (!imageInput || !uploadArea || !fileName || !imagePreview) {
    return;
  }

  const handleFileChange = () => {
    const file = imageInput.files && imageInput.files[0] ? imageInput.files[0] : null;
    uploadArea.classList.remove("invalid");
    clearIssueFieldError(document.getElementById("reportIssueForm"), "image");

    if (!file) {
      fileName.textContent = issueText("report.photoEmpty", "No file chosen");
      imagePreview.src = "";
      imagePreview.style.display = "none";
      return;
    }

    const error = validateIssueImage(imageInput, file);
    if (error) {
      fileName.textContent = file.name;
      imagePreview.src = "";
      imagePreview.style.display = "none";
      setIssueFieldError(document.getElementById("reportIssueForm"), "image", error);
      return;
    }

    fileName.textContent = file.name;
    const objectUrl = URL.createObjectURL(file);
    imagePreview.src = objectUrl;
    imagePreview.style.display = "block";
    imagePreview.onload = () => URL.revokeObjectURL(objectUrl);
  };

  imageInput.addEventListener("change", handleFileChange);

  ["title", "category", "location", "ward", "description", "email"].forEach((fieldName) => {
    const field = document.getElementById(fieldName);
    if (!field) return;
    const clearHandler = () => clearIssueFieldError(document.getElementById("reportIssueForm"), fieldName);
    field.addEventListener("input", clearHandler);
    field.addEventListener("change", clearHandler);
  });
}

function setupIssueDraftAutosave() {
  const form = document.getElementById("reportIssueForm");
  if (!form) return;

  const token = localStorage.getItem("citizen_token");
  if (!token) {
    clearIssueDraft(); // Guests shouldn't have persistent drafts
    resetIssueFormFields(form);
    window.setTimeout(() => {
      resetIssueFormFields(form);
    }, 50);
  } else {
    const draftRestored = restoreIssueDraft();
    if (draftRestored) {
      setIssueDraftStatus(issueText("report.draftRestored", "Draft restored"), "saved");
    }
  }

  const formFields = [
    "#title",
    "#category",
    "#description",
    "#email",
    "#location",
    "#ward",
    "#city",
    "#state"
  ];

  formFields.forEach((selector) => {
    const field = form.querySelector(selector);
    if (!field) return;
    field.addEventListener("input", scheduleIssueDraftSave);
    field.addEventListener("change", scheduleIssueDraftSave);
  });

  const priorityRadios = form.querySelectorAll('input[name="priority"]');
  priorityRadios.forEach((radio) => {
    radio.addEventListener("change", scheduleIssueDraftSave);
  });

  const originalFileInput = form.querySelector("#image");
  if (originalFileInput) {
    originalFileInput.addEventListener("change", scheduleIssueDraftSave);
  }

  window.addEventListener("beforeunload", saveIssueDraft);
}

function updateHiddenCoordinates(lat, lng, saveDraft = true) {
  const latInput = document.getElementById("lat");
  const lngInput = document.getElementById("lng");

  if (latInput) latInput.value = lat;
  if (lngInput) lngInput.value = lng;

  if (saveDraft) {
    scheduleIssueDraftSave();
  }
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
        showToast('error', issueText("common.locationError", "Could not get your location. Please check your browser permissions."));
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    );
  } else {
    showToast('error', issueText("common.geolocationUnsupported", "Geolocation is not supported by this browser."));
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
};

