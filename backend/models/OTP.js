import mongoose from "mongoose";
import crypto from "crypto";

const OTPSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        index: true
    },
    otp: {
        type: String,
        required: true
    },
    verified: {
        type: Boolean,
        default: false
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 } // TTL index — auto-delete when expired
    }
}, { timestamps: true });

/**
 * Generate a 6-digit OTP and hash it for storage.
 * Returns the plaintext OTP (to send via email).
 */
OTPSchema.statics.generateOTP = async function (email) {
    // Delete any existing OTPs for this email
    await this.deleteMany({ email });

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // Hash the OTP before storing
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    // Store with 5-minute expiry
    await this.create({
        email,
        otp: hashedOtp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    });

    return otp; // Return plaintext to send via email
};

/**
 * Verify an OTP for a given email.
 * Returns true if valid, false otherwise.
 */
OTPSchema.statics.verifyOTP = async function (email, otp) {
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    const record = await this.findOne({
        email,
        otp: hashedOtp,
        expiresAt: { $gt: new Date() }, // Not expired
        verified: false
    });

    if (!record) return false;

    // Mark as verified
    record.verified = true;
    await record.save();
    return true;
};

/**
 * Check if a verified OTP exists for this email (for password reset).
 */
OTPSchema.statics.hasVerifiedOTP = async function (email) {
    const record = await this.findOne({
        email,
        verified: true,
        expiresAt: { $gt: new Date() }
    });
    return !!record;
};

export default mongoose.model("OTP", OTPSchema);
