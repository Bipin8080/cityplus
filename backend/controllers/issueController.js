import Issue from "../models/Issue.js";
import User from "../models/User.js";
import Department from "../models/Department.js";
import { createNotification, notifyAllAdmins } from "./notificationController.js";

// ──── Citizen: create issue ──────────────────────────────────────────────
export const createIssue = async (req, res, next) => {
  const { title, category, ward, location, priority, description, lat, lng } = req.body;

  if (!title || !category || !ward || !location || !priority || !description) {
    const error = new Error("All fields are required");
    error.statusCode = 400;
    return next(error);
  }
  if (!req.file) {
    const error = new Error("An image is required. Please upload a photo of the issue.");
    error.statusCode = 400;
    return next(error);
  }
  const imageUrl = req.file.path;

  // Resolve Department using Category
  const departmentDoc = await Department.findOne({ supportedCategories: category, deleted: false });
  const departmentId = departmentDoc ? departmentDoc._id : null;

  // Automated Assignment Logic
  let assignedStaffId = null;
  if (departmentId) {
    const staffMembers = await User.find({ role: "staff", department: departmentId, status: "active" });
    if (staffMembers.length > 0) {
      const workloads = await Promise.all(staffMembers.map(async (staff) => {
        const count = await Issue.countDocuments({
          assignedTo: staff._id,
          status: { $in: ["Pending", "In Progress"] },
          deleted: { $ne: true }
        });
        return { id: staff._id, count };
      }));
      workloads.sort((a, b) => a.count - b.count);
      assignedStaffId = workloads[0].id;
    }
  }

  const issue = await Issue.create({
    title,
    category,
    ward,
    location,
    priority,
    description,
    citizen: req.user.id,
    department: departmentId,
    assignedTo: assignedStaffId,
    lat,
    lng,
    image: imageUrl,
  });

  if (assignedStaffId) {
    createNotification(
      assignedStaffId,
      "issue_assigned",
      "New Issue Assigned",
      `An issue in your department has been automatically assigned to you: "${issue.title}"`,
      issue._id
    );
  }

  // Notify all admins about the new issue
  notifyAllAdmins(
    "issue_created",
    "New Issue Reported",
    `New issue reported: "${issue.title}" in Ward ${issue.ward}`,
    issue._id
  );

  res.status(201).json({
    success: true,
    message: "Issue created",
    data: { issue },
    issue
  });
};

// ──── Citizen: my issues ─────────────────────────────────────────────────
export const getMyIssues = async (req, res, next) => {
  const issues = await Issue.find({ citizen: req.user.id, deleted: { $ne: true } })
    .populate("assignedTo", "name")
    .populate("department", "name")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    message: "Issues fetched successfully",
    data: { issues },
    issues
  });
};

// ──── Public: get issues for landing page ────────────────────────────────
export const getPublicIssues = async (req, res, next) => {
  const issues = await Issue.find({ deleted: { $ne: true } })
    .populate("department", "name")
    .sort({ createdAt: -1 })
    .limit(50);

  res.json({
    success: true,
    message: "Public issues fetched successfully",
    data: { issues },
    issues,
  });
};

// ──── Staff/Admin/Citizen: all issues with pagination & filtering ────────
// Query params: ?page=1&limit=10&status=Pending&ward=5&category=Roads&search=pothole
export const getAllIssues = async (req, res, next) => {
  if (req.user.role !== "staff" && req.user.role !== "admin" && req.user.role !== "citizen") {
    const error = new Error("Access denied");
    error.statusCode = 403;
    return next(error);
  }

  // Build filter object
  const filter = { deleted: { $ne: true } };

  if (req.query.status && req.query.status !== "all") {
    filter.status = req.query.status;
  }
  if (req.query.ward) {
    filter.ward = req.query.ward;
  }
  if (req.query.category) {
    filter.category = req.query.category;
  }
  if (req.query.priority) {
    filter.priority = req.query.priority;
  }
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, "i");
    filter.$or = [
      { title: searchRegex },
      { description: searchRegex },
      { location: searchRegex }
    ];
  }

  // Pagination
  const page = Math.max(1, parseInt(req.query.page) || 1);
  let limit = 0; // Default to 0 (no pagination) if not provided
  if (req.query.limit !== undefined) {
    const parsedLimit = parseInt(req.query.limit);
    if (!isNaN(parsedLimit)) {
      limit = Math.min(100, Math.max(0, parsedLimit));
    }
  }
  // limit=0 means no pagination (return all) — for backward compatibility
  const skip = limit > 0 ? (page - 1) * limit : 0;

  // Count total matching documents
  const total = await Issue.countDocuments(filter);

  // Build query
  let query = Issue.find(filter).sort({ createdAt: -1 });

  if (limit > 0) {
    query = query.skip(skip).limit(limit);
  }

  // Populate based on role
  if (req.user.role === "staff" || req.user.role === "admin") {
    query = query.populate("citizen", "name email").populate("assignedTo", "name email").populate("department", "name");
  } else {
    query = query.populate("assignedTo", "name").populate("department", "name");
  }

  const issues = await query;

  res.json({
    success: true,
    message: "Issues fetched successfully",
    data: { issues },
    issues,
    pagination: {
      total,
      page,
      limit: limit || total,
      pages: limit > 0 ? Math.ceil(total / limit) : 1
    }
  });
};

