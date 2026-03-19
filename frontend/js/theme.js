// Theme toggle functionality
(function () {
  // Get saved theme or default to light
  const savedTheme = localStorage.getItem('cityplus-theme') || 'light';

  // Apply theme on page load
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cityplus-theme', theme);
  }

  // Initialize theme
  applyTheme(savedTheme);

  // Theme toggle handler
  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
  }

  // Make toggleTheme available globally
  window.toggleTheme = toggleTheme;

  // Add toggle button to all navbars
  document.addEventListener('DOMContentLoaded', function () {
    // Add the theme toggle button to navbar-auth (right side next to login button)
    const authContainers = document.querySelectorAll('.navbar-auth');
    authContainers.forEach(authContainer => {
      // Check if toggle already exists
      if (!authContainer.querySelector('.theme-toggle')) {
        const toggleBtn = document.createElement('button');
        toggleBtn.classList.add('theme-toggle');
        toggleBtn.classList.add('theme-button');
        toggleBtn.setAttribute('aria-label', 'Toggle dark mode');
        // Only include the icon
        toggleBtn.innerHTML = '<span class="theme-toggle-icon"></span>';
        toggleBtn.addEventListener('click', toggleTheme);

        // Append the theme button right after the login button inside navbar-auth
        authContainer.appendChild(toggleBtn);
        toggleBtn.style.marginLeft = '12px';
      }
    });

    // Scroll to top button functionality
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');

    if (scrollToTopBtn) {
      // Show or hide the button based on scroll position
      window.addEventListener('scroll', () => {
        // Show button if scrolled more than 300px
        if (window.scrollY > 300) {
          scrollToTopBtn.classList.add('show');
        } else {
          scrollToTopBtn.classList.remove('show');
        }
      });

      // Scroll to top on click
      scrollToTopBtn.addEventListener('click', () => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });
    }

    // Mobile menu toggle functionality
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navbarMenu = document.querySelector('.navbar-menu');
    const navbarAuth = document.querySelector('.navbar-auth');

    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', function () {
        if (navbarMenu) navbarMenu.classList.toggle('show');
        if (navbarAuth) navbarAuth.classList.toggle('show');

        // Toggle icon between 'menu' and 'close'
        if (mobileMenuBtn.textContent === 'menu') {
          mobileMenuBtn.textContent = 'close';
        } else {
          mobileMenuBtn.textContent = 'menu';
        }
      });
    }

    // Global Toast Function
    window.showToast = function (type, message) {
      const container = document.getElementById('toast-container');
      if (!container) return; // If container not present

      const toast = document.createElement('div');
      toast.className = `toast ${type}`;

      let iconName = 'info';
      if (type === 'success') iconName = 'check_circle';
      if (type === 'error') iconName = 'error';
      if (type === 'warning') iconName = 'warning';

      toast.innerHTML = `
        <span class="material-icons-round toast-icon">${iconName}</span>
        <div class="toast-message">${message}</div>
        <button class="toast-close"><span class="material-icons-round">close</span></button>
      `;

      container.appendChild(toast);

      // Trigger animation
      setTimeout(() => toast.classList.add('show'), 10);

      // Setup close button
      const closeBtn = toast.querySelector('.toast-close');

      const removeToast = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      };

      closeBtn.addEventListener('click', removeToast);

      // Auto close after 4 sec
      setTimeout(removeToast, 4000);
    };

    // Global Confirm Modal Function
    window.showConfirmModal = function (title, message, onConfirm) {
      // Check if modal container exists, create if not
      let modalContainer = document.getElementById('global-confirm-modal');
      if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'global-confirm-modal';
        modalContainer.className = 'confirm-modal-backdrop';
        modalContainer.innerHTML = `
          <div class="confirm-modal">
            <div class="confirm-modal-icon">
              <span class="material-icons-round">warning</span>
            </div>
            <h3 class="confirm-modal-title" id="confirm-modal-title"></h3>
            <p class="confirm-modal-text" id="confirm-modal-text"></p>
            <div class="confirm-modal-actions">
              <button class="btn btn-outline" id="confirm-modal-cancel">Cancel</button>
              <button class="btn btn-primary" id="confirm-modal-accept">Confirm</button>
            </div>
          </div>
        `;
        document.body.appendChild(modalContainer);
      }

      // Set content
      document.getElementById('confirm-modal-title').textContent = title;
      document.getElementById('confirm-modal-text').textContent = message;

      // Show modal
      modalContainer.classList.add('active');

      // Click handlers
      const btnCancel = document.getElementById('confirm-modal-cancel');
      const btnAccept = document.getElementById('confirm-modal-accept');

      // Cleanup function to remove event listeners and hide modal
      const cleanup = () => {
        modalContainer.classList.remove('active');
        // We clone to remove previous event listeners efficiently
        btnCancel.replaceWith(btnCancel.cloneNode(true));
        btnAccept.replaceWith(btnAccept.cloneNode(true));
      };

      // Handle cancel
      document.getElementById('confirm-modal-cancel').addEventListener('click', () => {
        cleanup();
      });

      // Handle accept
      document.getElementById('confirm-modal-accept').addEventListener('click', () => {
        cleanup();
        if (typeof onConfirm === 'function') {
          onConfirm();
        }
      });
    };

  });

})();

// Global Leaflet API loader (available to all pages)
window.isLeafletLoaded = false;

window.loadLeafletApi = async function () {
  if (window.isLeafletLoaded || document.querySelector('script[src*="leaflet.js"]')) {
    // Ensure geocoder is loaded even if Leaflet was already present
    return loadGeocoderApi();
  }

  return new Promise((resolve, reject) => {
    // Load CSS
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    // Load JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';

    script.onload = () => {
      window.isLeafletLoaded = true;
      loadGeocoderApi().then(resolve).catch(reject);
    };
    script.onerror = () => {
      console.error('Failed to load Leaflet API');
      reject(new Error('Failed to load Leaflet API'));
    };

    document.head.appendChild(script);
  });
};

function loadGeocoderApi() {
  if (document.querySelector('script[src*="Control.Geocoder.js"]')) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    // Load Geocoder CSS
    if (!document.querySelector('link[href*="Control.Geocoder.css"]')) {
      const geoLink = document.createElement('link');
      geoLink.rel = 'stylesheet';
      geoLink.href = 'https://unpkg.com/leaflet-control-geocoder/dist/Control.Geocoder.css';
      document.head.appendChild(geoLink);
    }

    // Load Geocoder JS
    const geoScript = document.createElement('script');
    geoScript.src = 'https://unpkg.com/leaflet-control-geocoder/dist/Control.Geocoder.js';
    
    geoScript.onload = () => {
      resolve();
    };
    geoScript.onerror = () => {
      console.error('Failed to load Geocoder API');
      reject(new Error('Failed to load Geocoder API'));
    };

    document.head.appendChild(geoScript);
  });
}
