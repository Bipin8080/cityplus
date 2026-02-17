async function submitIssue(event) {
  event.preventDefault();

  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const isLoggedIn = token && role === "citizen";

  const form = event.target;
  const title = form.querySelector("#title").value.trim();
  const category = form.querySelector("#category").value.trim();
  const ward = form.querySelector("#ward").value.trim();
  const location = form.querySelector("#location").value.trim();
  const description = form.querySelector("#description").value.trim();

  if (!title || !category || !ward || !location || !description) {
    alert("Please complete all required fields before submitting your complaint.");
    return;
  }

  try {
    // Use FormData to send both text and file data
    const formData = new FormData(form);

    const headers = {};
    if (isLoggedIn) {
      headers.Authorization = "Bearer " + token;
    }

    const res = await fetch("http://localhost:5000/api/issues", {
      method: "POST",
      headers: headers,
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Unable to submit complaint. Please verify all information and try again.");
      return;
    }

    alert("Your complaint has been successfully submitted. You will receive updates on its status.");

    // Redirect based on login status
    if (isLoggedIn) {
      window.location.href = "citizen-dashboard.html";
    } else {
      window.location.href = "index.html";
    }
  } catch (err) {
    console.error(err);
    alert("A system error occurred while submitting your complaint. Please try again later.");
  }
}

