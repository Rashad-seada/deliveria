/**
 * Restaurant Closure Manager
 * Handles restaurant closure logic while allowing users to view menus
 */

const Restaurant = require("../models/Restaurants");
const { checkIsOpen } = require("../controllers/global");

/**
 * Checks if restaurant is open
 * Users can view menu but cannot place order if closed
 */
async function isRestaurantOpen(restaurantId) {
    try {
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) {
            return { open: false, message: "Restaurant not found" };
        }

        const isOpen = checkIsOpen(restaurant.open_hour, restaurant.close_hour);
        
        return {
            open: isOpen,
            restaurant_name: restaurant.name,
            open_hour: restaurant.open_hour,
            close_hour: restaurant.close_hour,
            status: restaurant.status,
            message: isOpen ? "Restaurant is open" : "Restaurant is currently closed"
        };
    } catch (error) {
        console.error("Error checking restaurant status:", error);
        return {
            open: false,
            message: "Error checking restaurant status",
            error: error.message
        };
    }
}

/**
 * Validates if order can be placed to restaurant
 * Returns false if restaurant is closed
 */
async function canPlaceOrderToRestaurant(restaurantId) {
    try {
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) {
            return { allowed: false, message: "Restaurant not found" };
        }

        // Check if restaurant is open
        const isOpen = checkIsOpen(restaurant.open_hour, restaurant.close_hour);
        if (!isOpen) {
            return {
                allowed: false,
                message: `Restaurant is closed. Open from ${restaurant.open_hour} to ${restaurant.close_hour}`
            };
        }

        // Check if restaurant is active
        if (restaurant.status !== "Active") {
            return {
                allowed: false,
                message: `Restaurant is currently ${restaurant.status.toLowerCase()}`
            };
        }

        // Check minimum order value
        return {
            allowed: true,
            message: "Order can be placed",
            minimum_order_value: restaurant.minimum_order_value || 0
        };
    } catch (error) {
        console.error("Error validating order placement:", error);
        return {
            allowed: false,
            message: "Error validating restaurant status",
            error: error.message
        };
    }
}

/**
 * Gets restaurant status information
 * Shows opening/closing times and current status
 */
async function getRestaurantStatus(restaurantId) {
    try {
        const restaurant = await Restaurant.findById(restaurantId).select(
            'name status open_hour close_hour is_open minimum_order_value estimated_time'
        );

        if (!restaurant) {
            return { success: false, message: "Restaurant not found" };
        }

        const isOpen = checkIsOpen(restaurant.open_hour, restaurant.close_hour);

        return {
            success: true,
            status: {
                name: restaurant.name,
                is_open: isOpen,
                admin_status: restaurant.status,
                open_hour: restaurant.open_hour,
                close_hour: restaurant.close_hour,
                minimum_order_value: restaurant.minimum_order_value || 0,
                estimated_delivery_time: restaurant.estimated_time,
                can_order: isOpen && restaurant.status === "Active"
            }
        };
    } catch (error) {
        console.error("Error getting restaurant status:", error);
        return {
            success: false,
            message: "Error getting restaurant status",
            error: error.message
        };
    }
}

/**
 * Toggles restaurant closure by admin
 * When closed: users can view menu but cannot order
 */
async function toggleRestaurantStatus(restaurantId, newStatus) {
    try {
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) {
            return { success: false, message: "Restaurant not found" };
        }

        // newStatus should be one of: "Active", "Inactive", "Suspended"
        if (!["Active", "Inactive", "Suspended"].includes(newStatus)) {
            return {
                success: false,
                message: "Invalid status. Must be: Active, Inactive, or Suspended"
            };
        }

        restaurant.status = newStatus;
        restaurant.is_open = newStatus === "Active" && checkIsOpen(restaurant.open_hour, restaurant.close_hour);
        
        await restaurant.save();

        return {
            success: true,
            message: `Restaurant status changed to ${newStatus}`,
            restaurant: {
                id: restaurant._id,
                name: restaurant.name,
                status: restaurant.status,
                is_open: restaurant.is_open
            }
        };
    } catch (error) {
        console.error("Error toggling restaurant status:", error);
        return {
            success: false,
            message: "Error updating restaurant status",
            error: error.message
        };
    }
}

/**
 * Updates restaurant opening/closing hours
 */
async function updateRestaurantHours(restaurantId, openHour, closeHour) {
    try {
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) {
            return { success: false, message: "Restaurant not found" };
        }

        // Validate time format (HH:mm)
        const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
        if (!timeRegex.test(openHour) || !timeRegex.test(closeHour)) {
            return {
                success: false,
                message: "Invalid time format. Please use HH:mm"
            };
        }

        restaurant.open_hour = openHour;
        restaurant.close_hour = closeHour;
        restaurant.is_open = checkIsOpen(openHour, closeHour);

        await restaurant.save();

        return {
            success: true,
            message: "Restaurant hours updated successfully",
            hours: {
                open_hour: openHour,
                close_hour: closeHour,
                currently_open: restaurant.is_open
            }
        };
    } catch (error) {
        console.error("Error updating restaurant hours:", error);
        return {
            success: false,
            message: "Error updating hours",
            error: error.message
        };
    }
}

module.exports = {
    isRestaurantOpen,
    canPlaceOrderToRestaurant,
    getRestaurantStatus,
    toggleRestaurantStatus,
    updateRestaurantHours
};
