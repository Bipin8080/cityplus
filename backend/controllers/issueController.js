import Issue from "../models/Issue.js";
import User from "../models/User.js";
import Department from "../models/Department.js";
import { createNotification, notifyAllAdmins } from "./notificationController.js";
import { sendEmail } from "../config/email.js";
import { anonymousIssueSubmissionTemplate } from "../utils/emailTemplates.js";
import { createHttpError, sendSuccess } from "../utils/response.js";
import { assertCanCreateIssue, assertCanViewIssue, getIssuePopulateOptions } from "../utils/issueAccess.js";

// ──── Citizen: create issue ──────────────────────────────────────────────
export const createIssue = async (req, res, next) => {
  assertCanCreateIssue(req.user);
  const { title, category, ward, location, priority, description, lat, lng, email } = req.body;
  const reporterEmail = req.user?.email || (typeof email === "string" ? email.trim() : "");
  const isLoggedInCitizen = !!req.user?.id;

  if (!title || !category || !ward || !location || !priority || !description) {
    return next(createHttpError("All fields are required", 400));
  }
  if (!req.file) {
    return next(createHttpError("An image is required. Please upload a photo of the issue.", 400));
  }

  if (!isLoggedInCitizen) {
    if (!reporterEmail) {
      return next(createHttpError("Email is required to submit an issue without logging in", 400));
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(reporterEmail)) {
      return next(createHttpError("Please enter a valid email address", 400));
    }
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
    citizen: req.user?.id || null,
    reporterEmail: reporterEmail || null,
    department: departmentId,
    assignedTo: assignedStaffId,
    lat,
    lng,
    image: imageUrl,
  });

  let emailSent = false;
  if (reporterEmail) {
    const issueReference = issue._id.toString().slice(-6).toUpperCase();
    const html = anonymousIssueSubmissionTemplate(issue.title, issueReference, issue._id.toString());
    emailSent = await sendEmail(reporterEmail, `CityPlus: Your Issue ID #${issueReference}`, html);
  }

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

  sendSuccess(res, "Issue created", {
    issue,
    issueReference: issue._id.toString().slice(-6).toUpperCase(),
    emailSent
  }, 201);
};

// ──── Citizen: my issues ─────────────────────────────────────────────────
export const getMyIssues = async (req, res, next) => {
  const issues = await Issue.find({ citizen: req.user.id, deleted: { $ne: true } })
    .populate("assignedTo", "name")
    .populate("department", "name")
    .sort({ createdAt: -1 });

  sendSuccess(res, "Issues fetched successfully", { issues });
};

// ──── Public: get issues for landing page ────────────────────────────────
export const getPublicIssues = async (req, res, next) => {
  const issues = await Issue.find({ deleted: { $ne: true } })
    .select("-reporterEmail")
    .populate("department", "name")
    .sort({ createdAt: -1 })
    .limit(50);

  sendSuccess(res, "Public issues fetched successfully", { issues });
};

