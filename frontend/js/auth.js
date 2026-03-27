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

let pendingRegistrationEmail = '';

function setRegistrationOtpVisible(visible) {
  const step1 = document.getElementById('regStep1');
  const step2 = document.getElementById('regStep2');

  if (step1) step1.style.display = visible ? 'none' : 'block';
  if (step2) step2.style.display = visible ? 'block' : 'none';
}

function resetRegistrationFlow() {
  pendingRegistrationEmail = '';

  const otpInput = document.getElementById('regOTP');
  if (otpInput) otpInput.value = '';

  const emailDisplay = document.getElementById('regEmailDisplay');
  if (emailDisplay) emailDisplay.textContent = '';

  setRegistrationOtpVisible(false);
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
  resetRegistrationFlow();
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
    const { data } = await window.CityPlusApi.fetchJson("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    window.CityPlusApi.saveSession(data, email);
    const dashboardUrl = window.CityPlusApi.redirectForRole(data.role);

    showSuccessModal(
      "Login Successful!",
      `Welcome back${data.name ? ', ' + data.name : ''}! You are being redirected to your dashboard.`,
      dashboardUrl
    );
  } catch (err) {
    console.error(err);
    if (err.message && (err.message.includes("blocked") || err.message.includes("terminated"))) {
      showErrorModal("Account Restricted", err.message);
    } else {
      showErrorModal("Login Failed", err.message || "Authentication failed. Please verify your credentials and try again.");
    }
  }
}

// Registration function
async function registerUser() {
  const name = document.querySelector("#regName").value.trim();
  const email = document.querySelector("#regEmail").value.trim();
  const password = document.querySelector("#regPassword").value;
  const confirmPassword = document.querySelector("#regConfirmPassword").value;
  const submitBtn = document.querySelector('#registerForm button[type="submit"]');
  const originalBtnHtml = submitBtn ? submitBtn.innerHTML : "";

  // Validation
  if (!name || !email || !password || !confirmPassword) {
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

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Creating...';
  }

  try {
    const { data } = await window.CityPlusApi.fetchJson("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password })
    });

    pendingRegistrationEmail = email;
    setRegistrationOtpVisible(true);

    const emailDisplay = document.getElementById('regEmailDisplay');
    if (emailDisplay) {
      emailDisplay.textContent = email;
    }

    const otpInput = document.getElementById('regOTP');
    if (otpInput) {
      otpInput.value = '';
      otpInput.focus();
    }

    if (data && data.emailSent === false) {
      showToast('warning', 'Account created, but the verification email could not be delivered right now. You can use Resend OTP after a short wait.');
    } else {
      showToast('success', 'Account created. Enter the OTP sent to your email to verify your account.');
    }
  } catch (err) {
    console.error(err);
    showToast('error', err.message || "A system error occurred during registration. Please try again later.");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
    }
  }
}

async function verifyRegistrationOTP() {
  const otp = document.getElementById('regOTP').value.trim();

  if (!pendingRegistrationEmail) {
    showToast('warning', 'Please register first before verifying the OTP.');
    return;
  }

  if (!otp || otp.length !== 6) {
    showToast('warning', 'Please enter the 6-digit code.');
    return;
  }

  const btn = document.getElementById('regVerifyBtn');
  btn.disabled = true;
  btn.textContent = 'Verifying...';

  try {
    await window.CityPlusApi.fetchJson('/api/auth/register/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email: pendingRegistrationEmail, otp })
    });

    const verifiedEmail = pendingRegistrationEmail;
    resetRegistrationFlow();
    window.switchToLogin();

    const loginEmail = document.getElementById('email');
    if (loginEmail) {
      loginEmail.value = verifiedEmail;
    }

    const loginPassword = document.getElementById('password');
    if (loginPassword) {
      loginPassword.focus();
    }

    showToast('success', 'Email verified successfully. You can now log in with your credentials.');
  } catch (err) {
    console.error(err);
    showToast('error', err.message || 'Failed to verify OTP. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verify OTP';
  }
}

async function resendRegistrationOTP() {
  if (!pendingRegistrationEmail) {
    showToast('warning', 'Please register first before requesting another OTP.');
    return;
  }

  const resendBtn = document.getElementById('regResendBtn');
  if (resendBtn) {
    resendBtn.disabled = true;
    resendBtn.textContent = 'Sending...';
  }

  try {
    await window.CityPlusApi.fetchJson('/api/auth/register/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email: pendingRegistrationEmail })
    });

    showToast('success', 'A new OTP has been sent to your email.');
  } catch (err) {
    console.error(err);
    showToast('error', err.message || 'Unable to resend the OTP.');
  } finally {
    if (resendBtn) {
      resendBtn.disabled = false;
      resendBtn.textContent = 'Resend OTP';
    }
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
    const { payload: data } = await window.CityPlusApi.fetchJson('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });

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
    await window.CityPlusApi.fetchJson('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email: fpEmail, otp })
    });

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
    await window.CityPlusApi.fetchJson('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email: fpEmail, newPassword })
    });

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
