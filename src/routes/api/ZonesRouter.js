/**
 * Zones Router
 * API routes for delivery zone management
 */

const router = require("express").Router();
const { checkToken } = require("../../auth/token_validation");
const zonesController = require("../../controllers/ZonesController");

// =====================================================
// PUBLIC ZONE ENDPOINTS (User App)
// =====================================================

// Get all active zones for map visualization
router.get("/all", checkToken, zonesController.getAllZones);

// Check if a location is within delivery zones
router.post("/check", checkToken, zonesController.checkLocation);

// Find restaurants that can deliver to a location
router.get("/restaurants", checkToken, zonesController.getDeliveryRestaurants);

// =====================================================
// ADMIN ZONE ENDPOINTS
// =====================================================

// Create a new zone
router.post("/create", checkToken, zonesController.createZone);

// Update an existing zone
router.put("/update/:id", checkToken, zonesController.updateZone);

// Delete (deactivate) a zone
router.delete("/:id", checkToken, zonesController.deleteZone);

module.exports = router;
