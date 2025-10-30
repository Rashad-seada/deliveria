const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const couponCodeSchema = new Schema(
    {
        restaurant: {
            type: String,
            required: true,
        },
        code: {
            type: String,
            required: true,
        },
        discount: {
            type: Number,
            required: true,
        },
        expired_date: {
            type: String,
            required: true,
        },
        enable: {
            type: Boolean,
            required: true,
        },
        number_enable: {
            type: Number,
            required: true,
        }
    },
    { timestamps: true }
);

couponCodeSchema.statics.isThisCodeIsUsed = async function (code) {
    if (!code) throw new Error("Invalid code");
    try {
        const restaurant = await this.findOne({ code: code });
        if (!restaurant) return false;

        return true;
    } catch (error) {
        console.log(error.message);
        return false;
    }
};

const CouponCode = mongoose.model("couponCode", couponCodeSchema);
module.exports = CouponCode;
