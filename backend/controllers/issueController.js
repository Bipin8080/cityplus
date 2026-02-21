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

  // Get the path for the uploaded image, if it exists
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

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
  }
  // Citizens see issues but without citizen and assigned staff details

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

  const { status } = req.body;
  const allowed = ["Open", "In Progress", "Resolved"];

  if (!allowed.includes(status)) {
    const error = new Error("Invalid status");
    error.statusCode = 400;
    return next(error);
  }

  // Prepare the update object
  const updateData = { status };

  // If status is 'Resolved', set the resolution timestamp.
  // If it's being changed away from 'Resolved', clear the timestamp.
  if (status === "Resolved") {
    updateData.resolvedAt = new Date();
  } else {
    updateData.resolvedAt = null;
  }

  const issue = await Issue.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true }
  );

  if (!issue) {
    const error = new Error("Issue not found");
    error.statusCode = 404;
    return next(error);
  }

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
