async function loadAdminData() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token || role !== "admin") {
    window.location.href = "login.html";
    return;
  }

  try {
    // 1) Summary + users + staff + issues in parallel
    const [summaryRes, usersRes, staffRes, issuesRes] = await Promise.all([
      fetch("http://localhost:5000/api/admin/summary", {
        headers: { Authorization: "Bearer " + token }
      }),
      fetch("http://localhost:5000/api/admin/users", {
        headers: { Authorization: "Bearer " + token }
      }),
      fetch("http://localhost:5000/api/admin/staff", {
        headers: { Authorization: "Bearer " + token }
      }),
      fetch("http://localhost:5000/api/issues/all", {
        headers: { Authorization: "Bearer " + token }
      })
    ]);

    const summaryData = await summaryRes.json();
    const usersData   = await usersRes.json();
    const staffData   = await staffRes.json();
    const issuesData  = await issuesRes.json();

    if (!summaryRes.ok) throw new Error(summaryData.message || "Unable to retrieve system summary. Please refresh the page or try again later.");
    if (!usersRes.ok)   throw new Error(usersData.message || "Unable to retrieve user data. Please refresh the page or try again later.");
    if (!staffRes.ok)   throw new Error(staffData.message || "Unable to retrieve staff data. Please refresh the page or try again later.");
    if (!issuesRes.ok)  throw new Error(issuesData.message || "Unable to retrieve issue data. Please refresh the page or try again later.");

    // ----- Summary cards -----
    const u = summaryData.users;
    const i = summaryData.issues;

    document.querySelector("#uTotal").textContent = u.total;
    document.querySelector("#uBreakdown").textContent =
      `Citizens: ${u.citizens} • Staff: ${u.staff} • Admins: ${u.admins}`;

    document.querySelector("#iTotal").textContent = i.total;
    document.querySelector("#iOpen").textContent = i.open;
    document.querySelector("#iProgress").textContent = i.inProgress;
    document.querySelector("#iResolved").textContent = i.resolved;

    // ----- Users table -----
    const tbodyUsers = document.querySelector("#adminUsersBody");
    tbodyUsers.innerHTML = "";
    (usersData.users || []).forEach(user => {
      const joined = new Date(user.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric"
      });
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${user.name}</strong></td>
        <td>${user.email}</td>
        <td><span class="role-badge ${user.role}">${user.role}</span></td>
        <td>${joined}</td>
      `;
      tbodyUsers.appendChild(tr);
    });

    // ----- Assign Issues table -----
    const staffList = staffData.staff || [];
    const tbodyIssues = document.querySelector("#adminIssuesBody");
    tbodyIssues.innerHTML = "";

    (issuesData.issues || []).forEach(issue => {
      const tr = document.createElement("tr");
      const assignedId = issue.assignedTo ? issue.assignedTo._id : "";
      const assignedName = issue.assignedTo ? issue.assignedTo.name : "";
      const citizenName = issue.citizen ? issue.citizen.name : "-";

      const staffOptions = staffList.map(s => {
        const selected = s._id === assignedId ? "selected" : "";
        return `<option value="${s._id}" ${selected}>${s.name}</option>`;
      }).join("");

      let statusClass = "open";
      if (issue.status === "In Progress") statusClass = "progress";
      if (issue.status === "Resolved") statusClass = "resolved";

      tr.innerHTML = `
        <td><code style="font-size:11px; color:#666;">#${issue._id.slice(-6)}</code></td>
        <td><strong>${issue.category}</strong></td>
        <td>${issue.location}</td>
        <td>${citizenName}</td>
        <td>
          <select class="form-select assign-select" data-id="${issue._id}">
            <option value="">-- Select Staff --</option>
            ${staffOptions}
          </select>
          ${assignedName ? `<div style="font-size:11px; color:#666; margin-top:4px;">Current: ${assignedName}</div>` : ""}
        </td>
        <td><span class="table-status-badge ${statusClass}">${issue.status}</span></td>
        <td>
          <button class="btn btn-primary btn-small assign-btn" data-id="${issue._id}">
            Assign
          </button>
        </td>
      `;
      tbodyIssues.appendChild(tr);
    });

    // one click handler for whole table
    tbodyIssues.addEventListener("click", async (e) => {
      if (!e.target.classList.contains("assign-btn")) return;

      const id = e.target.getAttribute("data-id");
      const select = tbodyIssues.querySelector(`.assign-select[data-id="${id}"]`);
      const staffId = select.value;

      if (!staffId) {
        alert("Please select a staff member from the dropdown menu before assigning this issue.");
        return;
      }

      await assignIssueToStaff(token, id, staffId);
    });

  } catch (err) {
    console.error(err);
    alert(err.message || "A system error occurred while loading dashboard data. Please refresh the page or contact support.");
  }
}

async function assignIssueToStaff(token, issueId, staffId) {
  try {
    const res = await fetch(`http://localhost:5000/api/issues/${issueId}/assign`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ staffId })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.message || "Unable to assign issue. Please verify the selection and try again.");
      return;
    }

    alert("Issue has been successfully assigned to the selected staff member.");
    // refresh to reflect changes
    loadAdminData();
  } catch (err) {
    console.error(err);
    alert("A system error occurred while assigning the issue. Please try again later.");
  }
}

document.addEventListener("DOMContentLoaded", loadAdminData);
