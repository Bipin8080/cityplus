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
    alert("Please provide your email address and password to continue.");
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
      alert(data.message || "Authentication failed. Please verify your credentials and try again.");
      return;
    }

    // Save token + role + name
    localStorage.setItem("token", data.token);
    localStorage.setItem("role", data.role);
    localStorage.setItem("name", data.name || "");

    // Redirect based on role
    if (data.role === "citizen") {
      window.location.href = "citizen-dashboard.html";
    } else if (data.role === "staff") {
      window.location.href = "staff-dashboard.html";
    } else if (data.role === "admin") {
      window.location.href = "admin-dashboard.html";
    } else {
      alert("Invalid user role detected. Please contact system administrator.");
    }
  } catch (err) {
    console.error(err);
    alert("A system error occurred. Please try again later or contact support if the issue persists.");
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
    alert("Please complete all required fields.");
    return;
  }

  if (password !== confirmPassword) {
    alert("Passwords do not match. Please re-enter your password.");
    document.querySelector("#regConfirmPassword").focus();
    return;
  }

  if (password.length < 6) {
    alert("Password must be at least 6 characters long.");
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
    alert("Please select a valid account type.");
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
      alert(data.message || "Registration failed. Please check your information and try again.");
      return;
    }

    // Registration successful - automatically log in
    alert("Account created successfully! Logging you in...");
    
    // Auto-login after registration
    const loginRes = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const loginData = await loginRes.json();

    if (!loginRes.ok) {
      alert("Account created but login failed. Please log in manually.");
      switchToLogin();
      return;
    }

    // Save token + role + name
    localStorage.setItem("token", loginData.token);
    localStorage.setItem("role", loginData.role);
    localStorage.setItem("name", loginData.name || "");

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
    alert("A system error occurred during registration. Please try again later.");
  }
}
