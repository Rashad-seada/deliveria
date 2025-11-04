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
    }]
}, { timestamps: true });

couponCodeSchema.statics.isThisCodeIsUsed = async function (code) {
    if (!code) return false;
    try {
        const restaurant = await this.findOne({ code: code });
        if (!restaurant) return false;

        return true;
    } catch (error) {
        console.log(error.message);
        return false;
    }
};

const CouponCode = mongoose.model("CouponCode", couponCodeSchema);
module.exports = CouponCode;
