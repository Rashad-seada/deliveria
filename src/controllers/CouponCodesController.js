const Cart = require("../models/Carts");
const CouponCode = require("../models/CouponCodes");

module.exports.createCouponCode = async (req, res) => {
    try {
        const { code, discount_type, value, expired_date } = req.body;

        if (!code || !discount_type || !value || !expired_date) {
            return res.status(400).json({ message: "Code, discount_type, value, and expired_date are required." });
        }

        const existingCode = await CouponCode.findOne({ code: code.toUpperCase() });
        if (existingCode) {
            return res.status(409).json({ message: 'This coupon code already exists.' });
        }

        let couponCode = new CouponCode({
            code: code.toUpperCase(),
            discount_type,
            value,
            expired_date: new Date(expired_date),
        });

        await couponCode.save();

        return res.status(201).json({
            message: "Coupon code created successfully.",
            coupon: couponCode
        });

    } catch (error) {
        console.error("Error creating coupon:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: "Validation Error", errors: error.errors });
        }
        return res.status(500).json({ message: "Server error." });
    }
}

module.exports.checkCouponCode = async (req, res) => {
    try {
        const userId = req.decoded.id;
        const code = req.params.code.toUpperCase();

        const couponCode = await CouponCode.findOne({ code: code });

        if (!couponCode) {
            return res.status(404).json({ message: `Coupon "${code}" not found.` });
        }

        if (!couponCode.is_active) {
            return res.status(400).json({ message: `Coupon "${code}" is not active.` });
        }

        const currentDate = new Date();
        if (currentDate > couponCode.expired_date) {
            return res.status(400).json({ message: `Coupon "${code}" has expired.` });
        }

        if (couponCode.users_used.includes(userId)) {
            return res.status(400).json({ message: `You have already used this coupon.` });
        }

        // Apply coupon to user's cart
        const cart = await Cart.findOne({ user_id: userId });
        if (!cart) {
            return res.status(404).json({ message: "You don't have a cart to apply the coupon to." });
        }

        cart.coupon_code_id = couponCode._id;
        await cart.save();

        return res.status(200).json({
            message: `Coupon "${code}" applied successfully! You get ${couponCode.value}% off the ${couponCode.discount_type}.`,
            coupon: couponCode
        });

    } catch (error) {
        console.error("Error checking coupon:", error);
        return res.status(500).json({ message: "Server error." });
    }
}

module.exports.getCouponCode = async (req, res) => {
    try {
        const couponCodes = await CouponCode.find();

        return res.status(200).json({
            coupon_codes: couponCodes
        });
    } catch (error) {
        console.error("Error fetching coupons:", error);
        return res.status(500).json({ message: "Server error." });
    }
}

module.exports.changeEnable = async (req, res, next) => {
    try {
        const couponCode = await CouponCode.findById(req.params.id);
        if (!couponCode) {
            return res.status(404).json({ message: "Coupon not found." });
        }

        couponCode.is_active = !couponCode.is_active;
        await couponCode.save();

        return res.status(200).json({
            message: `This coupon code is now ${couponCode.is_active ? "enabled" : "disabled"}.`,
            is_active: couponCode.is_active,
        });
    } catch (error) {
        console.error("Error toggling coupon status:", error);
        return res.status(500).json({ message: "Server error." });
    }
}