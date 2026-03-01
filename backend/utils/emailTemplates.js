/**
 * CityPlus Email Templates
 * Branded HTML email templates for notifications and OTP.
 */

const BRAND_COLOR = "#1e40af";
const BRAND_NAME = "CityPlus";

// ── Base wrapper for all emails ─────────────────────────────────────────
function baseTemplate(title, bodyContent) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:24px;">
        <!-- Header -->
        <div style="background:${BRAND_COLOR};padding:24px 32px;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:0.5px;">${BRAND_NAME}</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Civic Issue Reporting Platform</p>
        </div>

        <!-- Body -->
        <div style="background:#ffffff;padding:32px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
            ${bodyContent}
        </div>

        <!-- Footer -->
        <div style="text-align:center;padding:16px;color:#94a3b8;font-size:12px;">
            <p style="margin:0;">© ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.</p>
            <p style="margin:4px 0 0;">This is an automated notification. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`;
}

// ── OTP Email ───────────────────────────────────────────────────────────
export function otpEmailTemplate(otp, name = "User") {
    const body = `
        <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Password Reset Request</h2>
        <p style="color:#64748b;margin:0 0 24px;font-size:15px;">Hi ${name}, we received a request to reset your password.</p>

        <div style="background:#f8fafc;border:2px dashed ${BRAND_COLOR};border-radius:8px;padding:24px;text-align:center;margin-bottom:24px;">
            <p style="margin:0 0 8px;color:#64748b;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Your Verification Code</p>
            <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:8px;color:${BRAND_COLOR};">${otp}</p>
        </div>

        <p style="color:#64748b;font-size:14px;margin:0 0 8px;">⏱ This code expires in <strong>5 minutes</strong>.</p>
        <p style="color:#64748b;font-size:14px;margin:0 0 24px;">If you didn't request a password reset, you can safely ignore this email.</p>

        <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:4px;">
            <p style="margin:0;color:#92400e;font-size:13px;">🔒 <strong>Security Tip:</strong> Never share this code with anyone. CityPlus staff will never ask for your OTP.</p>
        </div>
    `;
    return baseTemplate("Password Reset OTP", body);
}

// ── Issue Status Update ─────────────────────────────────────────────────
export function statusUpdateTemplate(issueTitle, newStatus, issueId) {
    const statusColors = {
        "Pending": "#f59e0b",
        "In Progress": "#3b82f6",
        "Resolved": "#22c55e"
    };
    const color = statusColors[newStatus] || "#64748b";

    const body = `
        <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Issue Status Updated</h2>
        <p style="color:#64748b;margin:0 0 24px;font-size:15px;">Your reported issue has been updated.</p>

        <div style="background:#f8fafc;padding:20px;border-radius:8px;margin-bottom:24px;">
            <p style="margin:0 0 12px;color:#64748b;font-size:13px;">ISSUE TITLE</p>
            <p style="margin:0 0 16px;color:#1e293b;font-size:16px;font-weight:600;">${issueTitle}</p>

            <p style="margin:0 0 8px;color:#64748b;font-size:13px;">NEW STATUS</p>
            <span style="display:inline-block;padding:6px 16px;border-radius:20px;background:${color}15;color:${color};font-weight:600;font-size:14px;">${newStatus}</span>
        </div>

        <p style="color:#64748b;font-size:14px;margin:0;">
            Log in to your CityPlus dashboard to view more details.
        </p>
    `;
    return baseTemplate("Issue Status Update", body);
}

// ── Issue Assignment ────────────────────────────────────────────────────
export function assignmentTemplate(issueTitle, isReassignment = false) {
    const body = `
        <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">
            ${isReassignment ? "Issue Re-assigned to You" : "New Issue Assigned"}
        </h2>
        <p style="color:#64748b;margin:0 0 24px;font-size:15px;">
            ${isReassignment
            ? "An issue has been re-assigned to you for resolution."
            : "A new civic issue has been assigned to you."}
        </p>

        <div style="background:#f8fafc;padding:20px;border-radius:8px;margin-bottom:24px;">
            <p style="margin:0 0 12px;color:#64748b;font-size:13px;">ISSUE TITLE</p>
            <p style="margin:0;color:#1e293b;font-size:16px;font-weight:600;">${issueTitle}</p>
        </div>

        <p style="color:#64748b;font-size:14px;margin:0;">
            Please log in to your staff dashboard to review the details and take action.
        </p>
    `;
    return baseTemplate("Issue Assignment", body);
}

// ── New Issue Reported (for admins) ─────────────────────────────────────
export function newIssueTemplate(issueTitle, ward, citizenName) {
    const body = `
        <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">New Issue Reported</h2>
        <p style="color:#64748b;margin:0 0 24px;font-size:15px;">A citizen has reported a new civic issue.</p>

        <div style="background:#f8fafc;padding:20px;border-radius:8px;margin-bottom:24px;">
            <div style="margin-bottom:12px;">
                <p style="margin:0 0 4px;color:#64748b;font-size:13px;">ISSUE</p>
                <p style="margin:0;color:#1e293b;font-size:16px;font-weight:600;">${issueTitle}</p>
            </div>
            <div style="display:flex;gap:24px;">
                <div>
                    <p style="margin:0 0 4px;color:#64748b;font-size:13px;">WARD</p>
                    <p style="margin:0;color:#1e293b;font-weight:500;">${ward}</p>
                </div>
                <div>
                    <p style="margin:0 0 4px;color:#64748b;font-size:13px;">REPORTED BY</p>
                    <p style="margin:0;color:#1e293b;font-weight:500;">${citizenName}</p>
                </div>
            </div>
        </div>

        <p style="color:#64748b;font-size:14px;margin:0;">
            Log in to the admin dashboard to review and assign this issue.
        </p>
    `;
    return baseTemplate("New Issue Report", body);
}

// ── Generic Notification Email ──────────────────────────────────────────
export function notificationTemplate(title, message) {
    const body = `
        <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">${title}</h2>
        <p style="color:#64748b;margin:0 0 24px;font-size:15px;">${message}</p>
        <p style="color:#64748b;font-size:14px;margin:0;">
            Log in to your CityPlus dashboard for more details.
        </p>
    `;
    return baseTemplate(title, body);
}
