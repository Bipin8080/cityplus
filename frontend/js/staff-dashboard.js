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

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${issue._id.slice(-6)}</td>
      <td>${issue.category}</td>
      <td>${issue.location}</td>
      <td>${issue.priority}</td>
      <td>${citizenName}</td>
      <td>${issue.status}</td>
      <td>${issue.assignedTo ? "Yes" : "No"}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.addEventListener("DOMContentLoaded", () => {
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
