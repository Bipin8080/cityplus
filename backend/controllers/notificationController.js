import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { emitToUser } from "../config/socket.js";
import { sendEmail } from "../config/email.js";
import { notificationTemplate } from "../utils/emailTemplates.js";

const EMAIL_SUPPRESSION_WINDOW_MS = 5 * 60 * 1000;
const recentEmailNotifications = new Map();

function getEmailSuppressionKey(userId, type, title, message) {
  return [userId.toString(), type, title, message].join("|");
}

function shouldSuppressEmail(userId, type, title, message) {
  const key = getEmailSuppressionKey(userId, type, title, message);
  const lastSentAt = recentEmailNotifications.get(key);
  const now = Date.now();

  if (lastSentAt && now - lastSentAt < EMAIL_SUPPRESSION_WINDOW_MS) {
    return true;
  }

  recentEmailNotifications.set(key, now);
  return false;
}

export const createNotification = async (recipientId, type, title, message, issueId = null) => {
  try {
    const notification = await Notification.create({ recipient: recipientId, type, title, message, issueId });

    emitToUser(recipientId.toString(), "new_notification", {
      notification: notification.toObject()
    });

    sendEmailToUser(recipientId, type, title, message).catch(() => {});
  } catch (err) {
    console.error("Failed to create notification:", err.message);
  }
};

async function sendEmailToUser(userId, type, title, message) {
  try {
    const user = await User.findById(userId, "email name emailNotifications");
    if (!user || !user.email) {
      return;
    }

    if (user.emailNotifications === false) {
      return;
    }

    if (shouldSuppressEmail(userId, type, title, message)) {
      console.log(`[Email] Suppressed duplicate notification for ${user.email}: ${title}`);
      return;
    }

    const html = notificationTemplate(title, message);
    await sendEmail(user.email, `CityPlus: ${title}`, html);
  } catch (err) {
    console.error("Failed to send email notification:", err.message);
  }
}

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

export const getUnreadCount = async (req, res, next) => {
  const count = await Notification.countDocuments({
    recipient: req.user.id,
    read: false
  });

  res.json({ success: true, count });
};

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

export const markAllAsRead = async (req, res, next) => {
  await Notification.updateMany(
    { recipient: req.user.id, read: false },
    { read: true }
  );

  res.json({ success: true, message: "All notifications marked as read" });
};
