import Issue from "../models/Issue.js";
import User from "../models/User.js";

// Citizen: create issue
export const createIssue = async (req, res, next) => {
  const { title, category, ward, location, priority, description, lat, lng } = req.body;

  if (!title || !category || !ward || !location || !priority || !description) {
    const error = new Error("All fields are required");
    error.statusCode = 400;
    return next(error);
  }
  // Get the Cloudinary URL for the uploaded image, if it exists
  const imageUrl = req.file ? req.file.path : null;

  const issue = await Issue.create({
    title,
    category,
    ward,
    location,
    priority,
    description,
    citizen: req.user.id,
    lat,
    lng,
    image: imageUrl, // Save the image URL to the database
  });

  res.status(201).json({
    success: true,
    message: "Issue created",
    data: { issue },
    issue
  });
};

// Citizen: my issues
export const getMyIssues = async (req, res, next) => {
  const issues = await Issue.find({ citizen: req.user.id })
    .populate("assignedTo", "name")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    message: "Issues fetched successfully",
    data: { issues },
    issues
  });
};

// Public: get issues for landing page
export const getPublicIssues = async (req, res, next) => {
  // Fetch recent issues for the public homepage, without sensitive data.
  const issues = await Issue.find()
    .sort({ createdAt: -1 })
    .limit(50); // Limit the number of issues shown on the public page

  res.json({
    success: true,
    message: "Public issues fetched successfully",
    data: { issues },
    issues,
  });
};

// Staff/Admin/Citizen: all issues (requires authentication)
// Staff/Admin see full details including citizen and assigned staff info
// Citizens see all issues but without citizen names and assigned staff info
export const getAllIssues = async (req, res, next) => {
  if (req.user.role !== "staff" && req.user.role !== "admin" && req.user.role !== "citizen") {
    const error = new Error("Access denied");
    error.statusCode = 403;
    return next(error);
  }

  let query = Issue.find().sort({ createdAt: -1 });

  // Staff and admin see full details with citizen and assigned staff info
  if (req.user.role === "staff" || req.user.role === "admin") {
    query = query.populate("citizen", "name email").populate("assignedTo", "name email");
  } else {
    // Citizens see issues with assigned staff name
    query = query.populate("assignedTo", "name");
  }

  const issues = await query;

  res.json({
    success: true,
    message: "Issues fetched successfully",
    data: { issues },
    issues
  });
};

// Staff: my assigned issues
export const getMyAssignedIssues = async (req, res, next) => {
  if (req.user.role !== "staff") {
    const error = new Error("Staff only");
    error.statusCode = 403;
    return next(error);
  }

  const issues = await Issue.find({ assignedTo: req.user.id })
    .populate("citizen", "name email")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    message: "Issues fetched successfully",
    data: { issues },
    issues
  });
};

// Staff/Admin: change status
export const updateStatus = async (req, res, next) => {
  if (req.user.role !== "staff" && req.user.role !== "admin") {
    const error = new Error("Access denied");
    error.statusCode = 403;
    return next(error);
  }

  const { status, note } = req.body;
  const allowed = ["Open", "In Progress", "Resolved"];

  if (!allowed.includes(status)) {
    const error = new Error("Invalid status");
    error.statusCode = 400;
    return next(error);
  }

  const existingIssue = await Issue.findById(req.params.id);
  if (!existingIssue) {
    const error = new Error("Issue not found");
    error.statusCode = 404;
    return next(error);
  }

  if (existingIssue.status === "Resolved") {
    const error = new Error("Cannot change status of a resolved issue.");
    error.statusCode = 400;
    return next(error);
  }

  // Enforce strict linear progression
  if (existingIssue.status === "Open" && status !== "In Progress") {
    const error = new Error("An Open issue can only be changed to In Progress.");
    error.statusCode = 400;
    return next(error);
  }

  if (existingIssue.status === "In Progress" && status !== "Resolved") {
    const error = new Error("An In Progress issue can only be changed to Resolved.");
    error.statusCode = 400;
    return next(error);
  }

  // Require image for changing to In Progress or Resolved
  if (status === "In Progress" || status === "Resolved") {
    if (!req.file) {
      const error = new Error(`An image proof is required to change status to ${status}.`);
      error.statusCode = 400;
      return next(error);
    }
  }

  const imageUrl = req.file ? req.file.path : null;

  // Prepare the update object
  const updateData = { status };

  if (status === "In Progress") {
    updateData.inProgressAt = new Date();
    updateData.inProgressImage = imageUrl;
    updateData.inProgressNote = note || null;
  } else if (status === "Resolved") {
    updateData.resolvedAt = new Date();
    updateData.resolvedImage = imageUrl;
    updateData.resolvedNote = note || null;
  }

  // NOTE: Open status does not overwrite anything, it's the initial state. 

  const issue = await Issue.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true }
  );

  res.json({
    success: true,
    message: "Status updated",
    data: { issue },
    issue
  });
};

// Admin: assign staff to issue
export const assignIssue = async (req, res, next) => {
  if (req.user.role !== "admin") {
    const error = new Error("Admin only");
    error.statusCode = 403;
    return next(error);
  }

  const { staffId } = req.body;

  if (!staffId) {
    const error = new Error("staffId required");
    error.statusCode = 400;
    return next(error);
  }

  const staff = await User.findOne({ _id: staffId, role: "staff" });
  if (!staff) {
    const error = new Error("Staff user not found");
    error.statusCode = 404;
    return next(error);
  }

  const issue = await Issue.findByIdAndUpdate(
    req.params.id,
    { assignedTo: staffId },
    { new: true }
  ).populate("assignedTo", "name email");

  if (!issue) {
    const error = new Error("Issue not found");
    error.statusCode = 404;
    return next(error);
  }

  res.json({
    success: true,
    message: "Issue assigned successfully",
    data: { issue },
    issue
  });
};

// Get single issue
export const getIssueById = async (req, res, next) => {
  const issue = await Issue.findById(req.params.id)
    .populate("citizen", "name email")
    .populate("assignedTo", "name email");

  if (!issue) {
    const error = new Error("Issue not found");
    error.statusCode = 404;
    return next(error);
  }

  res.json({
    success: true,
    message: "Issue fetched successfully",
    data: { issue },
    issue
  });
};

// Citizen: Add feedback to a resolved issue
export const addFeedback = async (req, res, next) => {
  const { rating, text } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    const error = new Error("Valid rating (1-5) is required");
    error.statusCode = 400;
    return next(error);
  }

  const issue = await Issue.findById(req.params.id);

  if (!issue) {
    const error = new Error("Issue not found");
    error.statusCode = 404;
    return next(error);
  }

  // Ensure issuer is the citizen who reported it
  if (issue.citizen.toString() !== req.user.id) {
    const error = new Error("Not authorized to leave feedback on this issue");
    error.statusCode = 403;
    return next(error);
  }

  if (issue.status !== "Resolved") {
    const error = new Error("Feedback can only be left on resolved issues");
    error.statusCode = 400;
    return next(error);
  }

  if (issue.feedback && issue.feedback.rating) {
    const error = new Error("Feedback has already been submitted for this issue");
    error.statusCode = 400;
    return next(error);
  }

  issue.feedback = {
    rating,
    text,
    submittedAt: new Date()
  };

  await issue.save();

  res.json({
    success: true,
    message: "Feedback submitted successfully",
    data: { issue },
    issue
  });
};

