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
      enum: ["Pending", "In Progress", "Resolved"],
      default: "Pending"
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

    // H: optional image upload (initial submission)
    image: { type: String, default: null },

    // Timeline elements
    inProgressAt: { type: Date, default: null },
    inProgressImage: { type: String, default: null },
    inProgressNote: { type: String, default: null },

    // I: timestamp for resolution
    resolvedAt: { type: Date, default: null },
    resolvedImage: { type: String, default: null },
    resolvedNote: { type: String, default: null },

    // J: Citizen feedback once resolved
    feedback: {
      rating: { type: Number, min: 1, max: 5 },
      text: { type: String },
      submittedAt: { type: Date }
    },

    // Soft delete flag
    deleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Compound index for efficient filtered + sorted queries
IssueSchema.index({ status: 1, createdAt: -1 });
IssueSchema.index({ deleted: 1, createdAt: -1 });

export default mongoose.model("Issue", IssueSchema);
