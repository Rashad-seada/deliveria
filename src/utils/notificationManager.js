/**
 * Notification Manager
 * Enhanced notification system with customizable messages and event triggers
 */

const Notification = require("../models/Notifications");
const Order = require("../models/Orders");
const User = require("../models/Users");

/**
 * Notification Types & Templates
 */
const NOTIFICATION_TEMPLATES = {
    ORDER_CREATED: {
        title: "Order Confirmed",
        messageTemplate: "Order #{orderId} has been created successfully. Estimated delivery: {time} minutes.",
        type: "ORDER_STATUS"
    },
    ORDER_APPROVED: {
        title: "Order Approved",
        messageTemplate: "Order #{orderId} has been approved and is being prepared.",
        type: "ORDER_STATUS"
    },
    ORDER_READY: {
        title: "Order Ready",
        messageTemplate: "Order #{orderId} is ready for pickup/delivery.",
        type: "ORDER_STATUS"
    },
    ORDER_ON_WAY: {
        title: "Order On The Way",
        messageTemplate: "Your order #{orderId} is on the way! Agent will arrive in approximately {time} minutes.",
        type: "ORDER_STATUS"
    },
    ORDER_DELIVERED: {
        title: "Order Delivered",
        messageTemplate: "Order #{orderId} has been delivered. Thank you for your order!",
        type: "ORDER_STATUS"
    },
    ORDER_CANCELED: {
        title: "Order Canceled",
        messageTemplate: "Order #{orderId} has been canceled. Reason: {reason}",
        type: "ORDER_STATUS"
    },
    ORDER_DELAYED: {
        title: "Order Delayed",
        messageTemplate: "Order #{orderId} is taking longer than expected. We apologize for the delay.",
        type: "ALERT"
    },
    RESTAURANT_DELAY: {
        title: "Restaurant Notification",
        messageTemplate: "Order #{orderId} has been pending for more than {minutes} minutes. Please respond.",
        type: "URGENT"
    },
    OFFER_ELIGIBLE: {
        title: "New Offer Available",
        messageTemplate: "Great news! You're eligible for a {discount}% discount offer. Limited time!",
        type: "PROMOTIONAL"
    },
    POINTS_EARNED: {
        title: "Points Earned",
        messageTemplate: "You've earned {points} loyalty points! Total: {totalPoints} points.",
        type: "REWARD"
    },
    COUPON_ELIGIBLE: {
        title: "Claim Your Reward",
        messageTemplate: "You've earned enough points for a discount coupon! Redeem now for {discount}% off.",
        type: "REWARD"
    },
    AGENT_ASSIGNED: {
        title: "Agent Assigned",
        messageTemplate: "Agent is preparing to deliver your order #{orderId}.",
        type: "ORDER_STATUS"
    }
};

/**
 * Sends enhanced notification with template
 * @param {string|string[]} recipientIds - User IDs to notify
 * @param {string} senderId - Sender ID (restaurant, admin, or system)
 * @param {string} templateKey - Template key from NOTIFICATION_TEMPLATES
 * @param {object} variables - Variables to replace in template
 */
async function sendTemplateNotification(recipientIds, senderId, templateKey, variables = {}) {
    try {
        const template = NOTIFICATION_TEMPLATES[templateKey];
        if (!template) {
            console.error(`Template ${templateKey} not found`);
            return { success: false, message: "Template not found" };
        }

        // Replace variables in message
        let message = template.messageTemplate;
        Object.keys(variables).forEach(key => {
            message = message.replace(`{${key}}`, variables[key]);
        });

        // Ensure recipientIds is an array
        const recipients = Array.isArray(recipientIds) ? recipientIds : [recipientIds];

        // Send notifications
        const notifications = recipients.map(recipientId => ({
            user_id: recipientId,
            sender_id: senderId,
            message,
            title: template.title,
            type: template.type,
            seen: false
        }));

        await Notification.insertMany(notifications);

        console.log(`[Notification] Sent ${templateKey} to ${recipients.length} users`);

        return {
            success: true,
            sentTo: recipients.length,
            message: template.messageTemplate
        };
    } catch (error) {
        console.error("Error sending template notification:", error);
        return {
            success: false,
            message: "Error sending notification",
            error: error.message
        };
    }
}