// ──── Staff: my assigned issues ──────────────────────────────────────────
export const getMyAssignedIssues = async (req, res, next) => {
  if (req.user.role !== "staff") {
    const error = new Error("Staff only");
    error.statusCode = 403;
    return next(error);
  }

  const issues = await Issue.find({ assignedTo: req.user.id, deleted: { $ne: true } })
    .populate("citizen", "name email")
    .populate("department", "name")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    message: "Issues fetched successfully",
    data: { issues },
    issues
  });
};

// ──── Staff/Admin: change status ─────────────────────────────────────────
export const updateStatus = async (req, res, next) => {
  if (req.user.role !== "staff" && req.user.role !== "admin") {
    const error = new Error("Access denied");
    error.statusCode = 403;
    return next(error);
  }

  const { status, note } = req.body;
  const allowed = ["Pending", "In Progress", "Resolved"];

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

  if (existingIssue.status === status) {
    const error = new Error("Issue is already in this status.");
    error.statusCode = 400;
    return next(error);
  }

  // Require image for forward transitions
  if (status === "In Progress" || status === "Resolved") {
    if (!req.file) {
      const error = new Error(`An image proof is required to change status to ${status}.`);
      error.statusCode = 400;
      return next(error);
    }
  }

  const imageUrl = req.file ? req.file.path : null;

  const updateData = { status };

  if (status === "In Progress") {
    updateData.inProgressAt = new Date();
    updateData.inProgressImage = imageUrl;
    updateData.inProgressNote = note || null;
  } else if (status === "Resolved") {
    updateData.resolvedAt = new Date();
    updateData.resolvedImage = imageUrl;
    updateData.resolvedNote = note || null;
  } else if (status === "Pending") {
    updateData.inProgressAt = null;
    updateData.inProgressImage = null;
    updateData.inProgressNote = null;
    updateData.resolvedAt = null;
    updateData.resolvedImage = null;
    updateData.resolvedNote = null;
  }

  const issue = await Issue.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true }
  );

  // Notify the citizen
  if (existingIssue.citizen) {
    createNotification(
      existingIssue.citizen,
      "status_updated",
      `Issue ${status}`,
      `Your issue "${existingIssue.title}" is now ${status}`,
      issue._id
    );
  }

  res.json({
    success: true,
    message: "Status updated",
    data: { issue },
    issue
  });
};

// ──── Admin: assign staff to issue ───────────────────────────────────────
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

  const existingIssue = await Issue.findById(req.params.id);
  const previousStaffId = existingIssue ? existingIssue.assignedTo : null;
  const isReassignment = previousStaffId && previousStaffId.toString() !== staffId;

  const issue = await Issue.findByIdAndUpdate(
    req.params.id,
    { assignedTo: staffId },
    { new: true }
  ).populate("assignedTo", "name email")
   .populate("department", "name");

  if (!issue) {
    const error = new Error("Issue not found");
    error.statusCode = 404;
    return next(error);
  }

  const notifType = isReassignment ? "issue_reassigned" : "issue_assigned";
  createNotification(
    staffId,
    notifType,
    isReassignment ? "Issue Re-assigned to You" : "New Issue Assigned",
    `You have been assigned issue: "${issue.title}"`,
    issue._id
  );

  if (issue.citizen) {
    createNotification(
      issue.citizen,
      notifType,
      isReassignment ? "Issue Re-assigned" : "Issue Assigned",
      `Your issue "${issue.title}" has been ${isReassignment ? "re-assigned" : "assigned"} to a staff member`,
      issue._id
    );
  }

  if (isReassignment && previousStaffId) {
    createNotification(
      previousStaffId,
      "issue_reassigned",
      "Issue Re-assigned Away",
      `Issue "${issue.title}" has been re-assigned to another staff member`,
      issue._id
    );
  }

  res.json({
    success: true,
    message: "Issue assigned successfully",
    data: { issue },
    issue
  });
};

