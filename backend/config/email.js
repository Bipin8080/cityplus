import nodemailer from "nodemailer";

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

/**
 * Sends an email using Nodemailer and Gmail SMTP (configured in .env).
 */
export const sendEmail = async (to, subject, html) => {
  const host = process.env.EMAIL_HOST || "smtp.gmail.com";
  const port = process.env.EMAIL_PORT || 587;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const from = process.env.EMAIL_FROM || '"CityPlus" <cityplus.noreply@gmail.com>';

  if (!user || !pass) {
    console.warn("[Email] Skipped - EMAIL_USER or EMAIL_PASS not configured in .env");
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port == 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    });

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text: buildTextBody(html),
      html,
    });

    console.log(`[Email] Sent to ${to}: ${subject} (${info.messageId})`);
    return true;
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err.message);
    return false;
  }
};
