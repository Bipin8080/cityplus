// Error Modal Functions
function showErrorModal(title, message) {
  document.getElementById('errorModalTitle').textContent = title;
  document.getElementById('errorModalMessage').textContent = message;
  document.getElementById('errorModal').style.display = 'flex';
}

function closeErrorModal() {
  document.getElementById('errorModal').style.display = 'none';
}

// Success Modal Function
function showSuccessModal(title, message, redirectUrl) {
  document.getElementById('successModalTitle').textContent = title;
  document.getElementById('successModalMessage').textContent = message;
  document.getElementById('successModal').style.display = 'flex';

  const progressBar = document.getElementById('successProgressBar');
  const redirectText = document.querySelector('.success-modal-redirect');
  if (redirectText) redirectText.textContent = "Redirecting...";

  // Start progress bar animation
  setTimeout(() => {
    progressBar.style.transition = 'width 1.5s linear';
    progressBar.style.width = '0%';
  }, 50);

  // Short delay before redirect
  setTimeout(() => {
    window.location.href = redirectUrl;
  }, 1500);
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
    const res = await fetch("/api/auth/login", {
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

    // Save token + role + email + name + department Name if present using role prefix
    const prefix = data.role + "_";
    localStorage.setItem(prefix + "token", data.token);
    localStorage.setItem(prefix + "role", data.role);
    localStorage.setItem(prefix + "userEmail", email);
    if (data.name) {
      localStorage.setItem(prefix + "userName", data.name);
    }
    if (data.departmentName) {
      localStorage.setItem(prefix + "departmentName", data.departmentName);
    }

    // Redirect based on role with success modal
    let dashboardUrl = '';
    if (data.role === "citizen") {
      dashboardUrl = "citizen-dashboard.html";
    } else if (data.role === "staff") {
      dashboardUrl = "staff-dashboard.html";
    } else if (data.role === "admin") {
      dashboardUrl = "admin-dashboard.html";
    } else {
      showErrorModal("Invalid Role", "Invalid user role detected. Please contact system administrator.");
      return;
    }

    showSuccessModal(
      "Login Successful!",
      `Welcome back${data.name ? ', ' + data.name : ''}! You are being redirected to your dashboard.`,
      dashboardUrl
    );
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
    showToast('warning', "Please complete all required fields.");
    return;
  }

  if (password !== confirmPassword) {
    showToast('warning', "Passwords do not match. Please re-enter your password.");
    document.querySelector("#regConfirmPassword").focus();
    return;
  }

  if (password.length < 6) {
    showToast('warning', "Password must be at least 6 characters long.");
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
    showToast('error', "Please select a valid account type.");
    return;
  }

  try {
    // Staff/Admin registration requires admin authentication
    const headers = { "Content-Type": "application/json" };
    if (role === "staff" || role === "admin") {
      const token = localStorage.getItem("admin_token") || localStorage.getItem("token");
      if (!token) {
        showToast('error', "You must be logged in as an admin to register staff or admin accounts.");
        return;
      }
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast('error', data.message || "Registration failed. Please check your information and try again.");
      return;
    }

    // Registration successful - automatically log in
    showToast('success', "Account created successfully! Logging you in...");

    // Auto-login after registration
    const loginRes = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const loginData = await loginRes.json();

    if (!loginRes.ok) {
      showToast('error', "Account created but login failed. Please log in manually.");
      switchToLogin();
      return;
    }

    // Save token + role + email + name with role prefix
    const prefix = loginData.role + "_";
    localStorage.setItem(prefix + "token", loginData.token);
    localStorage.setItem(prefix + "role", loginData.role);
    localStorage.setItem(prefix + "userName", name);
    localStorage.setItem(prefix + "userEmail", email);

    // Redirect based on role with success modal
    let regDashboardUrl = '';
    if (loginData.role === "citizen") {
      regDashboardUrl = "citizen-dashboard.html";
    } else if (loginData.role === "staff") {
      regDashboardUrl = "staff-dashboard.html";
    } else if (loginData.role === "admin") {
      regDashboardUrl = "admin-dashboard.html";
    }

    showSuccessModal(
      "Registration Successful!",
      `Welcome to CityPlus, ${name}! Your account has been created. Redirecting to your dashboard.`,
      regDashboardUrl
    );
  } catch (err) {
    console.error(err);
    showToast('error', "A system error occurred during registration. Please try again later.");
  }
}

// ──── Forgot Password Flow ──────────────────────────────────────────────
let fpEmail = '';

function openForgotPasswordModal() {
  document.getElementById('forgotPasswordModal').style.display = 'flex';
  document.getElementById('fpStep1').style.display = 'block';
  document.getElementById('fpStep2').style.display = 'none';
  document.getElementById('fpStep3').style.display = 'none';
  document.getElementById('fpEmail').value = '';
  fpEmail = '';
}

function closeForgotPasswordModal() {
  document.getElementById('forgotPasswordModal').style.display = 'none';
}

async function sendForgotPasswordOTP() {
  const email = document.getElementById('fpEmail').value.trim();
  if (!email) {
    showToast('warning', 'Please enter your email address.');
    return;
  }

  const btn = document.getElementById('fpSendBtn');
  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast('error', data.message || 'Failed to send OTP.');
      return;
    }

    fpEmail = email;
    document.getElementById('fpEmailDisplay').textContent = email;
    document.getElementById('fpStep1').style.display = 'none';
    document.getElementById('fpStep2').style.display = 'block';
    showToast('success', 'OTP sent to your email!');
  } catch (err) {
    console.error(err);
    showToast('error', 'A system error occurred. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send OTP';
  }
}

async function verifyForgotPasswordOTP() {
  const otp = document.getElementById('fpOTP').value.trim();
  if (!otp || otp.length !== 6) {
    showToast('warning', 'Please enter the 6-digit code.');
    return;
  }

  const btn = document.getElementById('fpVerifyBtn');
  btn.disabled = true;
  btn.textContent = 'Verifying...';

  try {
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: fpEmail, otp })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast('error', data.message || 'Invalid OTP.');
      return;
    }

    document.getElementById('fpStep2').style.display = 'none';
    document.getElementById('fpStep3').style.display = 'block';
    showToast('success', 'OTP verified! Set your new password.');
  } catch (err) {
    console.error(err);
    showToast('error', 'A system error occurred. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verify Code';
  }
}

async function resetForgotPassword() {
  const newPassword = document.getElementById('fpNewPassword').value;
  const confirmPassword = document.getElementById('fpConfirmPassword').value;

  if (!newPassword || !confirmPassword) {
    showToast('warning', 'Please fill in both password fields.');
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('warning', 'Passwords do not match.');
    return;
  }

  if (newPassword.length < 6) {
    showToast('warning', 'Password must be at least 6 characters.');
    return;
  }

  const btn = document.getElementById('fpResetBtn');
  btn.disabled = true;
  btn.textContent = 'Resetting...';

  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: fpEmail, newPassword })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast('error', data.message || 'Failed to reset password.');
      return;
    }

    showToast('success', 'Password reset successfully! You can now log in.');
    closeForgotPasswordModal();
  } catch (err) {
    console.error(err);
    showToast('error', 'A system error occurred. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Reset Password';
  }
}

async function resendOTP() {
  showToast('info', 'Resending OTP...');
  await sendForgotPasswordOTP();
}

// Close forgot password modal when clicking outside
document.addEventListener('DOMContentLoaded', () => {
  const fpModal = document.getElementById('forgotPasswordModal');
  if (fpModal) {
    fpModal.addEventListener('click', (e) => {
      if (e.target === fpModal) closeForgotPasswordModal();
    });
  }
});