/**
 * Sends order status update notifications
 */
async function notifyOrderStatusUpdate(orderId, newStatus, additionalInfo = {}) {
    try {
        const order = await Order.findById(orderId).populate('user_id');
        if (!order) {
            return { success: false, message: "Order not found" };
        }

        const statusTemplateMap = {
            "Waiting for Approval": "ORDER_CREATED",
            "Approved / Preparing": "ORDER_APPROVED",
            "Packed / Ready for Pickup": "ORDER_READY",
            "On the Way": "ORDER_ON_WAY",
            "Delivered": "ORDER_DELIVERED",
            "Canceled": "ORDER_CANCELED"
        };

        const templateKey = statusTemplateMap[newStatus];
        if (!templateKey) {
            return { success: false, message: "Unknown status" };
        }

        const variables = {
            orderId: order.order_id,
            time: additionalInfo.estimatedTime || "30",
            reason: additionalInfo.reason || "No reason provided"
        };

        return await sendTemplateNotification(
            [order.user_id._id],
            additionalInfo.senderId || null,
            templateKey,
            variables
        );
    } catch (error) {
        console.error("Error notifying order status:", error);
        return {
            success: false,
            message: "Error sending status notification",
            error: error.message
        };
    }
}

/**
 * Sends delay notification to user
 */
async function notifyOrderDelay(orderId, minutesPassed) {
    try {
        const order = await Order.findById(orderId).populate('user_id');
        if (!order) {
            return { success: false, message: "Order not found" };
        }

        return await sendTemplateNotification(
            [order.user_id._id],
            null,
            "ORDER_DELAYED",
            {
                orderId: order.order_id
            }
        );
    } catch (error) {
        console.error("Error notifying delay:", error);
        return {
            success: false,
            message: "Error sending delay notification",
            error: error.message
        };
    }
}

/**
 * Sends restaurant delay notification
 */
async function notifyRestaurantDelay(orderId, restaurantId, minutesPassed) {
    try {
        return await sendTemplateNotification(
            [restaurantId],
            null,
            "RESTAURANT_DELAY",
            {
                orderId: orderId,
                minutes: minutesPassed
            }
        );
    } catch (error) {
        console.error("Error notifying restaurant:", error);
        return {
            success: false,
            message: "Error sending restaurant notification",
            error: error.message
        };
    }
}

/**
 * Gets unread notifications count for user
 */
async function getUnreadNotificationCount(userId) {
    try {
        const count = await Notification.countDocuments({
            user_id: userId,
            seen: false
        });
        return { success: true, count };
    } catch (error) {
        console.error("Error getting unread count:", error);
        return { success: false, count: 0, error: error.message };
    }
}

/**
 * Marks notifications as read
 */
async function markNotificationsAsRead(userId, notificationIds = null) {
    try {
        if (notificationIds && notificationIds.length > 0) {
            // Mark specific notifications
            await Notification.updateMany(
                { _id: { $in: notificationIds }, user_id: userId },
                { seen: true }
            );
        } else {
            // Mark all notifications for user
            await Notification.updateMany(
                { user_id: userId },
                { seen: true }
            );
        }
        return { success: true, message: "Notifications marked as read" };
    } catch (error) {
        console.error("Error marking as read:", error);
        return { success: false, message: "Error marking notifications", error: error.message };
    }
}

/**
 * Gets paginated notifications for user
 */
async function getUserNotifications(userId, page = 1, limit = 10) {
    try {
        const skip = (page - 1) * limit;

        const notifications = await Notification.find({ user_id: userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Notification.countDocuments({ user_id: userId });

        return {
            success: true,
            notifications,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        console.error("Error getting user notifications:", error);
        return {
            success: false,
            message: "Error fetching notifications",
            error: error.message
        };
    }
}

module.exports = {
    NOTIFICATION_TEMPLATES,
    sendTemplateNotification,
    notifyOrderStatusUpdate,
    notifyOrderDelay,
    notifyRestaurantDelay,
    getUnreadNotificationCount,
    markNotificationsAsRead,
    getUserNotifications
};
