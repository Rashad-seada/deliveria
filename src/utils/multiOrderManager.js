/**
 * Multi-Order Manager
 * Handles logic for multi-restaurant orders (Multi-order)
 * - Manages order acceptance from multiple restaurants
 * - Handles agent capacity constraints for multi-orders
 * - Manages order visibility when restaurants accept
 */

const Order = require("../models/Orders");
const Restaurant = require("../models/Restaurants");
const { sendNotification } = require("../controllers/global");

/**
 * Gets count of multi-orders assigned to agent
 */
async function getAgentMultiOrderCount(agentId) {
    const multiOrders = await Order.find({
        "agent.agent_id": agentId,
        order_type: "Multi",
        order_status: { $nin: ["Delivered", "Canceled"] }
    });
    return multiOrders.length;
}

/**
 * Validates if agent can accept order based on multi-order constraints
 * Rules:
 * - Multi-order = 2 single orders equivalent
 * - Agent can carry max 1 multi-order at a time
 * - Must check current capacity
 */
async function canAgentAcceptMultiOrder(agentId, orderType) {
    if (orderType !== "Multi") {
        return { allowed: true, reason: "" };
    }

    const multiOrderCount = await getAgentMultiOrderCount(agentId);

    if (multiOrderCount >= 1) {
        return {
            allowed: false,
            reason: "Agent already has 1 multi-order. Cannot accept more than 1 multi-order at a time."
        };
    }

    return { allowed: true, reason: "" };
}

/**
 * Gets restaurants involved in multi-order
 */
async function getMultiOrderRestaurants(orderId) {
    const order = await Order.findById(orderId).select('orders.restaurant_id');
    if (!order) return [];
    return order.orders.map(o => o.restaurant_id);
}

/**
 * Handles restaurant acceptance in multi-order
 * When one restaurant accepts:
 * 1. Update that sub-order status
 * 2. Hide order from other restaurants
 * 3. Notify other restaurants that order was accepted elsewhere
 */
async function handleMultiOrderRestaurantAcceptance(orderId, acceptingRestaurantId) {
    try {
        const order = await Order.findById(orderId);
        if (!order || order.order_type !== "Multi") {
            return { success: false, message: "Order not found or not a multi-order" };
        }

        // Find the accepting restaurant's sub-order
        const acceptingSubOrder = order.orders.find(
            o => o.restaurant_id.toString() === acceptingRestaurantId.toString()
        );

        if (!acceptingSubOrder) {
            return { success: false, message: "Restaurant not found in this order" };
        }

        // Update accepting restaurant's sub-order status
        acceptingSubOrder.status = "Approved / Preparing";
        acceptingSubOrder.notification_sent = true;

        // Mark other restaurants' sub-orders as canceled (order accepted elsewhere)
        const otherRestaurants = [];
        for (const subOrder of order.orders) {
            if (!subOrder.restaurant_id.equals(acceptingRestaurantId)) {
                const restId = subOrder.restaurant_id;
                otherRestaurants.push(restId);
                subOrder.status = "Canceled";
                subOrder.cancel_me = true;
            }
        }

        await order.save();

        // Notify other restaurants
        if (otherRestaurants.length > 0) {
            const message = `Order #${order.order_id} was accepted by another restaurant. This order is no longer available for you.`;
            await sendNotification(otherRestaurants, order.user_id, message);
        }

        // Notify customer
        await sendNotification(
            [order.user_id],
            acceptingRestaurantId,
            `Order #${order.order_id} accepted by restaurant. Your order is being prepared!`
        );

        return {
            success: true,
            message: "Order accepted successfully",
            order
        };
    } catch (error) {
        console.error("Error in handleMultiOrderRestaurantAcceptance:", error);
        return {
            success: false,
            message: "Error processing acceptance",
            error: error.message
        };
    }
}

/**
 * Calculates equivalent order count for capacity checking
 * Multi-order = 2 single orders
 */
function calculateOrderEquivalent(orderType) {
    return orderType === "Multi" ? 2 : 1;
}

/**
 * Checks if pending multi-order should be visible to restaurant
 * Multi-order is visible only if:
 * 1. It hasn't been accepted by another restaurant
 * 2. The restaurant hasn't already canceled their part
 */
function isMultiOrderVisibleToRestaurant(order, restaurantId) {
    if (order.order_type !== "Multi") {
        return true;
    }

    const subOrder = order.orders.find(
        o => o.restaurant_id.toString() === restaurantId.toString()
    );

    if (!subOrder) return false;

    // Hide if already canceled or if another restaurant already accepted
    if (subOrder.cancel_me || subOrder.status.includes("Canceled")) {
        return false;
    }

    // Check if any other restaurant has already accepted
    const otherAccepted = order.orders.some(
        o => !o.restaurant_id.equals(restaurantId) &&
             !o.status.includes("Canceled") &&
             o.status !== "Waiting for Approval"
    );

    return !otherAccepted;
}

module.exports = {
    getAgentMultiOrderCount,
    canAgentAcceptMultiOrder,
    getMultiOrderRestaurants,
    handleMultiOrderRestaurantAcceptance,
    calculateOrderEquivalent,
    isMultiOrderVisibleToRestaurant
};
