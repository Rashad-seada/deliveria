/**
 * Checkout System
 * Handles the final checkout process, payment integration, and order creation
 */

const Order = require('../models/Orders');
const Cart = require('../models/Carts');
const CouponCode = require('../models/CouponCodes');
const Restaurant = require('../models/Restaurants');
const Item = require('../models/Items');
const Counter = require('../models/Counter');
const { decrementProductQuantity } = require('./inventoryManager');
const { calculateDeliveryFee, calculateMaxDistanceToRestaurants } = require('./deliveryHelpers');

/**
 * Validates cart before checkout
 * @param {string} userId - User ID
 * @param {string} addressId - Delivery address ID
 * @returns {object} - {valid: boolean, message: string, cart: object}
 */
async function validateCart(userId, addressId) {
    try {
        // Get user cart
        const cart = await Cart.findOne({ user_id: userId })
            .populate({
                path: 'carts.items.item_id',
                select: 'quantity restaurant_id'
            });

        if (!cart || cart.carts.length === 0) {
            return {
                valid: false,
                message: 'Cart is empty'
            };
        }

        // Check if all items are still available
        for (const cartItem of cart.carts) {
            for (const item of cartItem.items) {
                if (!item.item_id) {
                    return {
                        valid: false,
                        message: 'Some items are no longer available'
                    };
                }

                // Check stock
                if (item.item_id.quantity < item.quantity) {
                    return {
                        valid: false,
                        message: `${item.item_id.name} is out of stock (available: ${item.item_id.quantity})`
                    };
                }
            }
        }

        // Check if restaurants are open
        const restaurantIds = [...new Set(cart.carts.map(c => c.restaurant_id.toString()))];
        const restaurants = await Restaurant.find({ '_id': { $in: restaurantIds } });

        for (const restaurant of restaurants) {
            if (restaurant.is_closed) {
                return {
                    valid: false,
                    message: `${restaurant.name} is currently closed`
                };
            }
        }

        return {
            valid: true,
            message: 'Cart is valid',
            cart
        };
    } catch (error) {
        return {
            valid: false,
            message: error.message
        };
    }
}

/**
 * Calculates final order total with all breakdowns
 * @param {object} cart - Cart object with items
 * @param {string} couponCodeId - Optional coupon code ID
 * @param {array} appliedOffers - Optional array of applied offers
 * @param {object} address - Delivery address with coordinates
 * @returns {object} - {success: boolean, breakdown: object}
 */
