import express from "express";
import http from "http";
import "dotenv/config";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import issueRoutes from "./routes/issueRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import configRoutes from "./routes/configRoutes.js";
import { errorHandler } from "./middleware/errorMiddleware.js";
import { initSocket } from "./config/socket.js";

// Path setup for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

connectDB();

const app = express();

// ──── Security Middleware ────────────────────────────────────────────────
// CORS: restrict to allowed origins (set FRONTEND_URL in .env for production)
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",")
  : ["http://localhost:5000", "http://localhost:3000", "http://127.0.0.1:5000"];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, same-origin)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Sanitize user input to prevent NoSQL injection
app.use(mongoSanitize());

// Rate limiter for auth routes (prevent brute-force attacks)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 requests per window per IP
  message: { message: "Too many requests. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ──── Static Files ──────────────────────────────────────────────────────
// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Serve frontend statically
app.use(express.static(path.join(__dirname, "../frontend")));

// ──── Routes ────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/config", configRoutes);

// Serve frontend for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Error handling middleware (must be after all routes)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
