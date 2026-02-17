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
  });

})();
