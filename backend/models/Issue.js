import mongoose from "mongoose";

const IssueSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: { type: String, required: true },
    ward: { type: String, required: true },
    location: { type: String, required: true }, // human-readable
    priority: {
      type: String,
      enum: ["High", "Medium", "Low"],
      default: "Medium"
    },
    description: { type: String, required: true },

    status: {
      type: String,
      enum: ["Open", "In Progress", "Resolved"],
      default: "Open"
    },

    citizen: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // D: assignment
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    // G: optional coordinates (not required)
    lat: { type: Number },
    lng: { type: Number },

    // H: optional image upload
    image: { type: String, default: null },

    // I: timestamp for resolution
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Issue", IssueSchema);
