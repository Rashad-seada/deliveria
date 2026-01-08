/**
 * Order Utilities
 * General utilities for order operations
 */

const Order = require("../models/Orders");
const Restaurant = require("../models/Restaurants");
const User = require("../models/Users");
const { addOrderPoints } = require("./pointsSystem");

/**
 * Gets user's order history with filters
 */
async function getUserOrderHistory(userId, page = 1, limit = 10, filters = {}) {
    try {
        const skip = (page - 1) * limit;

        let query = { user_id: userId };

        // Add status filter if provided
        if (filters.status) {
            query.order_status = filters.status;
        }

        // Add date filter if provided
        if (filters.startDate || filters.endDate) {
            query.createdAt = {};
            if (filters.startDate) {
                query.createdAt.$gte = new Date(filters.startDate);
            }
            if (filters.endDate) {
                query.createdAt.$lte = new Date(filters.endDate);
            }
        }

        // Add restaurant filter if provided
        if (filters.restaurantId) {
            query['orders.restaurant_id'] = filters.restaurantId;
        }

        const orders = await Order.find(query)
            .populate('orders.restaurant_id', 'name logo')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Order.countDocuments(query);

        return {
            success: true,
            orders: orders.map(order => ({
                id: order._id,
                order_id: order.order_id,
                status: order.order_status,
                total: order.final_price,
                restaurants_count: order.orders.length,
                created_at: order.createdAt,
                delivery_status: order.delivery_details?.estimated_arrival
            })),
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        console.error("Error getting order history:", error);
        return {
            success: false,
            message: "Error fetching order history",
            error: error.message
        };
    }
}

/**
 * Rates an order
 */
async function rateOrder(orderId, userId, rating, comment = "") {
    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return { success: false, message: "Order not found" };
        }

        // Verify user owns this order
        if (order.user_id && order.user_id.toString() !== userId) {
            return { success: false, message: "Not authorized to rate this order" };
        }

        // Check if already rated
        if (order.rating?.score) {
            return { success: false, message: "Order already rated" };
        }

        // Validate rating
        if (rating < 1 || rating > 5) {
            return { success: false, message: "Rating must be between 1 and 5" };
        }

        order.rating = {
            score: rating,
            comment: comment.trim(),
            rated_at: new Date()
        };

        await order.save();

        return {
            success: true,
            message: "Order rated successfully",
            rating: order.rating
        };
    } catch (error) {
        console.error("Error rating order:", error);
        return {
            success: false,
            message: "Error rating order",
            error: error.message
        };
    }
}

/**
 * Calculates order summary statistics
 */
async function getOrderSummary(userId) {
    try {
        const orders = await Order.find({ user_id: userId });

        if (orders.length === 0) {
            return {
                success: true,
                summary: {
                    total_orders: 0,
                    total_spent: 0,
                    average_order_value: 0,
                    completed_orders: 0,
                    canceled_orders: 0,
                    pending_orders: 0,
                    last_order_date: null
                }
            };
        }

        const completed = orders.filter(o => o.order_status === 'Delivered').length;
        const canceled = orders.filter(o => o.order_status === 'Canceled').length;
        const pending = orders.length - completed - canceled;
        const totalSpent = orders.reduce((sum, o) => sum + (o.final_price || 0), 0);

        return {
            success: true,
            summary: {
                total_orders: orders.length,
                total_spent: Math.round(totalSpent * 100) / 100,
                average_order_value: Math.round((totalSpent / orders.length) * 100) / 100,
                completed_orders: completed,
                canceled_orders: canceled,
                pending_orders: pending,
                success_rate: `${Math.round((completed / orders.length) * 100)}%`,
                last_order_date: orders[0]?.createdAt
            }
        };
    } catch (error) {
        console.error("Error getting order summary:", error);
        return {
            success: false,
            message: "Error getting order summary",
            error: error.message
        };
    }
}

/**
 * Completes order (after delivery) and processes points
 */
async function completeOrder(orderId, deliveredAt = null) {
    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return { success: false, message: "Order not found" };
        }

        // Update status
        order.order_status = 'Delivered';
        if (deliveredAt) {
            order.delivery_details.delivery_time = (new Date(deliveredAt) - new Date(order.createdAt)) / 60000; // in minutes
        }

        // Add status to timeline
        order.status_timeline.push({
            status: 'Delivered',
            timestamp: deliveredAt ? new Date(deliveredAt) : new Date(),
            note: 'Order delivered successfully'
        });

        await order.save();

        // Award points to user (if registered)
        if (order.user_id) {
            const pointsResult = await addOrderPoints(order.user_id, order.final_price);
            console.log(`[Order Utils] Points awarded for order #${order.order_id}:`, pointsResult);
        }

        return {
            success: true,
            message: "Order marked as delivered",
            order: {
                order_id: order.order_id,
                status: order.order_status,
                delivery_time: order.delivery_details?.delivery_time
            }
        };
    } catch (error) {
        console.error("Error completing order:", error);
        return {
            success: false,
            message: "Error completing order",
            error: error.message
        };
    }
}

/**
 * Gets orders for dashboard/analytics
 */
async function getOrdersForAnalytics(filters = {}) {
    try {
        let query = {};

        // Date range filter
        if (filters.startDate || filters.endDate) {
            query.createdAt = {};
            if (filters.startDate) {
                query.createdAt.$gte = new Date(filters.startDate);
            }
            if (filters.endDate) {
                query.createdAt.$lte = new Date(filters.endDate);
            }
        }

        // Status filter
        if (filters.status) {
            query.order_status = filters.status;
        }

        // Restaurant filter
        if (filters.restaurantId) {
            query['orders.restaurant_id'] = filters.restaurantId;
        }

        const orders = await Order.find(query)
            .populate('user_id', 'first_name last_name')
            .populate('orders.restaurant_id', 'name');

        return {
            success: true,
            total: orders.length,
            orders
        };
    } catch (error) {
        console.error("Error getting orders for analytics:", error);
        return {
            success: false,
            message: "Error fetching orders",
            error: error.message
        };
    }
}

module.exports = {
    getUserOrderHistory,
    rateOrder,
    getOrderSummary,
    completeOrder,
    getOrdersForAnalytics
};
