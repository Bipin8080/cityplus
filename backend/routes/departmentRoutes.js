import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import {
  createDepartment,
  getDepartments,
  updateDepartment,
  deleteDepartment,
} from "../controllers/departmentController.js";

const router = express.Router();

// Publicly available so dropdowns can be populated before login if needed, 
// but typically protected. We will just protect write actions.
router.get("/", asyncHandler(getDepartments));

// Protect all other routes
router.use(protect);

// Admin only middleware
router.use((req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access only" });
  }
  next();
});

router.post("/", asyncHandler(createDepartment));
router.put("/:id", asyncHandler(updateDepartment));
router.delete("/:id", asyncHandler(deleteDepartment));

export default router;
