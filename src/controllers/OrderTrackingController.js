/**
 * Order Tracking Controller
 * Handles order status tracking, updates, and state machine transitions
 */

const Order = require("../models/Orders");
const { 
    isValidTransition, 
    getAvailableTransitions, 
    createStatusTimelineEntry,
    canCancelOrder,
    ORDER_STATES 
} = require("../utils/orderStateMachine");
const { sendNotification } = require("./global");

/**
 * Gets order details for customer or admin
 */
module.exports.getOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.decoded?.id;

        const order = await Order.findById(orderId)
            .populate('user_id', 'first_name last_name phone email')
            .populate('orders.restaurant_id', 'name logo')
            .populate('agent.agent_id', 'first_name last_name phone');

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Access control: customer can only see their orders
        if (userId && order.user_id && order.user_id._id.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        return res.json({ order });
    } catch (error) {
        console.error("Error fetching order details:", error);
        return res.status(500).json({ message: "Error fetching order details", error: error.message });
    }
};

/**
 * Gets order tracking timeline
 */
module.exports.getOrderTracking = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findById(orderId).select('order_id order_status status_timeline agent delivery_details');

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        return res.json({
            order_id: order.order_id,
            current_status: order.order_status,
            timeline: order.status_timeline,
            agent: order.agent,
            delivery_details: order.delivery_details,
            available_actions: getAvailableTransitions(order.order_status)
        });
    } catch (error) {
        console.error("Error fetching order tracking:", error);
        return res.status(500).json({ message: "Error fetching order tracking", error: error.message });
    }
};

/**
 * Updates order status with state machine validation
 */
module.exports.updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { newStatus, note, updated_by } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        const currentStatus = order.order_status;

        // Validate transition
        if (!isValidTransition(currentStatus, newStatus)) {
            const available = getAvailableTransitions(currentStatus);
            return res.status(400).json({
                message: `Cannot transition from ${currentStatus} to ${newStatus}`,
                current_status: currentStatus,
                available_transitions: available
            });
        }

        // Update status
        order.order_status = newStatus;
        order.status_timeline.push(createStatusTimelineEntry(newStatus, note || "", updated_by));

        // Handle sub-order statuses
        if (order.orders) {
            order.orders.forEach(subOrder => {
                if (isValidTransition(subOrder.status, newStatus)) {
                    subOrder.status = newStatus;
                }
            });
        }

        await order.save();

        // Send notification to customer
        if (order.user_id) {
            await sendNotification(
                [order.user_id],
                null,
                `Your order #${order.order_id} status updated to ${newStatus}`
            );
        }

        return res.json({
            message: "Order status updated successfully",
            order
        });
    } catch (error) {
        console.error("Error updating order status:", error);
        return res.status(500).json({ message: "Error updating order status", error: error.message });
    }
};

/**
 * Updates sub-order (restaurant) status
 */
module.exports.updateSubOrderStatus = async (req, res) => {
    try {
        const { orderId, restaurantId } = req.params;
        const { newStatus, note } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        const subOrder = order.orders.find(
            o => o.restaurant_id.toString() === restaurantId
        );

        if (!subOrder) {
            return res.status(404).json({ message: "Restaurant order not found" });
        }

        // Validate transition
        if (!isValidTransition(subOrder.status, newStatus)) {
            return res.status(400).json({
                message: `Cannot transition from ${subOrder.status} to ${newStatus}`,
                available_transitions: getAvailableTransitions(subOrder.status)
            });
        }

        subOrder.status = newStatus;

        await order.save();

        return res.json({
            message: "Sub-order status updated successfully",
            order
        });
    } catch (error) {
        console.error("Error updating sub-order status:", error);
        return res.status(500).json({ message: "Error updating sub-order status", error: error.message });
    }
};

/**
 * Cancels an order
 */
