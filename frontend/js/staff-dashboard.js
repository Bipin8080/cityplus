let staffAllIssues = [];
let staffAssignedIssues = [];
let currentStaffView = "all"; // "all" or "assigned"

async function loadStaffData() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token || role !== "staff") {
    window.location.href = "login.html";
    return;
  }

  const [allRes, assignedRes] = await Promise.all([
    fetch("http://localhost:5000/api/issues/all", {
      headers: { Authorization: "Bearer " + token }
    }),
    fetch("http://localhost:5000/api/issues/assigned/mine", {
      headers: { Authorization: "Bearer " + token }
    })
  ]);

  const allData = await allRes.json();
  const assignedData = await assignedRes.json();

  if (!allRes.ok) throw new Error(allData.message || "Unable to retrieve issues. Please refresh the page or try again later.");
  if (!assignedRes.ok) throw new Error(assignedData.message || "Unable to retrieve assigned issues. Please refresh the page or try again later.");

  staffAllIssues = allData.issues || [];
  staffAssignedIssues = assignedData.issues || [];

  renderStaffIssues();
}

function renderStaffIssues() {
  const tbody = document.querySelector("#staffIssuesBody");
  tbody.innerHTML = "";

  const source = currentStaffView === "all" ? staffAllIssues : staffAssignedIssues;

  source.forEach(issue => {
    const created = new Date(issue.createdAt).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric"
    });

    const citizenName = issue.citizen ? issue.citizen.name : "-";

    const imageCell = issue.image
      ? `<a href="http://localhost:5000${issue.image}" target="_blank" title="View full image"><img src="http://localhost:5000${issue.image}" alt="Issue" style="width: 60px; height: 40px; object-fit: cover; border-radius: 4px;"></a>`
      : "-";

    const statusOptions = ["Open", "In Progress", "Resolved"]
      .map(s => `<option value="${s}" ${issue.status === s ? "selected" : ""}>${s}</option>`)
      .join("");

    const tr = document.createElement("tr");
    tr.setAttribute("data-id", issue._id); // Add data-id to the row
    tr.innerHTML = `
      <td>${issue._id.slice(-6)}</td>
      <td>${issue.category}</td>
      <td>${issue.location}</td>
      <td>${issue.priority}</td>
      <td>${citizenName}</td>
      <td>${imageCell}</td>
      <td>
        <select class="form-select status-select" data-id="${issue._id}">
          ${statusOptions}
        </select>
      </td>
      <td>${issue.assignedTo ? "Yes" : "No"}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const staffIssuesBody = document.querySelector("#staffIssuesBody");

  // Event listener for status changes
  staffIssuesBody.addEventListener("change", async (e) => {
    if (e.target.classList.contains("status-select")) {
      const issueId = e.target.dataset.id;
      const newStatus = e.target.value;
      const token = localStorage.getItem("token");
      await updateIssueStatus(token, issueId, newStatus);
    }
  });

  async function updateIssueStatus(token, issueId, status) {
    try {
      const res = await fetch(`http://localhost:5000/api/issues/${issueId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update status.");
      alert(`Issue status updated to "${status}".`);
    } catch (err) {
      console.error("Error updating status:", err);
      alert(err.message);
    } finally {
      // Reload data to ensure UI is consistent
      loadStaffData();
    }
  }

  loadStaffData().catch(err => {
    console.error(err);
    alert(err.message || "A system error occurred while loading data. Please refresh the page or contact support.");
  });

  document.querySelector("#tab-all-issues").addEventListener("click", (e) => {
    e.preventDefault();
    currentStaffView = "all";
    renderStaffIssues();
  });

  document.querySelector("#tab-my-assigned").addEventListener("click", (e) => {
    e.preventDefault();
    currentStaffView = "assigned";
    renderStaffIssues();
  });
});
