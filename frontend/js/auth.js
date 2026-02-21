// Error Modal Functions
function showErrorModal(title, message) {
  document.getElementById('errorModalTitle').textContent = title;
  document.getElementById('errorModalMessage').textContent = message;
  document.getElementById('errorModal').style.display = 'flex';
}

function closeErrorModal() {
  document.getElementById('errorModal').style.display = 'none';
}

// Close modal when clicking outside of it
document.addEventListener('DOMContentLoaded', () => {
  const errorModal = document.getElementById('errorModal');
  if (errorModal) {
    errorModal.addEventListener('click', (e) => {
      if (e.target === errorModal) {
        closeErrorModal();
      }
    });
  }

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeErrorModal();
    }
  });
});

// Switch between login and registration forms
function switchToLogin() {
  document.getElementById("loginForm").style.display = "block";
  document.getElementById("registerForm").style.display = "none";
  document.getElementById("loginTab").classList.add("active");
  document.getElementById("registerTab").classList.remove("active");
}

function switchToRegister() {
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("registerForm").style.display = "block";
  document.getElementById("loginTab").classList.remove("active");
  document.getElementById("registerTab").classList.add("active");
}

// Login function
async function loginUser() {
  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value.trim();

  if (!email || !password) {
    showErrorModal("Missing Information", "Please provide your email address and password to continue.");
    return;
  }

  try {
    const res = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      // Check if it's a blocked or terminated account error
      if (data.message && (data.message.includes("blocked") || data.message.includes("terminated"))) {
        showErrorModal("Account Restricted", data.message);
      } else {
        showErrorModal("Login Failed", data.message || "Authentication failed. Please verify your credentials and try again.");
      }
      return;
    }

    // Save token + role + email (name not available from login endpoint)
    localStorage.setItem("token", data.token);
    localStorage.setItem("role", data.role);
    localStorage.setItem("userEmail", email);

    // Redirect based on role
    if (data.role === "citizen") {
      window.location.href = "citizen-dashboard.html";
    } else if (data.role === "staff") {
      window.location.href = "staff-dashboard.html";
    } else if (data.role === "admin") {
      window.location.href = "admin-dashboard.html";
    } else {
      showErrorModal("Invalid Role", "Invalid user role detected. Please contact system administrator.");
    }
  } catch (err) {
    console.error(err);
    showErrorModal("System Error", "A system error occurred. Please try again later or contact support if the issue persists.");
  }
}

// Registration function
async function registerUser() {
  const name = document.querySelector("#regName").value.trim();
  const role = document.querySelector("#regRole").value;
  const email = document.querySelector("#regEmail").value.trim();
  const password = document.querySelector("#regPassword").value;
  const confirmPassword = document.querySelector("#regConfirmPassword").value;

  // Validation
  if (!name || !role || !email || !password || !confirmPassword) {
    showErrorModal("Incomplete Form", "Please complete all required fields.");
    return;
  }

  if (password !== confirmPassword) {
    showErrorModal("Password Mismatch", "Passwords do not match. Please re-enter your password.");
    document.querySelector("#regConfirmPassword").focus();
    return;
  }

  if (password.length < 6) {
    showErrorModal("Weak Password", "Password must be at least 6 characters long.");
    document.querySelector("#regPassword").focus();
    return;
  }

  // Determine registration endpoint based on role
  let endpoint = "";
  if (role === "citizen") {
    endpoint = "/api/auth/register";
  } else if (role === "staff") {
    endpoint = "/api/auth/register-staff";
  } else if (role === "admin") {
    endpoint = "/api/auth/register-admin";
  } else {
    showErrorModal("Invalid Selection", "Please select a valid account type.");
    return;
  }

  try {
    const res = await fetch(`http://localhost:5000${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      showErrorModal("Registration Failed", data.message || "Registration failed. Please check your information and try again.");
      return;
    }

    // Registration successful - automatically log in
    showErrorModal("Success", "Account created successfully! Logging you in...");

    // Auto-login after registration
    const loginRes = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const loginData = await loginRes.json();

    if (!loginRes.ok) {
      showErrorModal("Login Error", "Account created but login failed. Please log in manually.");
      switchToLogin();
      return;
    }

    // Save token + role + email + name from registration form
    localStorage.setItem("token", loginData.token);
    localStorage.setItem("role", loginData.role);
    localStorage.setItem("userName", name);
    localStorage.setItem("userEmail", email);

    // Redirect based on role
    if (loginData.role === "citizen") {
      window.location.href = "citizen-dashboard.html";
    } else if (loginData.role === "staff") {
      window.location.href = "staff-dashboard.html";
    } else if (loginData.role === "admin") {
      window.location.href = "admin-dashboard.html";
    }
  } catch (err) {
    console.error(err);
    showErrorModal("System Error", "A system error occurred during registration. Please try again later.");
  }
}
