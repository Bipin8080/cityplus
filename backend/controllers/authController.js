import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import OTP from "../models/OTP.js";
import { sendEmail } from "../config/email.js";
import { otpEmailTemplate, welcomeEmailTemplate } from "../utils/emailTemplates.js";

// ──── Shared registration factory ────────────────────────────────────────
const registerUser = (role) => async (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    const error = new Error("All fields are required");
    error.statusCode = 400;
    return next(error);
  }

  const existing = await User.findOne({ email });
  if (existing) {
    const error = new Error("Email already registered");
    error.statusCode = 400;
    return next(error);
  }

  const hashed = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    password: hashed,
    role
  });

  // Send Welcome Email
  try {
    const html = welcomeEmailTemplate(user.name);
    await sendEmail(user.email, "Welcome to CityPlus!", html);
  } catch (err) {
    console.error("Failed to send welcome email:", err);
  }

  const payload = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role
  };

  res.json({
    success: true,
    message: `${role.charAt(0).toUpperCase() + role.slice(1)} registered successfully`,
    data: { user: payload },
    user: payload
  });
};

// Citizen Registration (public)
export const registerCitizen = registerUser("citizen");

// Staff Registration (admin only)
export const registerStaff = registerUser("staff");

// Admin Registration (admin only)
export const registerAdmin = registerUser("admin");

// ──── Login (all roles) ──────────────────────────────────────────────────
export const login = async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error("Invalid email or password");
    error.statusCode = 400;
    return next(error);
  }

  // Check if account is blocked or terminated
  if (user.status === "blocked") {
    const error = new Error("Your account has been blocked. Please contact support.");
    error.statusCode = 403;
    return next(error);
  }

  if (user.status === "terminated") {
    const error = new Error("Your account has been terminated. Please contact support.");
    error.statusCode = 403;
    return next(error);
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    const error = new Error("Invalid email or password");
    error.statusCode = 400;
    return next(error);
  }

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({
    success: true,
    message: "Login successful",
    data: {
      token,
      role: user.role,
      name: user.name
    },
    // legacy top-level fields used by frontend
    token,
    role: user.role,
    name: user.name
  });
};

// ──── Change Password ────────────────────────────────────────────────────
export const changePassword = async (req, res, next) => {
  const { email, currentPassword, newPassword, otp } = req.body;

  if (!email || !currentPassword || !newPassword || !otp) {
    const error = new Error("Email, current password, new password, and OTP are required");
    error.statusCode = 400;
    return next(error);
  }

  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error("Invalid email or password");
    error.statusCode = 400;
    return next(error);
  }

  // Verify OTP
  const isValidOTP = await OTP.verifyOTP(email, otp);
  if (!isValidOTP) {
    const error = new Error("Invalid or expired OTP.");
    error.statusCode = 400;
    return next(error);
  }

  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) {
    const error = new Error("Invalid current password");
    error.statusCode = 400;
    return next(error);
  }

  const hashed = await bcrypt.hash(newPassword, 10);

  user.password = hashed;
  await user.save();

  res.json({
    success: true,
    message: "Password changed successfully"
  });
};

// ──── Send Change Password OTP ───────────────────────────────────────────
export const sendChangePasswordOTP = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    const error = new Error("Email is required");
    error.statusCode = 400;
    return next(error);
  }

  // We check if the user requesting this is actually logged in and matches the email
  if (req.user.email !== email) {
    const error = new Error("Unauthorized to request OTP for this email");
    error.statusCode = 403;
    return next(error);
  }

  try {
    const otp = await OTP.generateOTP(email);
    const html = otpEmailTemplate(otp, req.user.name);
    const sent = await sendEmail(email, "CityPlus: Change Password OTP", html);

    if (!sent) {
      const error = new Error("Failed to send OTP. Please try again later.");
      error.statusCode = 500;
      return next(error);
    }

    res.json({
      success: true,
      message: "OTP sent to your email. It will expire in 5 minutes."
    });
  } catch (error) {
    next(error);
  }
};


// ──── Forgot Password — Send OTP ─────────────────────────────────────────
export const forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    const error = new Error("Email is required");
    error.statusCode = 400;
    return next(error);
  }

  const user = await User.findOne({ email });
  if (!user) {
    // Don't reveal whether an email exists — always show success
    return res.json({
      success: true,
      message: "If an account with this email exists, an OTP has been sent."
    });
  }

  // Generate and send OTP
  const otp = await OTP.generateOTP(email);
  const html = otpEmailTemplate(otp, user.name);
  const sent = await sendEmail(email, "CityPlus: Password Reset OTP", html);

  if (!sent) {
    const error = new Error("Failed to send OTP. Please try again later.");
    error.statusCode = 500;
    return next(error);
  }

  res.json({
    success: true,
    message: "OTP sent to your email. It will expire in 5 minutes."
  });
};

// ──── Verify OTP ─────────────────────────────────────────────────────────
export const verifyOTP = async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    const error = new Error("Email and OTP are required");
    error.statusCode = 400;
    return next(error);
  }

  const isValid = await OTP.verifyOTP(email, otp);

  if (!isValid) {
    const error = new Error("Invalid or expired OTP. Please request a new one.");
    error.statusCode = 400;
    return next(error);
  }

  res.json({
    success: true,
    message: "OTP verified successfully. You can now reset your password."
  });
};

// ──── Reset Password (after OTP verification) ────────────────────────────
export const resetPassword = async (req, res, next) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    const error = new Error("Email and new password are required");
    error.statusCode = 400;
    return next(error);
  }

  if (newPassword.length < 6) {
    const error = new Error("Password must be at least 6 characters long");
    error.statusCode = 400;
    return next(error);
  }

  // Check that OTP was verified for this email
  const hasVerified = await OTP.hasVerifiedOTP(email);
  if (!hasVerified) {
    const error = new Error("OTP not verified. Please verify your OTP first.");
    error.statusCode = 400;
    return next(error);
  }

  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    return next(error);
  }

  // Hash and update password
  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  // Clean up OTP records for this email
  await OTP.deleteMany({ email });

  res.json({
    success: true,
    message: "Password reset successfully. You can now log in with your new password."
  });
};
