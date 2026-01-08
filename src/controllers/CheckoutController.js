/**
 * Checkout Controller
 * Handles the final checkout process and order creation
 */

const Address = require("../models/Address");
const {
    validateCart,
    calculateOrderTotal,
    createOrderFromCart,
    processPayment
} = require("../utils/checkoutManager");

/**
 * Validates cart before checkout
 */
module.exports.validateCheckout = async (req, res) => {
    try {
        const userId = req.decoded?.id;
        const { address_id } = req.body;

        if (!address_id) {
            return res.status(400).json({ message: "Address is required" });
        }

        // Verify address exists
        const address = await Address.findById(address_id);
        if (!address) {
            return res.status(404).json({ message: "Address not found" });
        }

        const result = await validateCart(userId, address_id);

        if (!result.valid) {
            return res.status(400).json({
                message: result.message,
                valid: false
            });
        }

        return res.json({
            message: "Cart is valid",
            valid: true
        });
    } catch (error) {
        console.error("Error validating checkout:", error);
        return res.status(500).json({ message: "Error validating checkout", error: error.message });
    }
};

/**
 * Calculates order total with breakdown
 */
module.exports.calculateOrderTotal = async (req, res) => {
    try {
        const userId = req.decoded?.id;
        const { address_id, coupon_code_id } = req.body;

        // Get address
        const address = await Address.findById(address_id);
        if (!address) {
            return res.status(404).json({ message: "Address not found" });
        }

        // Get cart
        const Cart = require("../models/Carts");
        const cart = await Cart.findOne({ user_id: userId })
            .populate('carts.items.item_id');

        if (!cart || cart.carts.length === 0) {
            return res.status(400).json({ message: "Cart is empty" });
        }

        // Calculate total
        const result = await calculateOrderTotal(
            cart,
            coupon_code_id,
            req.body.applied_offers || [],
            address
        );

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json({
            breakdown: result.breakdown
        });
    } catch (error) {
        console.error("Error calculating order total:", error);
        return res.status(500).json({ message: "Error calculating order total", error: error.message });
    }
};

/**
 * Completes checkout and creates order
 */
module.exports.completeCheckout = async (req, res) => {
    try {
        const userId = req.decoded?.id;
        const { address_id, payment_type, coupon_code_id, guest_user } = req.body;

        // Validate required fields
        if (!address_id || !payment_type) {
            return res.status(400).json({ message: "Address and payment type are required" });
        }

        // Get address
        const address = await Address.findById(address_id);
        if (!address) {
            return res.status(404).json({ message: "Address not found" });
        }

        // For guests, validate guest user data
        let guestData = null;
        if (!userId && guest_user) {
            if (!guest_user.name || !guest_user.phone) {
                return res.status(400).json({ message: "Guest user name and phone are required" });
            }
            guestData = guest_user;
        }

        const checkoutData = {
            address_id,
            address,
            payment_type,
            coupon_code_id,
            applied_offers: req.body.applied_offers || [],
            guest_user: guestData
        };

        const result = await createOrderFromCart(userId, checkoutData);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(201).json({
            message: "Order created successfully",
            order: result.order,
            breakdown: result.breakdown
        });
    } catch (error) {
        console.error("Error completing checkout:", error);
        return res.status(500).json({ message: "Error completing checkout", error: error.message });
    }
};

/**
 * Processes payment for an order
 */
module.exports.processPayment = async (req, res) => {
    try {
        const { orderId } = req.params;
        const paymentData = req.body; // {gateway, payment_id, amount, status}

        if (!paymentData.gateway || !paymentData.amount || !paymentData.status) {
            return res.status(400).json({ message: "Missing payment data" });
        }

        const result = await processPayment(orderId, paymentData);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error("Error processing payment:", error);
        return res.status(500).json({ message: "Error processing payment", error: error.message });
    }
};

/**
 * Gets checkout summary
 */
module.exports.getCheckoutSummary = async (req, res) => {
    try {
        const userId = req.decoded?.id;
        const { address_id, coupon_code_id } = req.query;

        if (!address_id) {
            return res.status(400).json({ message: "Address is required" });
        }

        // Get address
        const address = await Address.findById(address_id);
        if (!address) {
            return res.status(404).json({ message: "Address not found" });
        }

        // Get cart
        const Cart = require("../models/Carts");
        const cart = await Cart.findOne({ user_id: userId })
            .populate('carts.items.item_id', 'name photo price');

        if (!cart || cart.carts.length === 0) {
            return res.status(400).json({ message: "Cart is empty" });
        }

        // Validate cart
        const validation = await validateCart(userId, address_id);
        if (!validation.valid) {
            return res.status(400).json({ message: validation.message });
        }

        // Calculate total
        const totalCalc = await calculateOrderTotal(
            cart,
            coupon_code_id,
            [],
            address
        );

        return res.json({
            cart: {
                items_count: cart.carts.reduce((sum, c) => sum + c.items.length, 0),
                restaurants_count: cart.carts.length
            },
            address: {
                title: address.address_title,
                details: address.details,
                coordinates: address.coordinates
            },
            breakdown: totalCalc.breakdown
        });
    } catch (error) {
        console.error("Error getting checkout summary:", error);
        return res.status(500).json({ message: "Error getting checkout summary", error: error.message });
    }
};

/**
 * Validates coupon code during checkout
 */
module.exports.validateCoupon = async (req, res) => {
    try {
        const { coupon_code, address_id } = req.body;
        const userId = req.decoded?.id;

        if (!coupon_code) {
            return res.status(400).json({ message: "Coupon code is required" });
        }

        // Find coupon
        const CouponCode = require("../models/CouponCodes");
        const coupon = await CouponCode.findOne({ code: coupon_code });

        if (!coupon) {
            return res.status(404).json({ message: "Coupon code not found" });
        }

        // Check if coupon is valid
        const now = new Date();
        if (!coupon.is_valid || coupon.expiry_date < now) {
            return res.status(400).json({ message: "Coupon code has expired" });
        }

        // Check usage limit
        if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
            return res.status(400).json({ message: "Coupon code has reached usage limit" });
        }

        // Check user usage limit
        if (coupon.max_uses_per_user) {
            const Order = require("../models/Orders");
            const userOrders = await Order.countDocuments({
                user_id: userId,
                "coupon_code.code": coupon_code
            });
            if (userOrders >= coupon.max_uses_per_user) {
                return res.status(400).json({ message: "You have already used this coupon the maximum times" });
            }
        }

        // Get cart
        const Cart = require("../models/Carts");
        const cart = await Cart.findOne({ user_id: userId })
            .populate('carts.items.item_id');

        if (!cart || cart.carts.length === 0) {
            return res.status(400).json({ message: "Cart is empty" });
        }

        // Calculate discount
        let cartSubtotal = 0;
        for (const cartItem of cart.carts) {
            for (const item of cartItem.items) {
                cartSubtotal += item.total_price || 0;
            }
        }

        let discount = 0;
        if (coupon.discount_type === 'percentage') {
            discount = (cartSubtotal * coupon.discount_value) / 100;
        } else {
            discount = coupon.discount_value;
        }
        discount = Math.min(discount, cartSubtotal);

        return res.json({
            valid: true,
            coupon: {
                code: coupon.code,
                discount_type: coupon.discount_type,
                discount_value: coupon.discount_value,
                discount_amount: Math.round(discount * 100) / 100
            }
        });
    } catch (error) {
        console.error("Error validating coupon:", error);
        return res.status(500).json({ message: "Error validating coupon", error: error.message });
    }
};
