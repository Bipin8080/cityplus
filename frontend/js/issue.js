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

  // If user is not a logged-in citizen, show a modal prompting them to log in.
  if (!isLoggedIn) {
    if (typeof openLoginModal === "function") {
      openLoginModal();
    } else {
      // Fallback in case the modal function isn't available
      alert("Please log in as a citizen to report an issue. This helps prevent spam and allows you to track your report's status.");
      window.location.href = "login.html";
    }
    return;
  }

  try {
    // Use FormData to send both text and file data
    const formData = new FormData(form);

    const headers = {
      // Token is guaranteed to be present due to the check above
      Authorization: "Bearer " + token,
    };

    const res = await fetch("http://localhost:5000/api/issues", {
      method: "POST",
      headers: headers,
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Unable to submit your report. Please check the details and try again.");
      return;
    }

    alert("Your report has been successfully submitted. You will now be redirected to your dashboard to track its status.");

    // Since only logged-in citizens can submit, always redirect to their dashboard.
    window.location.href = "citizen-dashboard.html";
  } catch (err) {
    console.error(err);
    alert("A system error occurred while submitting your report. Please try again later.");
  }
}
