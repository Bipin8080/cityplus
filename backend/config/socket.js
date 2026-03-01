import { Server } from "socket.io";
import jwt from "jsonwebtoken";

let io = null;

// Map of userId → Set of socketIds (supports multiple tabs/devices)
const connectedUsers = new Map();

/**
 * Initialize Socket.IO on the HTTP server.
 * Call this once from server.js after creating the HTTP server.
 */
export function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL
                ? process.env.FRONTEND_URL.split(",")
                : ["http://localhost:5000", "http://localhost:3000", "http://127.0.0.1:5000"],
            credentials: true
        },
        // Fallback to long-polling for environments that block WebSockets
        transports: ["websocket", "polling"]
    });

    io.on("connection", (socket) => {
        console.log(`[Socket.IO] New connection: ${socket.id}`);

        // ── Authentication ──────────────────────────────────────────
        // Client sends { token } after connecting
        socket.on("authenticate", (data) => {
            try {
                const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
                const userId = decoded.id;

                // Store socket mapping
                if (!connectedUsers.has(userId)) {
                    connectedUsers.set(userId, new Set());
                }
                connectedUsers.get(userId).add(socket.id);

                // Join user-specific room
                socket.join(`user:${userId}`);
                socket.userId = userId;

                socket.emit("authenticated", { success: true });
                console.log(`[Socket.IO] User ${userId} authenticated (socket: ${socket.id})`);
            } catch (err) {
                socket.emit("authenticated", { success: false, message: "Invalid token" });
            }
        });

        // ── Disconnect cleanup ──────────────────────────────────────
        socket.on("disconnect", () => {
            if (socket.userId) {
                const userSockets = connectedUsers.get(socket.userId);
                if (userSockets) {
                    userSockets.delete(socket.id);
                    if (userSockets.size === 0) {
                        connectedUsers.delete(socket.userId);
                    }
                }
                console.log(`[Socket.IO] User ${socket.userId} disconnected (socket: ${socket.id})`);
            }
        });
    });

    return io;
}

/**
 * Get the Socket.IO instance.
 * Use this in controllers to emit events.
 */
export function getIO() {
    return io;
}

/**
 * Emit a notification event to a specific user.
 * @param {string} userId - The recipient's MongoDB _id
 * @param {object} notification - The notification document
 */
export function emitToUser(userId, event, data) {
    if (io) {
        io.to(`user:${userId}`).emit(event, data);
    }
}
