(function () {
  function getTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("token") || "";
  }

  function decodeJwtPayload(token) {
    const parts = token.split(".");
    if (parts.length < 2) {
      throw new Error("Invalid token format");
    }

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return JSON.parse(atob(padded));
  }

  function showStatus(message, type = "info") {
    const el = document.getElementById("setupStatus");
    if (!el) return;

    el.style.display = "block";
    el.textContent = message;
    el.style.color = type === "error" ? "#b91c1c" : "#1e40af";
    el.style.background = type === "error" ? "#fee2e2" : "#dbeafe";
    el.style.padding = "0.75rem 1rem";
    el.style.borderRadius = "0.75rem";
  }

  async function submitSetup(event) {
    event.preventDefault();

    const token = getTokenFromUrl();
    const password = document.getElementById("setupPassword").value;
    const confirmPassword = document.getElementById("setupConfirmPassword").value;

    if (!token) {
      showStatus("This setup link is missing its token. Request a new invite from an administrator.", "error");
      return;
    }

    if (!password || !confirmPassword) {
      showStatus("Please enter and confirm your new password.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showStatus("Passwords do not match.", "error");
      return;
    }

    const btn = document.getElementById("setupSubmitBtn");
    btn.disabled = true;
    btn.textContent = "Activating...";

    try {
      const { data } = await window.CityPlusApi.fetchJson("/api/auth/complete-staff-setup", {
        method: "POST",
        body: JSON.stringify({ token, password })
      });

      window.CityPlusApi.saveSession(data, data.email);
      showStatus("Account activated. Redirecting to your dashboard...");

      setTimeout(() => {
        window.location.href = window.CityPlusApi.redirectForRole(data.role);
      }, 1200);
    } catch (err) {
      console.error(err);
      showStatus(err.message || "Unable to complete account setup.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Activate Account";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const token = getTokenFromUrl();
    const emailField = document.getElementById("setupEmail");
    const form = document.getElementById("staffSetupForm");

    if (!token) {
      showStatus("Invalid setup link. Ask an administrator to resend the invite.", "error");
      return;
    }

    try {
      const payload = decodeJwtPayload(token);
      if (payload.email && emailField) {
        emailField.value = payload.email;
      }
    } catch (error) {
      showStatus("Unable to read the setup link. Request a new invite.", "error");
      return;
    }

    if (form) {
      form.addEventListener("submit", submitSetup);
    }
  });
})();
