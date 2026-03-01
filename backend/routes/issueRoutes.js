import express from "express";
import { protect } from "../middleware/authMiddleware.js";
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
} from "../controllers/issueController.js";

const router = express.Router();

// Multer setup with Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "cityplus_issues",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const upload = multer({ storage: storage });

// ──── Public Routes ─────────────────────────────────────────────────────
router.get("/", asyncHandler(getPublicIssues));

// All routes below require authentication
router.use(protect);

// ──── Citizen ───────────────────────────────────────────────────────────
router.post("/", upload.single("image"), asyncHandler(createIssue));
router.get("/my", asyncHandler(getMyIssues));

// ──── Staff/Admin: all issues (with pagination & filtering) ─────────────
router.get("/all", asyncHandler(getAllIssues));

// ──── Admin: export issues as CSV ───────────────────────────────────────
router.get("/export", asyncHandler(exportIssues));

// ──── Staff: my assigned issues ─────────────────────────────────────────
router.get("/assigned/mine", asyncHandler(getMyAssignedIssues));

// ──── Staff/Admin: change status ────────────────────────────────────────
router.patch("/:id/status", upload.single("image"), asyncHandler(updateStatus));

// ──── Admin: assign staff to issue ──────────────────────────────────────
router.patch("/:id/assign", asyncHandler(assignIssue));

// ──── Admin: soft delete / restore ──────────────────────────────────────
router.delete("/:id", asyncHandler(deleteIssue));
router.patch("/:id/restore", asyncHandler(restoreIssue));

// ──── Get single issue ──────────────────────────────────────────────────
router.get("/:id", asyncHandler(getIssueById));

// ──── Citizen: Add feedback ─────────────────────────────────────────────
router.post("/:id/feedback", asyncHandler(addFeedback));

export default router;
