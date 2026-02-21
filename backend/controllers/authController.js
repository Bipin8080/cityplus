import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Citizen Registration form
export const registerCitizen = async (req, res, next) => {
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
    role: "citizen"
  });

  const payload = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role
  };

  res.json({
    success: true,
    message: "Citizen registered successfully",
    data: { user: payload },
    // keep legacy shape for frontend compatibility
    user: payload
  });
};

// Staff Registration
export const registerStaff = async (req, res, next) => {
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
    role: "staff"
  });

  const payload = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role
  };

  res.json({
    success: true,
    message: "Staff registered successfully",
    data: { user: payload },
    user: payload
  });
};

// Admin Registration
export const registerAdmin = async (req, res, next) => {
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
    role: "admin"
  });

  const payload = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role
  };

  res.json({
    success: true,
    message: "Admin registered successfully",
    data: { user: payload },
    user: payload
  });
};

// Login (all roles)
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
