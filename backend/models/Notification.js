import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        type: {
            type: String,
            enum: [
                "issue_created",
                "issue_assigned",
                "issue_reassigned",
                "status_updated",
                "issue_reject_requested",
                "issue_rejected",
                "feedback_received",
                "account_status_changed"
            ],
            required: true
        },
        title: { type: String, required: true },
        message: { type: String, required: true },
        issueId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Issue",
            default: null
        },
        read: { type: Boolean, default: false }
    },
    { timestamps: true }
);

// Compound index for fast queries: unread notifications for a user, newest first
NotificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

export default mongoose.model("Notification", NotificationSchema);
