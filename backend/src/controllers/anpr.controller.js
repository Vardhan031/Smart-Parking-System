const ParkingService = require("../services/parking.service.js");

const ANPR_SERVICE_URL = process.env.ANPR_SERVICE_URL || "http://localhost:8001";

/**
 * Forward image to ANPR service and get detected plates.
 *
 * Uses the WHATWG FormData + Blob globals (Node 18+) which are compatible
 * with the native fetch API. The old `form-data` npm package produced a
 * Node.js stream that native fetch cannot consume correctly.
 */
async function detectPlate(imageBuffer, filename) {
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: "image/jpeg" });
    formData.append("image", blob, filename || "image.jpg");

    // Do NOT set Content-Type manually — fetch adds it with the correct boundary
    const response = await fetch(`${ANPR_SERVICE_URL}/detect`, {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`ANPR service error: ${error}`);
    }

    return response.json();
}

/**
 * Get the best plate from detection results
 */
function getBestPlate(plates) {
    if (!plates || plates.length === 0) {
        return null;
    }

    // Filter for valid plates (status OK) and sort by confidence
    const validPlates = plates
        .filter(p => p.plate && p.status === "OK")
        .sort((a, b) => b.confidence - a.confidence);

    return validPlates.length > 0 ? validPlates[0] : null;
}

class ANPRController {

    /**
     * POST /api/anpr/detect
     * Standalone plate detection (no parking action)
     */
    static async detect(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "Image file is required"
                });
            }

            const result = await detectPlate(req.file.buffer, req.file.originalname);

            return res.status(200).json({
                success: true,
                plates: result.plates,
                captured_at: result.captured_at || null
            });

        } catch (error) {
            console.error("ANPR DETECT ERROR:", error);
            return res.status(500).json({
                success: false,
                message: error.message || "ANPR detection failed"
            });
        }
    }

    /**
     * POST /api/anpr/entry
     * Image upload → detect plate → entry flow
     */
    static async imageEntry(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "Image file is required"
                });
            }

            const { lotId, vehicleType } = req.body;

            if (!lotId) {
                return res.status(400).json({
                    success: false,
                    message: "lotId is required"
                });
            }

            // Detect plate from image
            const detection = await detectPlate(req.file.buffer, req.file.originalname);
            const bestPlate = getBestPlate(detection.plates);

            // Log full ANPR output to backend console for debugging
            console.log("[ANPR ENTRY] plates:", JSON.stringify(detection.plates));
            if (detection.debug_rejections?.length) {
                console.log("[ANPR ENTRY] rejections:", JSON.stringify(detection.debug_rejections));
            }

            if (!bestPlate) {
                return res.status(400).json({
                    success: false,
                    message: "No valid license plate detected",
                    debug_rejections: detection.debug_rejections || []
                });
            }

            // Use camera timestamp if available, otherwise fall back to current time
            const capturedAt = detection.captured_at ? new Date(detection.captured_at) : null;

            // Delegate to ParkingService
            const result = await ParkingService.handleEntry({
                plateNumber: bestPlate.plate,
                lotId,
                vehicleType,
                entryTime: capturedAt
            });

            return res.status(result.success ? 200 : 409).json({
                ...result,
                detection: {
                    plate: bestPlate.plate,
                    confidence: bestPlate.confidence,
                    raw_text: bestPlate.raw_text,
                    captured_at: detection.captured_at || null
                }
            });

        } catch (error) {
            console.error("ANPR ENTRY ERROR:", error);
            return res.status(500).json({
                success: false,
                message: error.message || "ANPR entry failed"
            });
        }
    }

    /**
     * POST /api/anpr/exit
     * Image upload → detect plate → exit flow
     */
    static async imageExit(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "Image file is required"
                });
            }

            const { lotId } = req.body;

            if (!lotId) {
                return res.status(400).json({
                    success: false,
                    message: "lotId is required"
                });
            }

            // Detect plate from image
            const detection = await detectPlate(req.file.buffer, req.file.originalname);
            const bestPlate = getBestPlate(detection.plates);

            // Log full ANPR output to backend console for debugging
            console.log("[ANPR EXIT] plates:", JSON.stringify(detection.plates));
            if (detection.debug_rejections?.length) {
                console.log("[ANPR EXIT] rejections:", JSON.stringify(detection.debug_rejections));
            }

            if (!bestPlate) {
                return res.status(400).json({
                    success: false,
                    message: "No valid license plate detected",
                    debug_rejections: detection.debug_rejections || []
                });
            }

            // Use camera timestamp if available, otherwise fall back to current time
            const capturedAt = detection.captured_at ? new Date(detection.captured_at) : null;

            // Delegate to ParkingService
            const result = await ParkingService.handleExit({
                plateNumber: bestPlate.plate,
                lotId,
                exitTime: capturedAt
            });

            return res.status(result.success ? 200 : 404).json({
                ...result,
                detection: {
                    plate: bestPlate.plate,
                    confidence: bestPlate.confidence,
                    raw_text: bestPlate.raw_text,
                    captured_at: detection.captured_at || null
                }
            });

        } catch (error) {
            console.error("ANPR EXIT ERROR:", error);
            return res.status(500).json({
                success: false,
                message: error.message || "ANPR exit failed"
            });
        }
    }
}

module.exports = ANPRController;
