import jwt from "jsonwebtoken";
import User from "../models/User.js";

async function attachUserFromToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return { user: null };
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user is still active
    const user = await User.findById(decoded.id).populate("department", "name");
    if (!user) {
      return { error: { status: 401, message: "User not found" } };
    }

    if (user.status === "blocked") {
      return { error: { status: 403, message: "Your account has been blocked. Please contact support." } };
    }

    if (user.status === "terminated") {
      return { error: { status: 403, message: "Your account has been terminated. Please contact support." } };
    }

    return {
      user: {
        id: user._id.toString(),
        role: user.role,
        name: user.name,
        email: user.email,
        status: user.status,
        emailNotifications: user.emailNotifications !== false,
        department: user.department?._id || user.department || null,
        departmentName: user.department?.name || null
      }
    };
  } catch (err) {
    return { error: { status: 401, message: "Token invalid or expired" } };
  }
}

export const protect = async (req, res, next) => {
  const result = await attachUserFromToken(req);

  if (result.error) {
    return res.status(result.error.status).json({ message: result.error.message });
  }

  if (!result.user) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  req.user = result.user;
  next();
};

export const optionalProtect = async (req, res, next) => {
  const result = await attachUserFromToken(req);

  if (result.error) {
    const header = req.headers.authorization;
    if (header && header.startsWith("Bearer ")) {
      return res.status(result.error.status).json({ message: result.error.message });
    }
  }

  req.user = result.user;
  next();
};
