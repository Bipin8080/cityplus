import express from "express";

const router = express.Router();

// GET /api/config/maps-key — returns the Google Maps API key to the frontend
// This avoids hardcoding the key in HTML source
router.get("/maps-key", (req, res) => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key || key === "your-google-maps-api-key-here") {
        return res.json({ success: false, key: null, message: "Google Maps API key not configured" });
    }
    res.json({ success: true, key });
});

export default router;
