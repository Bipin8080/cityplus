import express from "express";
import { protect, optionalProtect } from "../middleware/authMiddleware.js";
import multer from "multer";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";
import {
  createIssue,
  getPublicIssues,
  getMyIssues,
  getAllIssues,
  getMyAssignedIssues,
  updateStatus,
  assignIssue,
  getIssueById,
  addFeedback,
  deleteIssue,
  restoreIssue,
  exportIssues,
  requestIssueReject,
  rejectIssue,
} from "../controllers/issueController.js";

const router = express.Router();

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};

// Multer setup with Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "cityplus_issues",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const upload = multer({ storage: storage });

// Public Routes
router.get("/", asyncHandler(getPublicIssues));

// Anonymous or logged-in citizens can submit issues
router.post("/", optionalProtect, upload.single("image"), asyncHandler(createIssue));

// All routes below require authentication
router.use(protect);

// Citizen
router.get("/my", requireRole("citizen"), asyncHandler(getMyIssues));

// Staff/Admin: all issues (with pagination & filtering)
router.get("/all", asyncHandler(getAllIssues));

// Admin: export issues as CSV
router.get("/export", requireRole("admin"), asyncHandler(exportIssues));

// Staff: my assigned issues
router.get("/assigned/mine", requireRole("staff"), asyncHandler(getMyAssignedIssues));

// Staff/Admin: change status
router.patch("/:id/status", requireRole("staff", "admin"), upload.single("image"), asyncHandler(updateStatus));
router.post("/:id/reject-request", requireRole("staff"), asyncHandler(requestIssueReject));

// Admin: assign staff to issue
router.patch("/:id/assign", requireRole("admin"), asyncHandler(assignIssue));
router.patch("/:id/reject", requireRole("admin"), asyncHandler(rejectIssue));

// Admin: soft delete / restore
router.delete("/:id", requireRole("admin"), asyncHandler(deleteIssue));
router.patch("/:id/restore", requireRole("admin"), asyncHandler(restoreIssue));

// Get single issue
router.get("/:id", asyncHandler(getIssueById));

// Citizen: Add feedback
router.post("/:id/feedback", requireRole("citizen"), asyncHandler(addFeedback));

export default router;
