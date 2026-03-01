import nodemailer from "nodemailer";

// Create reusable transporter — configured for Gmail by default
// For other providers, update EMAIL_HOST and EMAIL_PORT in .env
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/**
 * Send an email.
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} html - HTML email body
 * @returns {Promise<boolean>} - true if sent successfully
 */
export const sendEmail = async (to, subject, html) => {
    // Skip if email is not configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn("[Email] Skipped — EMAIL_USER or EMAIL_PASS not configured in .env");
        return false;
    }

    try {
        await transporter.sendMail({
            from: process.env.EMAIL_FROM || `"CityPlus" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html
        });
        console.log(`[Email] Sent to ${to}: ${subject}`);
        return true;
    } catch (err) {
        console.error(`[Email] Failed to send to ${to}:`, err.message);
        return false;
    }
};
