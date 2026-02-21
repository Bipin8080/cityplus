// backend/routes/authRoutes.js
import express from "express";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import {
  registerCitizen,
  registerStaff,
  registerAdmin,
  login
} from "../controllers/authController.js";

const router = express.Router();

// -------- Citizen Registration --------
router.post("/register", asyncHandler(registerCitizen));

// -------- Staff Registration (for project) --------
router.post("/register-staff", asyncHandler(registerStaff));

// -------- Login (all roles) --------
router.post("/login", asyncHandler(login));

// -------- Admin Registration (for project) --------
router.post("/register-admin", asyncHandler(registerAdmin));

export default router;
