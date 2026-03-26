import nodemailer from "nodemailer";

const emailPort = Number.parseInt(process.env.EMAIL_PORT || "587", 10);
const emailSecure = process.env.EMAIL_SECURE
  ? process.env.EMAIL_SECURE === "true"
  : emailPort === 465;

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: emailPort,
  secure: emailSecure,
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

let hasVerifiedTransport = false;

function buildTextBody(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export async function verifyEmailTransport() {
  if (hasVerifiedTransport) {
    return;
  }

  await transporter.verify();
  hasVerifiedTransport = true;
}

export const sendEmail = async (to, subject, html) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("[Email] Skipped - EMAIL_USER or EMAIL_PASS not configured in .env");
    return false;
  }

  try {
    await verifyEmailTransport();

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"CityPlus" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text: buildTextBody(html)
    });

    console.log(`[Email] Sent to ${to}: ${subject}`);
    return true;
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err.message);
    return false;
  }
};
