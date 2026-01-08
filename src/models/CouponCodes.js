const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const couponCodeSchema = new Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true
    },
    discount_type: {
        type: String,
        enum: ['delivery', 'bill'], // خصم على التوصيل أو الفاتورة
        required: true
    },
    value: { // قيمة الخصم (نسبة مئوية)
        type: Number,
        required: true,
        min: 1,
        max: 100
    },
    description: {
        type: String,
        default: ""
    },
    expired_date: {
        type: Date,
        required: true,
    },
    is_active: {
        type: Boolean,
        default: true,
    },
    users_used: [{ // تتبع المستخدمين الذين استخدموا الكود
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    
    // Additional fields for better coupon management
    usage_limit: {
        type: Number,
        default: null, // null = unlimited
        description: "Total number of times coupon can be used"
    },
    usage_per_user_limit: {
        type: Number,
        default: 1,
        description: "Number of times a user can use this coupon"
    },
    minimum_order_value: {
        type: Number,
        default: 0,
        description: "Minimum order value to apply coupon"
    },
    applicable_restaurants: [{
        type: Schema.Types.ObjectId,
        ref: 'restaurant',
        default: [] // Empty array means applicable to all restaurants
    }],
    created_by: {
        type: Schema.Types.ObjectId,
        ref: "Admin",
        default: null
    },
    coupon_type: {
        type: String,
        enum: ["promotional", "points_reward", "loyalty", "seasonal"],
        default: "promotional"
    }
}, { timestamps: true });

// Index for frequently queried fields
couponCodeSchema.index({ code: 1 });
couponCodeSchema.index({ expired_date: 1 });
couponCodeSchema.index({ is_active: 1 });

couponCodeSchema.statics.isThisCodeIsUsed = async function (code) {
    if (!code) return false;
    try {
        const coupon = await this.findOne({ code: code.toUpperCase() });
        if (!coupon) return false;
        return true;
    } catch (error) {
        console.log(error.message);
        return false;
    }
};

/**
 * Check if coupon is valid for use
 */
couponCodeSchema.statics.isValidForUse = async function (code, userId = null) {
    try {
        const coupon = await this.findOne({ code: code.toUpperCase() });
        
        if (!coupon) {
            return { valid: false, message: "Coupon not found" };
        }
        
        if (!coupon.is_active) {
            return { valid: false, message: "Coupon is not active" };
        }
        
        if (coupon.expired_date < new Date()) {
            return { valid: false, message: "Coupon has expired" };
        }
        
        if (coupon.usage_limit && coupon.users_used.length >= coupon.usage_limit) {
            return { valid: false, message: "Coupon usage limit reached" };
        }
        
        if (userId && coupon.usage_per_user_limit > 1) {
            const userUsageCount = coupon.users_used.filter(
                id => id.equals(userId)
            ).length;
            
            if (userUsageCount >= coupon.usage_per_user_limit) {
                return { valid: false, message: "You've already used this coupon maximum times" };
            }
        }
        
        return { valid: true, coupon };
    } catch (error) {
        console.log(error.message);
        return { valid: false, message: "Error validating coupon" };
    }
};

const CouponCode = mongoose.model("CouponCode", couponCodeSchema);
module.exports = CouponCode;
