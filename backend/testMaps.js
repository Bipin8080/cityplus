import 'dotenv/config';

async function testGoogleMaps() {
    console.log("--- Testing Google Maps API ---");
    console.log("GOOGLE_MAPS_API_KEY:", process.env.GOOGLE_MAPS_API_KEY ? "Present" : "Missing");

    try {
        const key = process.env.GOOGLE_MAPS_API_KEY;
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=New+York&key=${key}`);
        const data = await res.json();
        if (data.status === "OK") {
            console.log("✅ Google Maps API Key is valid and working.");
        } else {
            console.error("❌ Google Maps API Error:", data.status, data.error_message);
        }
    } catch (error) {
        console.error("❌ Failed to test Google Maps API:", error.message);
    }
}

testGoogleMaps();
