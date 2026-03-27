import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import OTP from "../models/OTP.js";
import { sendEmail } from "../config/email.js";
import {
  otpEmailTemplate,
  registrationOtpEmailTemplate,
  welcomeEmailTemplate,
  staffSetupEmailTemplate
} from "../utils/emailTemplates.js";
import { createHttpError, requireFields, sendSuccess } from "../utils/response.js";

const STAFF_SETUP_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function getStaffSetupSecret() {
  return process.env.STAFF_SETUP_SECRET || process.env.JWT_SECRET;
}

function getStaffSetupBaseUrl() {
  return process.env.STAFF_SETUP_URL_BASE || process.env.FRONTEND_URL || "http://localhost:5000";
}

function signStaffSetupToken(user) {
  return jwt.sign(
    {
      type: "staff_setup",
      userId: user._id.toString(),
      email: user.email
    },
    getStaffSetupSecret(),
    { expiresIn: Math.floor(STAFF_SETUP_TOKEN_TTL_MS / 1000), jwtid: crypto.randomUUID() }
  );
}

function verifyStaffSetupToken(token) {
  return jwt.verify(token, getStaffSetupSecret());
}

function buildStaffSetupLink(token) {
  const baseUrl = getStaffSetupBaseUrl();
  const url = new URL("/staff-setup.html", baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

async function sendRegistrationOtp(user) {
  const otp = await OTP.generateOTP(user.email);
  const html = registrationOtpEmailTemplate(otp, user.name);
  const sent = await sendEmail(user.email, "CityPlus: Verify Your Email", html);

  if (!sent) {
    await OTP.deleteMany({ email: user.email, verified: false });
    return false;
  }

  return true;
}

// ──── Shared registration factory ────────────────────────────────────────
const registerUser = (role, options = {}) => async (req, res, next) => {
  const { verifyEmail = false } = options;
  const { name, email, password } = req.body;
  requireFields(req.body, [["name", "Name"], ["email", "Email"], ["password", "Password"]]);

  const existing = await User.findOne({ email });
  if (existing) {
    return next(createHttpError("Email already registered", 400));
  }

  const hashed = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    password: hashed,
    role,
    status: verifyEmail ? "pending_verification" : "active",
    emailVerified: !verifyEmail,
    emailVerifiedAt: verifyEmail ? null : new Date()
  });

  const payload = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role
  };

  if (verifyEmail) {
    const sent = await sendRegistrationOtp(user);
    if (!sent) {
      sendSuccess(
        res,
        `${role.charAt(0).toUpperCase() + role.slice(1)} registered successfully, but the verification email could not be delivered right now. Use resend OTP after a short wait.`,
        {
          user: payload,
          verificationRequired: true,
          email: user.email,
          emailSent: false
        }
      );
      return;
    }

    sendSuccess(
      res,
      `${role.charAt(0).toUpperCase() + role.slice(1)} registered successfully. Please verify the OTP sent to your email.`,
      {
        user: payload,
        verificationRequired: true,
        email: user.email
      }
    );
    return;
  }

  try {
    const html = welcomeEmailTemplate(user.name);
    await sendEmail(user.email, "Welcome to CityPlus!", html);
  } catch (err) {
    console.error("Failed to send welcome email:", err);
  }

  sendSuccess(res, `${role.charAt(0).toUpperCase() + role.slice(1)} registered successfully`, { user: payload });
};

// Citizen Registration (public)
export const registerCitizen = registerUser("citizen", { verifyEmail: true });

export const registerStaff = async (req, res, next) => {
  const { name, email, department, staffId } = req.body;
  requireFields(req.body, [
    ["name", "Name"],
    ["email", "Email"],
    ["department", "Department"],
    ["staffId", "Staff ID"]
  ]);

  const existing = await User.findOne({ 
    $or: [{ email }, { staffId }] 
  });
  if (existing) {
    return next(createHttpError("Email or Staff ID already registered", 400));
  }

  const user = await User.create({
    name,
    email,
    password: null,
    role: "staff",
    status: "pending_setup",
    department,
    staffId,
    setupTokenIssuedAt: new Date()
  });

  const setupToken = signStaffSetupToken(user);
  const setupLink = buildStaffSetupLink(setupToken);

  try {
    const html = staffSetupEmailTemplate(user.name, setupLink);
    const sent = await sendEmail(user.email, "CityPlus: Set Up Your Staff Account", html);
    if (!sent) {
      await User.findByIdAndDelete(user._id);
      return next(createHttpError("Failed to send account setup email. Please try again later.", 500));
    }
  } catch (err) {
    await User.findByIdAndDelete(user._id);
    console.error("Failed to send staff setup email:", err);
    return next(createHttpError("Failed to send account setup email. Please try again later.", 500));
  }

  const payload = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    staffId: user.staffId
  };

  sendSuccess(res, "Staff registered successfully. Setup link sent by email.", { user: payload });
};

