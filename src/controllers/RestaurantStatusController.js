/**
 * Restaurant Management Controller
 * Handles restaurant status, opening/closing, and schedules
 */

const Restaurant = require("../models/Restaurants");
const Branch = require("../models/Branch");
const Order = require("../models/Orders");
const { ORDER_STATUS } = require("../models/Orders");
const cron = require('node-cron');

/**
 * Gets restaurant status
 */
module.exports.getRestaurantStatus = async (req, res) => {
    try {
        const { restaurantId } = req.params;

        const restaurant = await Restaurant.findById(restaurantId)
            .select('name is_closed opening_time closing_time delivery_cost coordinates');

        if (!restaurant) {
            return res.status(404).json({ message: "Restaurant not found" });
        }

        // Check if restaurant is currently open
        const isOpen = isRestaurantOpen(restaurant);

        return res.json({
            restaurant: {
                id: restaurant._id,
                name: restaurant.name,
                is_closed: restaurant.is_closed,
                is_open_now: isOpen && !restaurant.is_closed,
                opening_time: restaurant.opening_time,
                closing_time: restaurant.closing_time,
                delivery_cost: restaurant.delivery_cost
            }
        });
    } catch (error) {
        console.error("Error getting restaurant status:", error);
        return res.status(500).json({ message: "Error getting restaurant status", error: error.message });
    }
};

/**
 * Manually closes a restaurant
 */
module.exports.closeRestaurant = async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { reason } = req.body;

        const restaurant = await Restaurant.findByIdAndUpdate(
            restaurantId,
            { is_closed: true },
            { new: true }
        );

        if (!restaurant) {
            return res.status(404).json({ message: "Restaurant not found" });
        }

        // Reject pending orders
        if (reason && reason.toLowerCase().includes('close')) {
            await Order.updateMany(
                {
                    "orders.restaurant_id": restaurantId,
                    order_status: { $in: [ORDER_STATUS.WAITING_FOR_APPROVAL, ORDER_STATUS.APPROVED_PREPARING] }
                },
                {
                    order_status: ORDER_STATUS.CANCELED,
                    status: ORDER_STATUS.CANCELED, // Sync legacy status
                    cancellation_reason: reason || 'Restaurant closed',
                    canceled_by: 'Restaurant',
                    canceled_at: new Date()
                }
            );
        }

        return res.json({
            message: "Restaurant closed successfully",
            restaurant: {
                id: restaurant._id,
                name: restaurant.name,
                is_closed: restaurant.is_closed
            }
        });
    } catch (error) {
        console.error("Error closing restaurant:", error);
        return res.status(500).json({ message: "Error closing restaurant", error: error.message });
    }
};

/**
 * Reopens a closed restaurant
 */
module.exports.openRestaurant = async (req, res) => {
    try {
        const { restaurantId } = req.params;

        const restaurant = await Restaurant.findByIdAndUpdate(
            restaurantId,
            { is_closed: false },
            { new: true }
        );

        if (!restaurant) {
            return res.status(404).json({ message: "Restaurant not found" });
        }

        return res.json({
            message: "Restaurant reopened successfully",
            restaurant: {
                id: restaurant._id,
                name: restaurant.name,
                is_closed: restaurant.is_closed
            }
        });
    } catch (error) {
        console.error("Error opening restaurant:", error);
        return res.status(500).json({ message: "Error opening restaurant", error: error.message });
    }
};

/**
 * Sets restaurant operating hours
 */
module.exports.setOperatingHours = async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { opening_time, closing_time } = req.body;

        if (!opening_time || !closing_time) {
            return res.status(400).json({ message: "Opening and closing times are required" });
        }

        // Validate time format (HH:MM)
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(opening_time) || !timeRegex.test(closing_time)) {
            return res.status(400).json({ message: "Invalid time format. Use HH:MM" });
        }

        const restaurant = await Restaurant.findByIdAndUpdate(
            restaurantId,
            { opening_time, closing_time },
            { new: true }
        );

        if (!restaurant) {
            return res.status(404).json({ message: "Restaurant not found" });
        }

        return res.json({
            message: "Operating hours updated successfully",
            restaurant: {
                id: restaurant._id,
                opening_time: restaurant.opening_time,
                closing_time: restaurant.closing_time
            }
        });
    } catch (error) {
        console.error("Error setting operating hours:", error);
        return res.status(500).json({ message: "Error setting operating hours", error: error.message });
    }
};

