const Cart = require("../models/Carts");
const CouponCode = require("../models/CouponCodes");

module.exports.createCouponCode = async (req, res) => {
    try {
        const {
            code,
            discount_type,
            value,
            expired_date,
            // New fields
            description,
            usage_limit,
            usage_per_user_limit,
            minimum_order_value,
            applicable_restaurants,
            coupon_type
        } = req.body;

        if (!req.body) {
            console.error("Missing/Empty req.body in createCouponCode");
            return res.status(400).json({ message: "Request body is empty" });
        }

        console.log("createCouponCode received:", req.body);

        const missingFields = [];
        if (!code) missingFields.push('code');
        if (!discount_type) missingFields.push('discount_type');
        if (value === undefined || value === null) missingFields.push('value');
        if (!expired_date) missingFields.push('expired_date');

        if (missingFields.length > 0) {
            return res.status(400).json({
                message: `Missing required fields: ${missingFields.join(', ')}`,
                received_keys: Object.keys(req.body)
            });
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
            // Optional fields with defaults handled by schema
            description: description || "",
            usage_limit: usage_limit || null,
            usage_per_user_limit: usage_per_user_limit || 1,
            minimum_order_value: minimum_order_value || 0,
            applicable_restaurants: applicable_restaurants || [],
            coupon_type: coupon_type || "promotional",
            created_by: req.decoded?.id || null
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

        // --- Usage Limit Check (Total) ---
        if (couponCode.usage_limit !== null && couponCode.users_used.length >= couponCode.usage_limit) {
            return res.status(400).json({ message: `Coupon "${code}" has reached its maximum usage limit.` });
        }

        // --- Per-User Limit Check ---
        const userUsageCount = couponCode.users_used.filter(id => id.toString() === userId.toString()).length;
        if (userUsageCount >= couponCode.usage_per_user_limit) {
            return res.status(400).json({ message: `You have already used this coupon the maximum number of times (${couponCode.usage_per_user_limit}).` });
        }

        // Get user's cart
        const cart = await Cart.findOne({ user_id: userId })
            .populate('carts.items.item_id', 'name')
            .lean();

        if (!cart) {
            return res.status(404).json({ message: "You don't have a cart to apply the coupon to." });
        }

        // --- Minimum Order Value Check ---
        // Calculate cart total (simplified - you may need to adjust based on your cart structure)
        const Restaurant = require("../models/Restaurants");
        const Item = require("../models/Items");

        let cartTotal = 0;
        for (const restaurantCart of cart.carts) {
            for (const item of restaurantCart.items) {
                const itemData = await Item.findById(item.item_id).select('sizes toppings').lean();
                if (itemData) {
                    const matchedSize = itemData.sizes.find(s => s._id.toString() === item.size.toString());
                    if (matchedSize) {
                        cartTotal += matchedSize.price_after * (item.quantity || 1);
                    }
                }
            }
        }

        if (couponCode.minimum_order_value > 0 && cartTotal < couponCode.minimum_order_value) {
            return res.status(400).json({
                message: `Minimum order value of ${couponCode.minimum_order_value} EGP required. Your cart total is ${cartTotal.toFixed(2)} EGP.`
            });
        }

        // --- Applicable Restaurants Check ---
        if (couponCode.applicable_restaurants && couponCode.applicable_restaurants.length > 0) {
            const cartRestaurantIds = cart.carts.map(c => c.restaurant_id.toString());
            const allowedRestaurantIds = couponCode.applicable_restaurants.map(id => id.toString());

            const hasValidRestaurant = cartRestaurantIds.some(id => allowedRestaurantIds.includes(id));

            if (!hasValidRestaurant) {
                return res.status(400).json({
                    message: `Coupon "${code}" is only valid for specific restaurants not in your cart.`
                });
            }
        }

        // Apply coupon to user's cart
        await Cart.findOneAndUpdate(
            { user_id: userId },
            { coupon_code_id: couponCode._id }
        );

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

// Update a coupon code
module.exports.updateCouponCode = async (req, res) => {
    try {
        const couponId = req.params.id;
        const updateData = req.body;

        // Remove fields that shouldn't be updated
        delete updateData.code; // Code should be immutable
        delete updateData.users_used; // Shouldn't be manually edited

        // Handle expired_date conversion
        if (updateData.expired_date) {
            updateData.expired_date = new Date(updateData.expired_date);
        }

        const updatedCoupon = await CouponCode.findByIdAndUpdate(
            couponId,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedCoupon) {
            return res.status(404).json({ message: "Coupon not found." });
        }

        return res.status(200).json({
            message: "Coupon updated successfully.",
            coupon: updatedCoupon
        });
    } catch (error) {
        console.error("Error updating coupon:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: "Validation Error", errors: error.errors });
        }
        return res.status(500).json({ message: "Server error." });
    }
}

// Delete a coupon code
module.exports.deleteCouponCode = async (req, res) => {
    try {
        const couponId = req.params.id;

        const deletedCoupon = await CouponCode.findByIdAndDelete(couponId);

        if (!deletedCoupon) {
            return res.status(404).json({ message: "Coupon not found." });
        }

        return res.status(200).json({
            message: "Coupon deleted successfully.",
            deletedCoupon: {
                id: deletedCoupon._id,
                code: deletedCoupon.code
            }
        });
    } catch (error) {
        console.error("Error deleting coupon:", error);
        return res.status(500).json({ message: "Server error." });
    }
}

// Get a single coupon by ID
module.exports.getCouponById = async (req, res) => {
    try {
        const coupon = await CouponCode.findById(req.params.id);

        if (!coupon) {
            return res.status(404).json({ message: "Coupon not found." });
        }

        return res.status(200).json({ coupon });
    } catch (error) {
        console.error("Error fetching coupon:", error);
        return res.status(500).json({ message: "Server error." });
    }
}