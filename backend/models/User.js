import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["citizen", "staff", "admin"],
    default: "citizen",
  },
  status: {
    type: String,
    enum: ["active", "blocked", "terminated"],
    default: "active"
  }
}, { timestamps: true });

export default mongoose.model("User", UserSchema);
