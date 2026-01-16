/**
 * Zones Controller
 * Handles delivery zone management and location validation
 */

const {
    isAddressInDeliveryZone,
    getActiveZones,
    createDeliveryZone,
    findDeliveryRestaurants
} = require("../utils/zoneManager");
const Zone = require("../models/Zone");

/**
 * GET /zones/all
 * Get all active delivery zones for map visualization
 */
module.exports.getAllZones = async (req, res) => {
    try {
        if (!req.decoded) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // Fetch all active zones with full details for map rendering
        const zones = await Zone.find({ status: "Active" }).select(
            'name type description center radius polygon boundaries delivery_fee_multiplier is_priority'
        );

        const formattedZones = zones.map(zone => ({
            id: zone._id,
            name: zone.name,
            type: zone.type,
            description: zone.description || "",
            // For circular zones
            center: zone.center ? {
                latitude: zone.center.latitude,
                longitude: zone.center.longitude
            } : null,
            radius: zone.radius || null, // in km
            // For polygon zones
            polygon: zone.polygon || [],
            // Boundaries for quick map fitting
            boundaries: zone.boundaries || null,
            // Extra info
            delivery_fee_multiplier: zone.delivery_fee_multiplier || 1.0,
            is_priority: zone.is_priority || false
        }));

        return res.status(200).json({
            success: true,
            count: formattedZones.length,
            zones: formattedZones
        });
    } catch (error) {
        console.error("getAllZones error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

/**
 * POST /zones/check
 * Check if a location is within any active delivery zone
 */
module.exports.checkLocation = async (req, res) => {
    try {
        if (!req.decoded) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                in_zone: false,
                message: "latitude and longitude are required"
            });
        }

        const result = await isAddressInDeliveryZone({
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude)
        });

        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error("checkLocation error:", error);
        return res.status(500).json({
            success: false,
            in_zone: false,
            message: "Server error",
            error: error.message
        });
    }
};

/**
 * POST /zones/create
 * Create a new delivery zone (Admin only)
 */
module.exports.createZone = async (req, res) => {
    try {
        if (!req.decoded) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // Verify admin role (optional - add your admin check logic)
        // if (req.decoded.user_type !== 'admin') {
        //     return res.status(403).json({ message: "Admin access required" });
        // }

        const { name, type, description, center, radius, polygon, delivery_fee_multiplier, is_priority } = req.body;

        if (!name || !type) {
            return res.status(400).json({
                success: false,
                message: "name and type are required"
            });
        }

        if (type === 'circular' && (!center || !radius)) {
            return res.status(400).json({
                success: false,
                message: "Circular zones require center and radius"
            });
        }

        if (type === 'polygon' && (!polygon || polygon.length < 3)) {
            return res.status(400).json({
                success: false,
                message: "Polygon zones require at least 3 points"
            });
        }

        const result = await createDeliveryZone({
            name,
            type,
            description,
            center,
            radius,
            polygon,
            delivery_fee_multiplier,
            is_priority
        });

        return res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
        console.error("createZone error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

/**
 * PUT /zones/update/:id
 * Update an existing zone
 */
module.exports.updateZone = async (req, res) => {
    try {
        if (!req.decoded) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { id } = req.params;
        const updateData = req.body;

        const zone = await Zone.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true }
        );

        if (!zone) {
            return res.status(404).json({
                success: false,
                message: "Zone not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Zone updated",
            zone: {
                id: zone._id,
                name: zone.name,
                type: zone.type,
                status: zone.status
            }
        });
    } catch (error) {
        console.error("updateZone error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

/**
 * DELETE /zones/:id
 * Delete a zone (or set to inactive)
 */
module.exports.deleteZone = async (req, res) => {
    try {
        if (!req.decoded) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { id } = req.params;

        // Soft delete - set to inactive
        const zone = await Zone.findByIdAndUpdate(
            id,
            { $set: { status: "Inactive" } },
            { new: true }
        );

        if (!zone) {
            return res.status(404).json({
                success: false,
                message: "Zone not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Zone deactivated"
        });
    } catch (error) {
        console.error("deleteZone error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

/**
 * GET /zones/restaurants
 * Find restaurants that can deliver to a location
 */
module.exports.getDeliveryRestaurants = async (req, res) => {
    try {
        if (!req.decoded) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { latitude, longitude } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: "latitude and longitude query params are required"
            });
        }

        const result = await findDeliveryRestaurants({
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude)
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error("getDeliveryRestaurants error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};