export const resendStaffSetupLink = async (req, res, next) => {
  const { staffId } = req.params;
  const user = await User.findById(staffId);
  if (!user || user.role !== "staff") {
    return next(createHttpError("Staff member not found", 404));
  }

  if (user.status !== "pending_setup") {
    return next(createHttpError("This staff account has already been activated or is suspended.", 400));
  }

  const setupToken = signStaffSetupToken(user);
  const setupLink = buildStaffSetupLink(setupToken);

  try {
    const html = staffSetupEmailTemplate(user.name, setupLink);
    const sent = await sendEmail(user.email, "CityPlus: Set Up Your Staff Account", html);
    if (!sent) {
      return next(createHttpError("Failed to send account setup email. Please try again later.", 500));
    }
    
    user.setupTokenIssuedAt = new Date();
    await user.save();
    
  } catch (err) {
    console.error("Failed to resend staff setup email:", err);
    return next(createHttpError("Failed to resend account setup email. Please try again later.", 500));
  }

  sendSuccess(res, "Setup link resent successfully.");
};

export const completeStaffSetup = async (req, res, next) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return next(createHttpError("Token and password are required", 400));
  }

  if (password.length < 6) {
    return next(createHttpError("Password must be at least 6 characters long", 400));
  }

  let decoded;
  try {
    decoded = verifyStaffSetupToken(token);
  } catch (error) {
    return next(createHttpError("Invalid or expired setup link. Please request a new invite.", 400));
  }

  if (decoded.type !== "staff_setup" || !decoded.userId || !decoded.email) {
    return next(createHttpError("Invalid setup link", 400));
  }

  const user = await User.findById(decoded.userId).populate("department", "name");
  if (!user || user.email !== decoded.email || user.role !== "staff") {
    return next(createHttpError("Invalid setup link", 400));
  }

  if (user.status !== "pending_setup") {
    return next(createHttpError("This staff account has already been activated.", 400));
  }

  user.password = await bcrypt.hash(password, 10);
  user.status = "active";
  user.setupTokenIssuedAt = null;
  await user.save();

  const authToken = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  sendSuccess(res, "Staff account activated successfully", {
    token: authToken,
    role: user.role,
    name: user.name,
    email: user.email,
    departmentName: user.department ? user.department.name : undefined
  });
};

export const updateEmailNotificationPreference = async (req, res, next) => {
  const { enabled } = req.body;

  if (typeof enabled !== "boolean") {
    return next(createHttpError("Enabled must be a boolean value", 400));
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    return next(createHttpError("User not found", 404));
  }

  user.emailNotifications = enabled;
  await user.save();

  sendSuccess(res, "Email notification preference updated successfully", {
    emailNotifications: user.emailNotifications
  });
};

// Admin Registration (admin only)
export const registerAdmin = registerUser("admin");

export const resendRegistrationOTP = async (req, res, next) => {
  const { email } = req.body;
  requireFields(req.body, [["email", "Email"]]);

  const user = await User.findOne({ email });
  if (!user) {
    return next(createHttpError("Account not found", 404));
  }

  if (user.status !== "pending_verification" || user.emailVerified) {
    return next(createHttpError("This account has already been verified. Please log in.", 400));
  }

  const sent = await sendRegistrationOtp(user);
  if (!sent) {
    return next(createHttpError("Failed to resend verification OTP. Please try again later.", 500));
  }

  sendSuccess(res, "Verification OTP resent successfully.");
};

export const verifyRegistrationOTP = async (req, res, next) => {
  const { email, otp } = req.body;
  requireFields(req.body, [["email", "Email"], ["otp", "OTP"]]);

  const user = await User.findOne({ email });
  if (!user) {
    return next(createHttpError("Account not found", 404));
  }

  if (user.status !== "pending_verification" || user.emailVerified) {
    return next(createHttpError("This account is already verified. Please log in.", 400));
  }

  const isValid = await OTP.verifyOTP(email, otp);
  if (!isValid) {
    return next(createHttpError("Invalid or expired OTP. Please request a new one.", 400));
  }

  user.status = "active";
  user.emailVerified = true;
  user.emailVerifiedAt = new Date();
  await user.save();

  await OTP.deleteMany({ email });

  try {
    const html = welcomeEmailTemplate(user.name);
    await sendEmail(user.email, "Welcome to CityPlus!", html);
  } catch (err) {
    console.error("Failed to send welcome email after verification:", err);
  }

  sendSuccess(res, "Email verified successfully. You can now log in.");
};

