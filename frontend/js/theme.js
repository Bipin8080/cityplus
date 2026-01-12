// Theme toggle functionality
(function() {
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
  document.addEventListener('DOMContentLoaded', function() {
    const navbars = document.querySelectorAll('.navbar-inner nav');
    navbars.forEach(nav => {
      // Check if toggle already exists
      if (!nav.querySelector('.theme-toggle')) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'theme-toggle';
        toggleBtn.setAttribute('onclick', 'toggleTheme()');
        toggleBtn.setAttribute('aria-label', 'Toggle dark mode');
        toggleBtn.innerHTML = '<span class="theme-toggle-icon"></span> <span class="theme-toggle-text">Theme</span>';
        
        // Insert before logout button or at the end
        const logoutBtn = nav.querySelector('a[href*="login"]');
        if (logoutBtn) {
          nav.insertBefore(toggleBtn, logoutBtn);
        } else {
          nav.appendChild(toggleBtn);
        }
      }
    });
  });
})();
