import User from "../models/User.js";
import Issue from "../models/Issue.js";

// GET /api/admin/summary
export const getSummary = async (req, res, next) => {
  const [totalUsers, citizenCount, staffCount, adminCount] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: "citizen" }),
    User.countDocuments({ role: "staff" }),
    User.countDocuments({ role: "admin" })
  ]);

  const [totalIssues, openCount, progressCount, resolvedCount] = await Promise.all([
    Issue.countDocuments(),
    Issue.countDocuments({ status: "Open" }),
    Issue.countDocuments({ status: "In Progress" }),
    Issue.countDocuments({ status: "Resolved" })
  ]);

  const users = {
    total: totalUsers,
    citizens: citizenCount,
    staff: staffCount,
    admins: adminCount
  };

  const issues = {
    total: totalIssues,
    open: openCount,
    inProgress: progressCount,
    resolved: resolvedCount
  };

  res.json({
    success: true,
    message: "Summary fetched successfully",
    data: { users, issues },
    users,
    issues
  });
};

// GET /api/admin/users
export const getUsers = async (req, res, next) => {
  const users = await User.find({}, "name email role status createdAt")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    message: "Users fetched successfully",
    data: { users },
    users
  });
};

// GET /api/admin/staff
export const getStaff = async (req, res, next) => {
  const staff = await User.find({ role: "staff" }, "name email");
  res.json({
    success: true,
    message: "Staff fetched successfully",
    data: { staff },
    staff
  });
};

// PATCH /api/admin/users/:userId/status
export const updateUserStatus = async (req, res, next) => {
  const { userId } = req.params;
  const { status } = req.body;

  const allowed = ["active", "blocked", "terminated"];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status provided." });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  // Prevent changing other admins
  if (user.role === "admin") {
    return res.status(403).json({ success: false, message: "Cannot change status of admin accounts." });
  }

  user.status = status;
  await user.save();

  res.json({ success: true, message: `User status updated to ${status}.`, user });
};