/**
 * Gets restaurant operating schedule
 */
module.exports.getOperatingSchedule = async (req, res) => {
    try {
        const { restaurantId } = req.params;

        const restaurant = await Restaurant.findById(restaurantId)
            .select('opening_time closing_time is_closed');

        if (!restaurant) {
            return res.status(404).json({ message: "Restaurant not found" });
        }

        const isOpen = isRestaurantOpen(restaurant);
        const now = new Date();
        const [openHour, openMin] = restaurant.opening_time?.split(':') || [0, 0];
        const [closeHour, closeMin] = restaurant.closing_time?.split(':') || [0, 0];

        const openingTime = new Date();
        openingTime.setHours(parseInt(openHour), parseInt(openMin), 0);

        const closingTime = new Date();
        closingTime.setHours(parseInt(closeHour), parseInt(closeMin), 0);

        // If closing time is before opening time, assume it's next day
        if (closingTime < openingTime) {
            closingTime.setDate(closingTime.getDate() + 1);
        }

        return res.json({
            restaurant: {
                id: restaurantId,
                is_closed: restaurant.is_closed,
                is_open_now: isOpen && !restaurant.is_closed,
                operating_hours: {
                    opens_at: restaurant.opening_time,
                    closes_at: restaurant.closing_time,
                    next_opening: openingTime > now ? openingTime : new Date(openingTime.getTime() + 86400000),
                    next_closing: closingTime > now ? closingTime : new Date(closingTime.getTime() + 86400000)
                }
            }
        });
    } catch (error) {
        console.error("Error getting operating schedule:", error);
        return res.status(500).json({ message: "Error getting operating schedule", error: error.message });
    }
};

/**
 * Schedules automatic opening and closing
 */
module.exports.scheduleAutoOpenClose = async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { opening_time, closing_time } = req.body;

        if (!opening_time || !closing_time) {
            return res.status(400).json({ message: "Opening and closing times are required" });
        }

        const restaurant = await Restaurant.findByIdAndUpdate(
            restaurantId,
            { opening_time, closing_time },
            { new: true }
        );

        if (!restaurant) {
            return res.status(404).json({ message: "Restaurant not found" });
        }

        // Schedule cron jobs for automatic opening/closing
        // This would typically be done on server startup
        scheduleRestaurantHours(restaurant);

        return res.json({
            message: "Auto schedule configured",
            restaurant: {
                id: restaurant._id,
                opening_time: restaurant.opening_time,
                closing_time: restaurant.closing_time
            }
        });
    } catch (error) {
        console.error("Error scheduling auto open/close:", error);
        return res.status(500).json({ message: "Error scheduling auto open/close", error: error.message });
    }
};

/**
 * Validates that orders can be placed at this restaurant
 */
module.exports.validateOrderPlacement = async (req, res) => {
    try {
        const { restaurantId } = req.params;

        const restaurant = await Restaurant.findById(restaurantId)
            .select('is_closed opening_time closing_time');

        if (!restaurant) {
            return res.status(404).json({ message: "Restaurant not found" });
        }

        if (restaurant.is_closed) {
            return res.status(400).json({
                valid: false,
                message: "Restaurant is currently closed",
                reason: "manual_closure"
            });
        }

        const isOpen = isRestaurantOpen(restaurant);
        if (!isOpen) {
            return res.status(400).json({
                valid: false,
                message: "Restaurant is not open at this time",
                reason: "outside_operating_hours",
                operating_hours: {
                    opens_at: restaurant.opening_time,
                    closes_at: restaurant.closing_time
                }
            });
        }

        return res.json({
            valid: true,
            message: "Restaurant is open and accepting orders"
        });
    } catch (error) {
        console.error("Error validating order placement:", error);
        return res.status(500).json({ message: "Error validating order placement", error: error.message });
    }
};

