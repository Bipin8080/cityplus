import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead
} from "../controllers/notificationController.js";

const router = express.Router();

// All notification routes require authentication
router.use(protect);

// GET  /api/notifications            → list latest 50
router.get("/", asyncHandler(getNotifications));

// GET  /api/notifications/unread-count → badge counter
router.get("/unread-count", asyncHandler(getUnreadCount));

// PATCH /api/notifications/read-all   → mark all as read
router.patch("/read-all", asyncHandler(markAllAsRead));

// PATCH /api/notifications/:id/read   → mark one as read
router.patch("/:id/read", asyncHandler(markAsRead));

export default router;
