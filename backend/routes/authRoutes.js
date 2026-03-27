import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import {
  registerCitizen,
  registerStaff,
  registerAdmin,
  resendRegistrationOTP,
  verifyRegistrationOTP,
  login,
  changePassword,
  sendChangePasswordOTP,
  forgotPassword,
  verifyOTP,
  resetPassword,
  completeStaffSetup,
  updateEmailNotificationPreference,
  resendStaffSetupLink
} from "../controllers/authController.js";

const router = express.Router();

// ──── Public Routes ─────────────────────────────────────────────────────

// Citizen Registration (open to everyone)
router.post("/register", asyncHandler(registerCitizen));
router.post("/register/verify-otp", asyncHandler(verifyRegistrationOTP));
router.post("/register/resend-otp", asyncHandler(resendRegistrationOTP));

// Login (all roles)
router.post("/login", asyncHandler(login));

// Forgot Password Flow (public, rate-limited by parent middleware)
router.post("/forgot-password", asyncHandler(forgotPassword));
router.post("/verify-otp", asyncHandler(verifyOTP));
router.post("/reset-password", asyncHandler(resetPassword));
router.post("/complete-staff-setup", asyncHandler(completeStaffSetup));
router.patch("/email-notifications", protect, asyncHandler(updateEmailNotificationPreference));

// ──── Protected Routes ──────────────────────────────────────────────────

// Change Password (requires login)
router.post("/send-change-password-otp", protect, asyncHandler(sendChangePasswordOTP));
router.post("/change-password", protect, asyncHandler(changePassword));

// Staff Registration (admin only)
router.post("/register-staff", protect, (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required to register staff" });
  }
  next();
}, asyncHandler(registerStaff));

// Resend Staff Setup Link (admin only)
router.post("/staff/:staffId/resend-setup", protect, (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}, asyncHandler(resendStaffSetupLink));

// Admin Registration (admin only)
router.post("/register-admin", protect, (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required to register admins" });
  }
  next();
}, asyncHandler(registerAdmin));

export default router;