/**
 * Helper function to check if restaurant is open
 */
function isRestaurantOpen(restaurant) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTime = currentHour * 60 + currentMin;

    const [openHour, openMin] = (restaurant.opening_time || '00:00').split(':').map(Number);
    const [closeHour, closeMin] = (restaurant.closing_time || '23:59').split(':').map(Number);

    const openingTime = openHour * 60 + openMin;
    const closingTime = closeHour * 60 + closeMin;

    // Simple case: opening time is before closing time (same day)
    if (openingTime < closingTime) {
        return currentTime >= openingTime && currentTime <= closingTime;
    }
    // Complex case: closing time is next day (e.g., 23:00 to 02:00)
    else {
        return currentTime >= openingTime || currentTime <= closingTime;
    }
}

/**
 * Schedules automatic opening/closing for a restaurant
 */
function scheduleRestaurantHours(restaurant) {
    const [openHour, openMin] = (restaurant.opening_time || '00:00').split(':');
    const [closeHour, closeMin] = (restaurant.closing_time || '23:59').split(':');

    // Schedule opening
    const openCron = `${openMin} ${openHour} * * *`;
    cron.schedule(openCron, async () => {
        try {
            await Restaurant.findByIdAndUpdate(restaurant._id, { is_closed: false });
            console.log(`✅ Restaurant ${restaurant.name} automatically opened`);
        } catch (error) {
            console.error(`Error auto-opening restaurant:`, error);
        }
    }, { scheduled: true });

    // Schedule closing
    const closeCron = `${closeMin} ${closeHour} * * *`;
    cron.schedule(closeCron, async () => {
        try {
            // Mark restaurant as closed
            await Restaurant.findByIdAndUpdate(restaurant._id, { is_closed: true });

            // Cancel pending orders
            await Order.updateMany(
                {
                    "orders.restaurant_id": restaurant._id,
                    order_status: { $in: [ORDER_STATUS.WAITING_FOR_APPROVAL, ORDER_STATUS.APPROVED_PREPARING] }
                },
                {
                    order_status: ORDER_STATUS.CANCELED,
                    status: ORDER_STATUS.CANCELED, // Sync legacy status
                    cancellation_reason: 'Restaurant closed for the day',
                    canceled_by: 'Restaurant',
                    canceled_at: new Date()
                }
            );

            console.log(`🔒 Restaurant ${restaurant.name} automatically closed`);
        } catch (error) {
            console.error(`Error auto-closing restaurant:`, error);
        }
    }, { scheduled: true });
}

/**
 * Handles orders placed just before closing
 */
module.exports.handleLastMinuteOrders = async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { minutesBeforeClosing = 15 } = req.body;

        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) {
            return res.status(404).json({ message: "Restaurant not found" });
        }

        const [closeHour, closeMin] = (restaurant.closing_time || '23:59').split(':').map(Number);
        const closingTime = new Date();
        closingTime.setHours(closeHour, closeMin, 0);

        const cutoffTime = new Date(closingTime.getTime() - minutesBeforeClosing * 60000);

        return res.json({
            message: "Last-minute order settings configured",
            settings: {
                closing_time: restaurant.closing_time,
                order_cutoff_time: `${cutoffTime.getHours()}:${String(cutoffTime.getMinutes()).padStart(2, '0')}`,
                minutes_before_closing: minutesBeforeClosing
            }
        });
    } catch (error) {
        console.error("Error handling last-minute orders:", error);
        return res.status(500).json({ message: "Error handling last-minute orders", error: error.message });
    }
};

module.exports.isRestaurantOpen = isRestaurantOpen;
module.exports.scheduleRestaurantHours = scheduleRestaurantHours;
