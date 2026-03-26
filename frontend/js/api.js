(function () {
  const rolePrefixes = {
    citizen: "citizen_",
    staff: "staff_",
    admin: "admin_"
  };

  function resolveRoleFromPath(pathname) {
    if (pathname.includes("citizen-dashboard")) return "citizen";
    if (pathname.includes("staff-dashboard")) return "staff";
    if (pathname.includes("admin-dashboard")) return "admin";
    return null;
  }

  function getRolePrefix(role) {
    return rolePrefixes[role] || "";
  }

  function getSession(role = resolveRoleFromPath(window.location.pathname)) {
    const prefix = getRolePrefix(role);
    if (!prefix) return null;

    const token = localStorage.getItem(prefix + "token");
    if (!token) return null;

    return {
      role,
      prefix,
      token,
      name: localStorage.getItem(prefix + "userName"),
      email: localStorage.getItem(prefix + "userEmail"),
      departmentName: localStorage.getItem(prefix + "departmentName")
    };
  }

  function getToken(role) {
    return getSession(role)?.token || null;
  }

  function authHeaders(role, extraHeaders = {}) {
    const headers = { ...extraHeaders };
    const token = getToken(role);
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  function readData(payload) {
    return payload && typeof payload === "object" && payload.data !== undefined ? payload.data : payload;
  }

  function saveSession(authData, fallbackEmail) {
    const role = authData.role;
    const prefix = getRolePrefix(role);
    if (!prefix) {
      throw new Error("Unknown user role");
    }

    localStorage.setItem(prefix + "token", authData.token);
    localStorage.setItem(prefix + "role", role);
    localStorage.setItem(prefix + "userEmail", authData.email || fallbackEmail || "");

    if (authData.name) {
      localStorage.setItem(prefix + "userName", authData.name);
    }

    if (authData.departmentName) {
      localStorage.setItem(prefix + "departmentName", authData.departmentName);
    }

    return prefix;
  }

  function clearSession(role) {
    const prefix = getRolePrefix(role);
    if (!prefix) return;

    const theme = localStorage.getItem("cityplus-theme");
    Object.keys(localStorage)
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => localStorage.removeItem(key));

    if (theme) {
      localStorage.setItem("cityplus-theme", theme);
    }
  }

  function redirectForRole(role) {
    if (role === "citizen") return "citizen-dashboard.html";
    if (role === "staff") return "staff-dashboard.html";
    if (role === "admin") return "admin-dashboard.html";
    return "login.html";
  }

  async function fetchJson(url, options = {}, role) {
    const headers = { ...(options.headers || {}) };
    const hasBody = options.body !== undefined;
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

    if (hasBody && !isFormData && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      ...options,
      headers: authHeaders(role, headers)
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }

    if (!response.ok) {
      const error = new Error(payload?.message || "Request failed");
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return {
      response,
      payload,
      data: readData(payload)
    };
  }

  window.CityPlusApi = {
    authHeaders,
    clearSession,
    fetchJson,
    getSession,
    getToken,
    readData,
    redirectForRole,
    resolveRoleFromPath,
    saveSession
  };
})();
