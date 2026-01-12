async function submitIssue(event) {
  event.preventDefault();

  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token || role !== "citizen") {
    alert("Authentication required. Please log in with a citizen account to report an issue.");
    window.location.href = "login.html";
    return;
  }

  const title = document.querySelector("#title").value.trim();
  const category = document.querySelector("#category").value.trim();
  const ward = document.querySelector("#ward").value.trim();
  const location = document.querySelector("#location").value.trim();
  const priorityRaw = document.querySelector("#priority").value;
  const description = document.querySelector("#description").value.trim();

  let priority = "Medium";
  if (priorityRaw.includes("High")) priority = "High";
  if (priorityRaw.includes("Low")) priority = "Low";

  if (!title || !category || !ward || !location || !description) {
    alert("Please complete all required fields before submitting your complaint.");
    return;
  }

  try {
    const res = await fetch("http://localhost:5000/api/issues", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({
        title,
        category,
        ward,
        location,
        priority,
        description
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Unable to submit complaint. Please verify all information and try again.");
      return;
    }

    alert("Your complaint has been successfully submitted. You will receive updates on its status.");
    window.location.href = "citizen-dashboard.html";
  } catch (err) {
    console.error(err);
    alert("A system error occurred while submitting your complaint. Please try again later.");
  }
}
