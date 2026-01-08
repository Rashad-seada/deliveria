/**
 * Zone Management System
 * Handles delivery zones and validates user locations
 */

const Zone = require("../models/Zone"); // Will create this schema
const Address = require("../models/Address");
const Restaurant = require("../models/Restaurants");
const { calculateDistance } = require("./deliveryHelpers");

/**
 * Checks if address is within delivery zone
 */
async function isAddressInDeliveryZone(coordinates) {
    try {
        if (!coordinates || !coordinates.latitude || !coordinates.longitude) {
            return {
                in_zone: false,
                message: "Invalid coordinates"
            };
        }

        // Query active zones
        const zones = await Zone.find({ status: "Active" });

        if (!zones || zones.length === 0) {
            // If no zones defined, allow all locations
            return {
                in_zone: true,
                message: "No delivery zones defined - accepting all locations"
            };
        }

        // Check if coordinates fall within any active zone
        for (const zone of zones) {
            if (isCoordinateInZone(coordinates, zone)) {
                return {
                    in_zone: true,
                    zone_name: zone.name,
                    zone_id: zone._id,
                    message: "Address is in delivery zone"
                };
            }
        }

        return {
            in_zone: false,
            message: "Address is outside delivery zones",
            nearby_zone: zones[0]?.name // Suggest nearest zone
        };
    } catch (error) {
        console.error("Error checking delivery zone:", error);
        return {
            in_zone: false,
            message: "Error checking delivery zone",
            error: error.message
        };
    }
}

/**
 * Checks if a coordinate is within a zone
 * Zone can be circular (radius-based) or polygon-based
 */
function isCoordinateInZone(coordinates, zone) {
    if (zone.type === "circular") {
        // Circular zone: check distance from center
        const distance = calculateDistance(
            zone.center.latitude,
            zone.center.longitude,
            coordinates.latitude,
            coordinates.longitude
        );
        return distance <= zone.radius;
    } else if (zone.type === "polygon") {
        // Polygon zone: use point-in-polygon algorithm
        return isPointInPolygon(
            { lat: coordinates.latitude, lng: coordinates.longitude },
            zone.polygon
        );
    }
    return false;
}

/**
 * Point-in-polygon algorithm (ray casting)
 */
function isPointInPolygon(point, polygon) {
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lat;
        const yi = polygon[i].lng;
        const xj = polygon[j].lat;
        const yj = polygon[j].lng;

        const intersect =
            ((yi > point.lng) !== (yj > point.lng)) &&
            point.lat < ((xj - xi) * (point.lng - yi)) / (yj - yi) + xi;

        if (intersect) isInside = !isInside;
    }
    return isInside;
}

/**
 * Gets all active delivery zones
 */
async function getActiveZones() {
    try {
        const zones = await Zone.find({ status: "Active" }).select(
            'name type description center radius polygon coordinates'
        );

        return {
            success: true,
            zones: zones.map(zone => ({
                id: zone._id,
                name: zone.name,
                type: zone.type,
                description: zone.description
            }))
        };
    } catch (error) {
        console.error("Error getting zones:", error);
        return {
            success: false,
            message: "Error fetching zones",
            error: error.message
        };
    }
}

/**
 * Finds restaurants that can deliver to an address
 */
async function findDeliveryRestaurants(addressCoordinates) {
    try {
        // First check if address is in delivery zone
        const zoneCheck = await isAddressInDeliveryZone(addressCoordinates);
        if (!zoneCheck.in_zone) {
            return {
                success: false,
                message: "Address is outside delivery zones",
                restaurants: []
            };
        }

        // Get restaurants with active delivery
        const restaurants = await Restaurant.find({
            have_delivery: true,
            status: "Active",
            is_show: true
        }).select('name coordinates delivery_cost phone estimated_time');

        // Filter restaurants based on delivery radius (if applicable)
        const availableRestaurants = restaurants.filter(restaurant => {
            if (!restaurant.coordinates) return false;

            const distance = calculateDistance(
                restaurant.coordinates.latitude,
                restaurant.coordinates.longitude,
                addressCoordinates.latitude,
                addressCoordinates.longitude
            );

            // Assuming max delivery distance is 15 km
            return distance <= 15;
        });

        return {
            success: true,
            in_zone: true,
            zone_name: zoneCheck.zone_name,
            restaurants: availableRestaurants.map(r => ({
                id: r._id,
                name: r.name,
                delivery_cost: r.delivery_cost,
                estimated_time: r.estimated_time
            }))
        };
    } catch (error) {
        console.error("Error finding delivery restaurants:", error);
        return {
            success: false,
            message: "Error finding restaurants",
            error: error.message
        };
    }
}

/**
 * Creates a new delivery zone (Admin only)
 */
async function createDeliveryZone(zoneData) {
    try {
        if (!zoneData.name || !zoneData.type) {
            return {
                success: false,
                message: "Zone name and type are required"
            };
        }

        const zone = new Zone({
            name: zoneData.name,
            type: zoneData.type, // 'circular' or 'polygon'
            description: zoneData.description || "",
            center: zoneData.center, // For circular zones
            radius: zoneData.radius, // For circular zones
            polygon: zoneData.polygon, // For polygon zones
            status: "Active"
        });

        await zone.save();

        return {
            success: true,
            message: "Delivery zone created",
            zone: {
                id: zone._id,
                name: zone.name,
                type: zone.type
            }
        };
    } catch (error) {
        console.error("Error creating zone:", error);
        return {
            success: false,
            message: "Error creating zone",
            error: error.message
        };
    }
}

module.exports = {
    isAddressInDeliveryZone,
    isCoordinateInZone,
    isPointInPolygon,
    getActiveZones,
    findDeliveryRestaurants,
    createDeliveryZone
};
