// Centralized error handling middleware
export const errorHandler = (err, req, res, next) => {
  // Log error for debugging
  console.error("Error:", err);

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map(e => e.message).join(", ");
    return res.status(400).json({ message: messages });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(400).json({ message: "Duplicate entry. This record already exists." });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === "CastError") {
    return res.status(404).json({ message: "Resource not found" });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ message: "Invalid token" });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ message: "Token expired" });
  }

  // Custom error with status code
  if (err.statusCode) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  // Default server error
  res.status(500).json({ message: "Server error" });
};

// Async handler wrapper to catch errors in async route handlers
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