// ──── Login (all roles) ──────────────────────────────────────────────────
export const login = async (req, res, next) => {
  const { email, password } = req.body;
  requireFields(req.body, [["email", "Email"], ["password", "Password"]]);

  const user = await User.findOne({ email }).populate("department", "name");
  if (!user) {
    return next(createHttpError("Invalid email or password", 400));
  }

  // Check if account is blocked or terminated
  if (user.status === "blocked") {
    return next(createHttpError("Your account has been blocked. Please contact support.", 403));
  }

  if (user.status === "terminated") {
    return next(createHttpError("Your account has been terminated. Please contact support.", 403));
  }

  if (user.status === "pending_verification" || user.emailVerified === false) {
    return next(createHttpError("Your email is not verified yet. Please complete OTP verification before logging in.", 403));
  }

  if (!user.password || user.status === "pending_setup") {
    return next(createHttpError("Your staff account setup is still pending. Please use the setup link sent to your email.", 403));
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return next(createHttpError("Invalid email or password", 400));
  }

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  const responseData = {
    token,
    role: user.role,
    name: user.name,
    departmentName: user.department ? user.department.name : undefined
  };

  sendSuccess(res, "Login successful", responseData);
};

// ──── Change Password ────────────────────────────────────────────────────
export const changePassword = async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  requireFields(req.body, [["currentPassword", "Current password"], ["newPassword", "New password"]]);

  const user = await User.findById(req.user.id);
  if (!user) {
    return next(createHttpError("User not found", 404));
  }

  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) {
    return next(createHttpError("Invalid current password", 400));
  }

  if (newPassword.length < 6) {
    return next(createHttpError("Password must be at least 6 characters long", 400));
  }

  const hashed = await bcrypt.hash(newPassword, 10);

  user.password = hashed;
  await user.save();

  sendSuccess(res, "Password changed successfully");
};

// ──── Send Change Password OTP ───────────────────────────────────────────
export const sendChangePasswordOTP = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(createHttpError("Email is required", 400));
  }

  // We check if the user requesting this is actually logged in and matches the email
  if (req.user.email !== email) {
    return next(createHttpError("Unauthorized to request OTP for this email", 403));
  }

  try {
    const otp = await OTP.generateOTP(email);
    const html = otpEmailTemplate(otp, req.user.name);
    const sent = await sendEmail(email, "CityPlus: Change Password OTP", html);

    if (!sent) {
      await OTP.deleteMany({ email, verified: false });
      return next(createHttpError("Failed to send OTP. Please try again later.", 500));
    }

    sendSuccess(res, "OTP sent to your email. It will expire in 5 minutes.");
  } catch (error) {
    next(error);
  }
};


// ──── Forgot Password — Send OTP ─────────────────────────────────────────
export const forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(createHttpError("Email is required", 400));
  }

  const user = await User.findOne({ email });
  if (!user) {
    // Don't reveal whether an email exists — always show success
    return sendSuccess(res, "If an account with this email exists, an OTP has been sent.");
  }

  // Generate and send OTP
  const otp = await OTP.generateOTP(email);
  const html = otpEmailTemplate(otp, user.name);
  const sent = await sendEmail(email, "CityPlus: Password Reset OTP", html);

  if (!sent) {
    await OTP.deleteMany({ email, verified: false });
    return next(createHttpError("Failed to send OTP. Please try again later.", 500));
  }

  sendSuccess(res, "OTP sent to your email. It will expire in 5 minutes.");
};

// ──── Verify OTP ─────────────────────────────────────────────────────────
export const verifyOTP = async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return next(createHttpError("Email and OTP are required", 400));
  }

  const isValid = await OTP.verifyOTP(email, otp);

  if (!isValid) {
    return next(createHttpError("Invalid or expired OTP. Please request a new one.", 400));
  }

  sendSuccess(res, "OTP verified successfully. You can now reset your password.");
};

// ──── Reset Password (after OTP verification) ────────────────────────────
export const resetPassword = async (req, res, next) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return next(createHttpError("Email and new password are required", 400));
  }

  if (newPassword.length < 6) {
    return next(createHttpError("Password must be at least 6 characters long", 400));
  }

  // Check that OTP was verified for this email
  const hasVerified = await OTP.hasVerifiedOTP(email);
  if (!hasVerified) {
    return next(createHttpError("OTP not verified. Please verify your OTP first.", 400));
  }

  const user = await User.findOne({ email });
  if (!user) {
    return next(createHttpError("User not found", 404));
  }

  // Hash and update password
  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  // Clean up OTP records for this email
  await OTP.deleteMany({ email });

  sendSuccess(res, "Password reset successfully. You can now log in with your new password.");
};
