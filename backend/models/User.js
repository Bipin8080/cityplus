import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, default: null },
  role: {
    type: String,
    enum: ["citizen", "staff", "admin"],
    default: "citizen",
  },
  status: {
    type: String,
    enum: ["active", "blocked", "terminated", "pending_setup", "pending_verification"],
    default: "active"
  },
  emailVerified: {
    type: Boolean,
    default: true
  },
  emailVerifiedAt: {
    type: Date,
    default: null
  },
  emailNotifications: {
    type: Boolean,
    default: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Department",
    default: null
  },
  staffId: {
    type: String,
    unique: true,
    sparse: true
  },
  setupTokenIssuedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

export default mongoose.model("User", UserSchema);
