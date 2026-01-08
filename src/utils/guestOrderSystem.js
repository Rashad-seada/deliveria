/**
 * Guest Order System
 * Allows users to place orders without creating an account
 */

const Order = require("../models/Orders");
const User = require("../models/Users");
const { sendNotification } = require("../controllers/global");

/**
 * Creates a guest user for an order
 * @param {object} guestData - Guest user information {name, phone, email}
 * @returns {object} - Guest user data or error
 */
async function createGuestUser(guestData) {
    try {
        // Validate required fields
        if (!guestData.name || !guestData.phone) {
            return {
                success: false,
                message: "Guest name and phone are required"
            };
        }

        // Check if phone already exists as registered user
        const existingUser = await User.findOne({ phone: guestData.phone });
        if (existingUser && !existingUser.is_guest) {
            return {
                success: false,
                message: "This phone number is already registered. Please log in.",
                email: existingUser.email
            };
        }

        // Create guest user (minimal data)
        const guestUser = {
            name: guestData.name.trim(),
            phone: guestData.phone.trim(),
            email: guestData.email || "N/A"
        };

        return {
            success: true,
            guest_user: guestUser,
            message: "Guest user data prepared"
        };
    } catch (error) {
        console.error("Error creating guest user:", error);
        return {
            success: false,
            message: "Error preparing guest user",
            error: error.message
        };
    }
}

/**
 * Validates guest order data
 */
async function validateGuestOrder(guestData, addressId) {
    try {
        // Validate guest data
        if (!guestData.name || !guestData.phone) {
            return {
                valid: false,
                message: "Guest name and phone are required"
            };
        }

        // Validate address
        const Address = require("../models/Address");
        const address = await Address.findById(addressId);
        if (!address) {
            return {
                valid: false,
                message: "Delivery address not found"
            };
        }

        // Validate phone format (basic)
        const phoneRegex = /^[0-9]{10,15}$/;
        if (!phoneRegex.test(guestData.phone.replace(/\D/g, ''))) {
            return {
                valid: false,
                message: "Invalid phone number"
            };
        }

        return {
            valid: true,
            message: "Guest order data is valid"
        };
    } catch (error) {
        console.error("Error validating guest order:", error);
        return {
            valid: false,
            message: "Error validating guest order",
            error: error.message
        };
    }
}

/**
 * Creates order for guest user
 * Guest orders cannot use loyalty points or certain features
 */
async function createGuestOrder(guestData, orderData) {
    try {
        // Validate guest data first
        const validation = await validateGuestOrder(guestData, orderData.address_id);
        if (!validation.valid) {
            return {
                success: false,
                message: validation.message
            };
        }

        // Create order with guest_user field instead of user_id
        const order = new Order({
            guest_user: {
                name: guestData.name.trim(),
                phone: guestData.phone.trim(),
                email: guestData.email || "N/A"
            },
            user_id: null, // No user account
            order_type: orderData.order_type || "Single",
            address: orderData.address,
            orders: orderData.orders,
            final_price_without_delivery_cost: orderData.final_price_without_delivery_cost,
            final_delivery_cost: orderData.final_delivery_cost,
            final_price: orderData.final_price,
            delivery_type: "Agent",
            payment_type: orderData.payment_type,
            coupon_code: orderData.coupon_code || null,
            applied_offers: orderData.applied_offers || [],
            order_status: "Waiting for Approval"
        });

        await order.save();

        // Send confirmation SMS/notification to guest
        // In a real system, would send SMS instead of in-app notification
        console.log(`[Guest Order] Order #${order.order_id} created for guest: ${guestData.phone}`);

        return {
            success: true,
            message: "Guest order created successfully",
            order: {
                order_id: order.order_id,
                _id: order._id,
                status: order.order_status,
                total: order.final_price,
                guest_phone: guestData.phone
            }
        };
    } catch (error) {
        console.error("Error creating guest order:", error);
        return {
            success: false,
            message: "Error creating guest order",
            error: error.message
        };
    }
}

