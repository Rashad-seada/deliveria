// models/RewardTier.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const rewardTierSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    pointsRequired: {
        type: Number,
        required: true,
        unique: true,
        min: 1
    },
    discountValue: {
        type: Number,
        required: true,
        min: 1
    },
    discountType: {
        type: String,
        enum: ['percentage', 'fixed'],
        default: 'percentage'
    },
    maxDiscount: {
        type: Number,
        default: null // Cap for percentage discounts (null = no cap)
    },
    description: {
        type: String,
        default: ""
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Index for frequently queried fields
rewardTierSchema.index({ pointsRequired: 1 });
rewardTierSchema.index({ isActive: 1 });

module.exports = mongoose.model("RewardTier", rewardTierSchema);