// ──── Staff/Admin/Citizen: all issues with pagination & filtering ────────
// Query params: ?page=1&limit=10&status=Pending&ward=5&category=Roads&search=pothole
export const getAllIssues = async (req, res, next) => {
  if (req.user.role !== "staff" && req.user.role !== "admin" && req.user.role !== "citizen") {
    return next(createHttpError("Access denied", 403));
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
    query = query.select("-reporterEmail").populate("assignedTo", "name").populate("department", "name");
  }

  const issues = await query;

  sendSuccess(res, "Issues fetched successfully", {
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
  const issues = await Issue.find({ assignedTo: req.user.id, deleted: { $ne: true } })
    .populate("citizen", "name email")
    .populate("department", "name")
    .sort({ createdAt: -1 });

  sendSuccess(res, "Issues fetched successfully", { issues });
};

// ──── Staff/Admin: change status ─────────────────────────────────────────
export const updateStatus = async (req, res, next) => {
  if (req.user.role !== "staff" && req.user.role !== "admin") {
    return next(createHttpError("Access denied", 403));
  }

  const { status, note } = req.body;
  const allowed = ["Pending", "In Progress", "Resolved"];

  if (!allowed.includes(status)) {
    return next(createHttpError("Invalid status", 400));
  }

  const existingIssue = await Issue.findById(req.params.id);
  if (!existingIssue) {
    return next(createHttpError("Issue not found", 404));
  }

  if (existingIssue.status === "Resolved" || existingIssue.status === "Rejected") {
    return next(createHttpError(`Cannot change status of a ${existingIssue.status.toLowerCase()} issue.`, 400));
  }

  if (existingIssue.status === status) {
    return next(createHttpError("Issue is already in this status.", 400));
  }

  // Require image for forward transitions
  if (status === "In Progress" || status === "Resolved") {
    if (!req.file) {
      return next(createHttpError(`An image proof is required to change status to ${status}.`, 400));
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
    updateData.rejectedAt = null;
    updateData.rejectedNote = null;
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

  sendSuccess(res, "Status updated", { issue });
};

// ──── Staff: request admin rejection ────────────────────────────────────
export const requestIssueReject = async (req, res, next) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue || issue.deleted) {
    return next(createHttpError("Issue not found", 404));
  }

  if (issue.status === "Resolved" || issue.status === "Rejected") {
    return next(createHttpError(`Cannot request rejection for a ${issue.status.toLowerCase()} issue.`, 400));
  }

  const { note } = req.body || {};
  const requestText = note && note.trim()
    ? `Reason: ${note.trim()}`
    : "No additional reason provided.";

  await notifyAllAdmins(
    "issue_reject_requested",
    "Issue Rejection Requested",
    `${req.user.name || "A staff member"} requested rejection for issue "${issue.title}". ${requestText}`,
    issue._id
  );

  sendSuccess(res, "Rejection request sent to admins", { issue });
};

// ──── Admin: assign staff to issue ───────────────────────────────────────
export const assignIssue = async (req, res, next) => {
  const { staffId } = req.body;

  if (!staffId) {
    return next(createHttpError("staffId required", 400));
  }

  const staff = await User.findOne({ _id: staffId, role: "staff" });
  if (!staff) {
    return next(createHttpError("Staff user not found", 404));
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
    return next(createHttpError("Issue not found", 404));
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

  sendSuccess(res, "Issue assigned successfully", { issue });
};

// ──── Admin: reject issue ───────────────────────────────────────────────
export const rejectIssue = async (req, res, next) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue || issue.deleted) {
    return next(createHttpError("Issue not found", 404));
  }

  if (issue.status === "Rejected") {
    return next(createHttpError("Issue is already rejected", 400));
  }

  if (issue.status === "Resolved") {
    return next(createHttpError("Cannot reject a resolved issue.", 400));
  }

  const { note } = req.body || {};
  issue.status = "Rejected";
  issue.rejectedAt = new Date();
  issue.rejectedNote = note || null;
  await issue.save();

  const rejectionMessage = `Your issue "${issue.title}" was rejected by an administrator.${note ? ` Reason: ${note}` : ""}`;

  if (issue.citizen) {
    createNotification(
      issue.citizen,
      "issue_rejected",
      "Issue Rejected",
      rejectionMessage,
      issue._id
    );
  }

  if (issue.assignedTo) {
    createNotification(
      issue.assignedTo,
      "issue_rejected",
      "Issue Rejected",
      `Issue "${issue.title}" was rejected by an administrator.${note ? ` Reason: ${note}` : ""}`,
      issue._id
    );
  }

  sendSuccess(res, "Issue rejected successfully", { issue });
};

// ──── Get single issue ───────────────────────────────────────────────────
export const getIssueById = async (req, res, next) => {
  const issue = await Issue.findById(req.params.id);

  if (!issue || issue.deleted) {
    return next(createHttpError("Issue not found", 404));
  }

  assertCanViewIssue(req.user, issue);

  let query = Issue.findById(req.params.id);
  getIssuePopulateOptions(req.user.role).forEach((populateOption) => {
    query = query.populate(populateOption);
  });

  const populatedIssue = await query;
  sendSuccess(res, "Issue fetched successfully", { issue: populatedIssue });
};

// ──── Citizen: Add feedback ──────────────────────────────────────────────
export const addFeedback = async (req, res, next) => {
  const { rating, text } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return next(createHttpError("Valid rating (1-5) is required", 400));
  }

  const issue = await Issue.findById(req.params.id);

  if (!issue) {
    return next(createHttpError("Issue not found", 404));
  }

  if (issue.citizen.toString() !== req.user.id) {
    return next(createHttpError("Not authorized to leave feedback on this issue", 403));
  }

  if (issue.status !== "Resolved") {
    return next(createHttpError("Feedback can only be left on resolved issues", 400));
  }

  if (issue.feedback && issue.feedback.rating) {
    return next(createHttpError("Feedback has already been submitted for this issue", 400));
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

  sendSuccess(res, "Feedback submitted successfully", { issue });
};

// ──── Admin: soft delete issue ───────────────────────────────────────────
export const deleteIssue = async (req, res, next) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue) {
    return next(createHttpError("Issue not found", 404));
  }

  if (issue.deleted) {
    return next(createHttpError("Issue is already deleted", 400));
  }

  issue.deleted = true;
  await issue.save();

  sendSuccess(res, "Issue deleted successfully");
};

// ──── Admin: restore soft-deleted issue ──────────────────────────────────
export const restoreIssue = async (req, res, next) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue) {
    return next(createHttpError("Issue not found", 404));
  }

  if (!issue.deleted) {
    return next(createHttpError("Issue is not deleted", 400));
  }

  issue.deleted = false;
  await issue.save();

  sendSuccess(res, "Issue restored successfully");
};

// ──── Admin: export issues as CSV ────────────────────────────────────────
export const exportIssues = async (req, res, next) => {
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