module.exports.cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason, canceled_by = 'User' } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Check if order can be canceled
        const cancellation = canCancelOrder(order.order_status);
        if (!cancellation.canCancel) {
            return res.status(400).json({
                message: cancellation.reason,
                current_status: order.order_status
            });
        }

        // Update order status
        order.order_status = ORDER_STATES.CANCELED;
        order.cancellation_reason = reason || "";
        order.canceled_by = canceled_by;
        order.canceled_at = new Date();
        order.status_timeline.push(
            createStatusTimelineEntry(ORDER_STATES.CANCELED, reason || "Order canceled")
        );

        // Cancel all sub-orders
        if (order.orders) {
            order.orders.forEach(subOrder => {
                if (canCancelOrder(subOrder.status).canCancel) {
                    subOrder.status = ORDER_STATES.CANCELED;
                }
            });
        }

        await order.save();

        // TODO: Refund logic here if payment was made

        // Send notification
        if (order.user_id) {
            await sendNotification(
                [order.user_id],
                null,
                `Your order #${order.order_id} has been canceled`
            );
        }

        return res.json({
            message: "Order canceled successfully",
            order
        });
    } catch (error) {
        console.error("Error canceling order:", error);
        return res.status(500).json({ message: "Error canceling order", error: error.message });
    }
};

/**
 * Gets customer orders list
 */
module.exports.getCustomerOrders = async (req, res) => {
    try {
        const userId = req.decoded.id;
        const { status, limit = 10, page = 1 } = req.query;

        let query = { user_id: userId };
        if (status) {
            query.order_status = status;
        }

        const skip = (page - 1) * limit;

        const orders = await Order.find(query)
            .populate('orders.restaurant_id', 'name logo')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip);

        const total = await Order.countDocuments(query);

        return res.json({
            orders,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Error fetching customer orders:", error);
        return res.status(500).json({ message: "Error fetching customer orders", error: error.message });
    }
};

/**
 * Gets restaurant orders
 */
module.exports.getRestaurantOrders = async (req, res) => {
    try {
        const restaurantId = req.decoded.restaurant_id || req.params.restaurantId;
        const { status, limit = 10, page = 1 } = req.query;

        let query = { "orders.restaurant_id": restaurantId };
        if (status) {
            query["orders.status"] = status;
        }

        const skip = (page - 1) * limit;

        const orders = await Order.find(query)
            .populate('user_id', 'first_name last_name phone')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip);

        const total = await Order.countDocuments(query);

        return res.json({
            orders,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Error fetching restaurant orders:", error);
        return res.status(500).json({ message: "Error fetching restaurant orders", error: error.message });
    }
};

/**
 * Gets agent delivery orders
 */
module.exports.getAgentOrders = async (req, res) => {
    try {
        const agentId = req.decoded.id;
        const { status, limit = 10, page = 1 } = req.query;

        let query = { "agent.agent_id": agentId };
        if (status) {
            query.order_status = status;
        }

        const skip = (page - 1) * limit;

        const orders = await Order.find(query)
            .populate('user_id', 'first_name last_name phone')
            .populate('orders.restaurant_id', 'name')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip);

        const total = await Order.countDocuments(query);

        return res.json({
            orders,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Error fetching agent orders:", error);
        return res.status(500).json({ message: "Error fetching agent orders", error: error.message });
    }
};

/**
 * Assigns delivery agent to order
 */
module.exports.assignDeliveryAgent = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { agentId } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        if (order.order_status !== ORDER_STATES.PACKED_READY_FOR_PICKUP) {
            return res.status(400).json({
                message: "Order must be ready for pickup before assigning agent"
            });
        }

        order.agent = {
            agent_id: agentId,
            assigned_at: new Date()
        };

        await order.save();

        return res.json({
            message: "Agent assigned successfully",
            order
        });
    } catch (error) {
        console.error("Error assigning delivery agent:", error);
        return res.status(500).json({ message: "Error assigning delivery agent", error: error.message });
    }
};

