import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import multer from "multer";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import {
  createIssue,
  getPublicIssues,
  getMyIssues,
  getAllIssues,
  getMyAssignedIssues,
  updateStatus,
  assignIssue,
  getIssueById,
} from "../controllers/issueController.js";

const router = express.Router();

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // The 'uploads' directory must exist
  },
  filename: (req, file, cb) => {
    // Create a unique filename to prevent overwrites
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (jpg, jpeg, png, webp)"), false);
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

// ----- Public Routes -----
// These routes are accessible without authentication for the public-facing landing page.

// Provides a list of all issues for the public homepage grid.
router.get("/", asyncHandler(getPublicIssues));

// all issue routes require login
router.use(protect);

// ----- Citizen: create issue -----
router.post("/", upload.single("image"), asyncHandler(createIssue));

// ----- Citizen: my issues (for dashboard, filters done in frontend) -----
router.get("/my", asyncHandler(getMyIssues));

// ----- Staff/Admin: all issues (for dashboards) -----
router.get("/all", asyncHandler(getAllIssues));

// ----- Staff: my assigned issues -----
router.get("/assigned/mine", asyncHandler(getMyAssignedIssues));

// ----- Staff/Admin: change status -----
router.patch("/:id/status", asyncHandler(updateStatus));

// ----- Admin: assign staff to issue -----
router.patch("/:id/assign", asyncHandler(assignIssue));

// ----- Get single issue (for details modal if you want backend fetch) -----
router.get("/:id", asyncHandler(getIssueById));

export default router;