/**
 * Gets guest order details using phone and order ID
 * Authentication: guest can only view their own orders by phone + order ID
 */
async function getGuestOrderDetails(phone, orderId) {
    try {
        const order = await Order.findById(orderId)
            .populate('user_id', 'first_name last_name phone')
            .populate('orders.restaurant_id', 'name logo phone');

        if (!order) {
            return { success: false, message: "Order not found" };
        }

        // Verify this is a guest order with matching phone
        if (!order.guest_user || order.guest_user.phone !== phone) {
            return {
                success: false,
                message: "Invalid order details for this guest"
            };
        }

        return {
            success: true,
            order: {
                order_id: order.order_id,
                status: order.order_status,
                total: order.final_price,
                items_count: order.orders.reduce((sum, so) => sum + so.items.length, 0),
                delivery_address: order.address.details,
                created_at: order.createdAt,
                estimated_delivery: order.delivery_details?.estimated_arrival,
                restaurants: order.orders.map(o => ({
                    name: o.restaurant_id?.name,
                    status: o.status
                }))
            }
        };
    } catch (error) {
        console.error("Error fetching guest order:", error);
        return {
            success: false,
            message: "Error fetching order details",
            error: error.message
        };
    }
}

/**
 * Allows guest to track their order
 * Requires phone number and order ID for authentication
 */
async function trackGuestOrder(phone, orderId) {
    try {
        const order = await Order.findById(orderId).select(
            'order_id order_status guest_user status_timeline agent delivery_details'
        );

        if (!order || !order.guest_user || order.guest_user.phone !== phone) {
            return {
                success: false,
                message: "Order not found or invalid phone"
            };
        }

        return {
            success: true,
            tracking: {
                order_id: order.order_id,
                current_status: order.order_status,
                timeline: order.status_timeline.slice(-5), // Last 5 status changes
                agent_info: order.agent?.agent_id ? {
                    assigned: true,
                    assigned_at: order.agent.assigned_at
                } : { assigned: false },
                delivery_info: order.delivery_details ? {
                    estimated_time: order.delivery_details.estimated_time,
                    estimated_arrival: order.delivery_details.estimated_arrival,
                    distance: order.delivery_details.distance
                } : null
            }
        };
    } catch (error) {
        console.error("Error tracking guest order:", error);
        return {
            success: false,
            message: "Error tracking order",
            error: error.message
        };
    }
}

/**
 * Allows guest to cancel their order
 */
async function cancelGuestOrder(phone, orderId, reason = "") {
    try {
        const order = await Order.findById(orderId);

        if (!order || !order.guest_user || order.guest_user.phone !== phone) {
            return {
                success: false,
                message: "Order not found or invalid phone"
            };
        }

        // Check if order can be canceled
        const cancelableStatuses = [
            "Waiting for Approval",
            "Approved / Preparing",
            "Packed / Ready for Pickup"
        ];

        if (!cancelableStatuses.includes(order.order_status)) {
            return {
                success: false,
                message: `Cannot cancel order in ${order.order_status} status`
            };
        }

        // Mark order as canceled
        order.order_status = "Canceled";
        order.canceled_by = "User";
        order.canceled_at = new Date();
        order.cancellation_reason = reason || "Canceled by guest";

        // Cancel all sub-orders
        order.orders.forEach(subOrder => {
            subOrder.status = "Canceled";
            subOrder.cancel_me = true;
        });

        await order.save();

        return {
            success: true,
            message: "Order canceled successfully",
            order_id: order.order_id
        };
    } catch (error) {
        console.error("Error canceling guest order:", error);
        return {
            success: false,
            message: "Error canceling order",
            error: error.message
        };
    }
}

module.exports = {
    createGuestUser,
    validateGuestOrder,
    createGuestOrder,
    getGuestOrderDetails,
    trackGuestOrder,
    cancelGuestOrder
};
