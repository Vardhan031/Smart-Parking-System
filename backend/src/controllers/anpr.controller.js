const FormData = require("form-data");
const ParkingService = require("../services/parking.service.js");

const ANPR_SERVICE_URL = process.env.ANPR_SERVICE_URL || "http://localhost:8000";

/**
 * Forward image to ANPR service and get detected plates
 */
async function detectPlate(imageBuffer, filename) {
    const formData = new FormData();
    formData.append("image", imageBuffer, {
        filename: filename || "image.jpg",
        contentType: "image/jpeg"
    });

    const response = await fetch(`${ANPR_SERVICE_URL}/detect`, {
        method: "POST",
        body: formData,
        headers: formData.getHeaders()
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
                plates: result.plates
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

            if (!bestPlate) {
                return res.status(400).json({
                    success: false,
                    message: "No valid license plate detected",
                    detection: detection.plates
                });
            }

            // Delegate to ParkingService
            const result = await ParkingService.handleEntry({
                plateNumber: bestPlate.plate,
                lotId,
                vehicleType
            });

            return res.status(result.success ? 200 : 409).json({
                ...result,
                detection: {
                    plate: bestPlate.plate,
                    confidence: bestPlate.confidence,
                    raw_text: bestPlate.raw_text
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

            if (!bestPlate) {
                return res.status(400).json({
                    success: false,
                    message: "No valid license plate detected",
                    detection: detection.plates
                });
            }

            // Delegate to ParkingService
            const result = await ParkingService.handleExit({
                plateNumber: bestPlate.plate,
                lotId
            });

            return res.status(result.success ? 200 : 404).json({
                ...result,
                detection: {
                    plate: bestPlate.plate,
                    confidence: bestPlate.confidence,
                    raw_text: bestPlate.raw_text
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
