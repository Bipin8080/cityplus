import "dotenv/config";
import { sendEmail } from "./config/email.js";

async function test() {
  const to = process.env.TEST_EMAIL_TO || process.env.EMAIL_TO || process.env.EMAIL_USER;

  if (!to) {
    console.error("Missing TEST_EMAIL_TO or EMAIL_USER");
    process.exit(1);
  }

  console.log(`Testing Nodemailer send API to ${to}...`);

  try {
    const success = await sendEmail(to, "Test Email from CityPlus", "<p>This is a test email sent via Nodemailer.</p>");
    if (success) {
      console.log("Send successful");
    } else {
      console.log("Send failed (returned false)");
      process.exit(1);
    }
  } catch (err) {
    console.error("Send failed with exception:", err);
    process.exit(1);
  }
}

test();
