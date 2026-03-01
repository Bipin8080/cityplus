import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { emitToUser } from "../config/socket.js";
import { sendEmail } from "../config/email.js";
import { notificationTemplate } from "../utils/emailTemplates.js";

// ─── Helper: create a notification ───────────────────────────────────
// Called internally by other controllers to generate notifications.
// Creates in-app notification, emits via Socket.IO, and sends email.
export const createNotification = async (recipientId, type, title, message, issueId = null) => {
    try {
        const notification = await Notification.create({ recipient: recipientId, type, title, message, issueId });

        // Emit real-time event via Socket.IO
        emitToUser(recipientId.toString(), "new_notification", {
            notification: notification.toObject()
        });

        // Send email notification (async, non-blocking)
        sendEmailToUser(recipientId, title, message).catch(() => { });
    } catch (err) {
        // Log but don't throw — notifications should never break the main flow
        console.error("Failed to create notification:", err.message);
    }
};

// Helper: send email to a user by their ID
async function sendEmailToUser(userId, title, message) {
    try {
        const user = await User.findById(userId, "email name");
        if (user && user.email) {
            const html = notificationTemplate(title, message);
            await sendEmail(user.email, `CityPlus: ${title}`, html);
        }
    } catch (err) {
        console.error("Failed to send email notification:", err.message);
    }
}

// Helper: notify all admins
export const notifyAllAdmins = async (type, title, message, issueId = null) => {
    try {
        const admins = await User.find({ role: "admin", status: "active" }, "_id");
        const promises = admins.map((admin) =>
            createNotification(admin._id, type, title, message, issueId)
        );
        await Promise.all(promises);
    } catch (err) {
        console.error("Failed to notify admins:", err.message);
    }
};

// ─── GET /api/notifications ──────────────────────────────────────────
// Returns the latest 50 notifications for the authenticated user.
export const getNotifications = async (req, res, next) => {
    const notifications = await Notification.find({ recipient: req.user.id })
        .sort({ createdAt: -1 })
        .limit(50);

    res.json({
        success: true,
        message: "Notifications fetched successfully",
        notifications
    });
};

// ─── GET /api/notifications/unread-count ─────────────────────────────
// Returns the number of unread notifications for the badge counter.
export const getUnreadCount = async (req, res, next) => {
    const count = await Notification.countDocuments({
        recipient: req.user.id,
        read: false
    });

    res.json({ success: true, count });
};

// ─── PATCH /api/notifications/:id/read ───────────────────────────────
// Mark a single notification as read.
export const markAsRead = async (req, res, next) => {
    const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, recipient: req.user.id },
        { read: true },
        { new: true }
    );

    if (!notification) {
        const error = new Error("Notification not found");
        error.statusCode = 404;
        return next(error);
    }

    res.json({ success: true, message: "Notification marked as read", notification });
};

// ─── PATCH /api/notifications/read-all ───────────────────────────────
// Mark all notifications as read for the authenticated user.
export const markAllAsRead = async (req, res, next) => {
    await Notification.updateMany(
        { recipient: req.user.id, read: false },
        { read: true }
    );

    res.json({ success: true, message: "All notifications marked as read" });
};