// ──── Get single issue ───────────────────────────────────────────────────
export const getIssueById = async (req, res, next) => {
  const issue = await Issue.findById(req.params.id)
    .populate("citizen", "name email")
    .populate("assignedTo", "name email")
    .populate("department", "name");

  if (!issue || issue.deleted) {
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

// ──── Citizen: Add feedback ──────────────────────────────────────────────
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

  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
  if (issue.assignedTo) {
    createNotification(
      issue.assignedTo,
      "feedback_received",
      "Feedback Received",
      `Citizen rated your resolved issue "${issue.title}" ${stars}`,
      issue._id
    );
  }

  notifyAllAdmins(
    "feedback_received",
    "Feedback Received",
    `Citizen rated resolved issue "${issue.title}" ${stars}`,
    issue._id
  );

  res.json({
    success: true,
    message: "Feedback submitted successfully",
    data: { issue },
    issue
  });
};

// ──── Admin: soft delete issue ───────────────────────────────────────────
export const deleteIssue = async (req, res, next) => {
  if (req.user.role !== "admin") {
    const error = new Error("Admin only");
    error.statusCode = 403;
    return next(error);
  }

  const issue = await Issue.findById(req.params.id);
  if (!issue) {
    const error = new Error("Issue not found");
    error.statusCode = 404;
    return next(error);
  }

  if (issue.deleted) {
    const error = new Error("Issue is already deleted");
    error.statusCode = 400;
    return next(error);
  }

  issue.deleted = true;
  await issue.save();

  res.json({
    success: true,
    message: "Issue deleted successfully"
  });
};

// ──── Admin: restore soft-deleted issue ──────────────────────────────────
export const restoreIssue = async (req, res, next) => {
  if (req.user.role !== "admin") {
    const error = new Error("Admin only");
    error.statusCode = 403;
    return next(error);
  }

  const issue = await Issue.findById(req.params.id);
  if (!issue) {
    const error = new Error("Issue not found");
    error.statusCode = 404;
    return next(error);
  }

  if (!issue.deleted) {
    const error = new Error("Issue is not deleted");
    error.statusCode = 400;
    return next(error);
  }

  issue.deleted = false;
  await issue.save();

  res.json({
    success: true,
    message: "Issue restored successfully"
  });
};

// ──── Admin: export issues as CSV ────────────────────────────────────────
export const exportIssues = async (req, res, next) => {
  if (req.user.role !== "admin") {
    const error = new Error("Admin only");
    error.statusCode = 403;
    return next(error);
  }

  // Build same filter as getAllIssues
  const filter = { deleted: { $ne: true } };
  if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
  if (req.query.ward) filter.ward = req.query.ward;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.priority) filter.priority = req.query.priority;

  const issues = await Issue.find(filter)
    .populate("citizen", "name email")
    .populate("assignedTo", "name email")
    .populate("department", "name")
    .sort({ createdAt: -1 });

  // CSV header
  const headers = [
    "ID", "Title", "Category", "Ward", "Location", "Priority",
    "Status", "Reported By", "Assigned To", "Created At", "Resolved At", "Rating"
  ];

  const rows = issues.map(issue => [
    issue._id.toString(),
    `"${(issue.title || "").replace(/"/g, '""')}"`,
    issue.category,
    issue.ward,
    `"${(issue.location || "").replace(/"/g, '""')}"`,
    issue.priority,
    issue.status,
    issue.citizen ? issue.citizen.name : "N/A",
    issue.assignedTo ? issue.assignedTo.name : "Unassigned",
    issue.createdAt ? new Date(issue.createdAt).toLocaleDateString() : "",
    issue.resolvedAt ? new Date(issue.resolvedAt).toLocaleDateString() : "",
    issue.feedback?.rating || ""
  ]);

  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=issues_export_${Date.now()}.csv`);
  res.send(csv);
};
