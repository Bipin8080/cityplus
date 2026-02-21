// backend/routes/adminRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import {
  getSummary,
  getUsers,
  getStaff,
  updateUserStatus
} from "../controllers/adminController.js";

const router = express.Router();

// all admin routes require login
router.use(protect);

// extra guard: only admins allowed
router.use((req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access only" });
  }
  next();
});

// GET /api/admin/summary  -> counts for dashboard cards
router.get("/summary", asyncHandler(getSummary));

// GET /api/admin/users  -> list all users (for table)
router.get("/users", asyncHandler(getUsers));

// GET /api/admin/staff  -> list staff to populate dropdowns
router.get("/staff", asyncHandler(getStaff));

// PATCH /api/admin/users/:userId/status  -> update a user's status (active/blocked/terminated)
router.patch("/users/:userId/status", asyncHandler(updateUserStatus));

export default router;