async function calculateOrderTotal(cart, couponCodeId = null, appliedOffers = [], address) {
    try {
        let subtotal = 0;
        let couponDiscount = 0;
        let offersDiscount = 0;
        let deliveryFee = 0;
        let tax = 0;

        // Calculate subtotal from cart items
        for (const cartItem of cart.carts) {
            for (const item of cartItem.items) {
                subtotal += item.total_price || 0;
            }
        }

        // Apply coupon discount if provided
        if (couponCodeId) {
            const coupon = await CouponCode.findById(couponCodeId);
            if (coupon && coupon.is_valid) {
                if (coupon.discount_type === 'percentage') {
                    couponDiscount = (subtotal * coupon.discount_value) / 100;
                } else {
                    couponDiscount = coupon.discount_value;
                }
                // Cap discount to subtotal
                couponDiscount = Math.min(couponDiscount, subtotal);
            }
        }

        // Apply offers discounts
        if (appliedOffers && appliedOffers.length > 0) {
            offersDiscount = appliedOffers.reduce((sum, offer) => sum + (offer.discount_amount || 0), 0);
        }

        // Calculate delivery fee
        if (address && address.coordinates) {
            const restaurantIds = [...new Set(cart.carts.map(c => c.restaurant_id.toString()))];
            const restaurants = await Restaurant.find({ '_id': { $in: restaurantIds } }).select('coordinates');

            if (restaurants.length > 0) {
                const maxDistance = calculateMaxDistanceToRestaurants(restaurants, address.coordinates);
                const orderType = restaurants.length > 1 ? 'Multi' : 'Single';
                deliveryFee = calculateDeliveryFee(maxDistance, orderType);
            }
        }

        // Calculate tax (assuming 10% tax rate)
        const taxableAmount = subtotal - couponDiscount - offersDiscount;
        const TAX_RATE = 0.10;
        tax = taxableAmount * TAX_RATE;

        const total = subtotal - couponDiscount - offersDiscount + tax + deliveryFee;

        return {
            success: true,
            breakdown: {
                subtotal: Math.round(subtotal * 100) / 100,
                coupon_discount: Math.round(couponDiscount * 100) / 100,
                offers_discount: Math.round(offersDiscount * 100) / 100,
                total_discount: Math.round((couponDiscount + offersDiscount) * 100) / 100,
                tax: Math.round(tax * 100) / 100,
                delivery_fee: Math.round(deliveryFee * 100) / 100,
                final_total: Math.round(total * 100) / 100
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Gets next order ID sequence
 * @returns {promise<number>} - Next order ID
 */
async function getNextOrderId() {
    try {
        const sequenceDocument = await Counter.findByIdAndUpdate(
            'order_id',
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        return sequenceDocument.seq;
    } catch (error) {
        throw new Error(`Failed to generate order ID: ${error.message}`);
    }
}

/**
 * Creates order from cart
 * @param {string} userId - User ID (or null for guest)
 * @param {object} checkoutData - {address, payment_type, coupon_code_id, guest_user: {name, phone, email}}
 * @returns {promise<object>} - {success: boolean, order: object, error: string}
 */
async function createOrderFromCart(userId, checkoutData) {
    try {
        // For guest users
        if (!userId && !checkoutData.guest_user) {
            return {
                success: false,
                error: 'User ID or guest user details required'
            };
        }

        // Validate cart
        const validation = await validateCart(userId, checkoutData.address_id);
        if (!validation.valid) {
            return {
                success: false,
                error: validation.message
            };
        }

        const cart = validation.cart;

        // Calculate total
        const totalCalc = await calculateOrderTotal(
            cart,
            checkoutData.coupon_code_id,
            checkoutData.applied_offers || [],
            checkoutData.address
        );

        if (!totalCalc.success) {
            return {
                success: false,
                error: totalCalc.error
            };
        }

        // Create sub-orders for each restaurant
        const subOrders = cart.carts.map(cartItem => ({
            restaurant_id: cartItem.restaurant_id,
            items: cartItem.items,
            price_of_restaurant: cartItem.price_of_restaurant,
            status: 'Waiting for Approval'
        }));

        // Get next order ID
        const orderId = await getNextOrderId();

        // Create order
        const orderData = {
            user_id: userId || null,
            guest_user: checkoutData.guest_user || null,
            order_type: cart.carts.length > 1 ? 'Multi' : 'Single',
            order_status: 'Waiting for Approval',
            orders: subOrders,
            address: checkoutData.address,
            final_price_without_delivery_cost: totalCalc.breakdown.subtotal - totalCalc.breakdown.total_discount,
            final_delivery_cost: totalCalc.breakdown.delivery_fee,
            final_price: totalCalc.breakdown.final_total,
            delivery_type: 'Agent',
            payment_type: checkoutData.payment_type,
            order_id: orderId,
            status_timeline: [{
                status: 'Waiting for Approval',
                timestamp: new Date(),
                note: 'Order created'
            }]
        };

        // Add coupon if provided
        if (checkoutData.coupon_code_id) {
            const coupon = await CouponCode.findById(checkoutData.coupon_code_id);
            if (coupon) {
                orderData.coupon_code = {
                    code: coupon.code,
                    discount_percentage: coupon.discount_type === 'percentage' ? coupon.discount_value : null,
                    discount_amount: coupon.discount_type === 'fixed' ? coupon.discount_value : null,
                    coupon_id: coupon._id
                };
            }
        }

        // Add offers if provided
        if (checkoutData.applied_offers && checkoutData.applied_offers.length > 0) {
            orderData.applied_offers = checkoutData.applied_offers;
        }

        const order = new Order(orderData);
        await order.save();

        // Decrement inventory for each item
        for (const subOrder of subOrders) {
            for (const item of subOrder.items) {
                await decrementProductQuantity(item.item_id, item.quantity);
            }
        }

        // Clear cart
        await Cart.findOneAndDelete({ user_id: userId });

        return {
            success: true,
            order,
            breakdown: totalCalc.breakdown
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Validates payment and confirms order
 * This would integrate with external payment gateways
 * @param {string} orderId - Order ID
 * @param {object} paymentData - {gateway, payment_id, amount, status}
 * @returns {promise<object>} - {success: boolean, message: string}
 */
async function processPayment(orderId, paymentData) {
    try {
        const order = await Order.findById(orderId);
        
        if (!order) {
            return {
                success: false,
                error: 'Order not found'
            };
        }

        // This is where you'd integrate with actual payment gateways
        // (Stripe, PayPal, etc.)
        
        // For now, we'll just validate the amount
        if (paymentData.amount !== order.final_price) {
            return {
                success: false,
                error: 'Payment amount does not match order total'
            };
        }

        if (paymentData.status === 'completed') {
            order.payment_status = 'Completed';
            await order.save();

            return {
                success: true,
                message: 'Payment processed successfully',
                order
            };
        } else {
            return {
                success: false,
                error: 'Payment failed'
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    validateCart,
    calculateOrderTotal,
    getNextOrderId,
    createOrderFromCart,
    processPayment
};
