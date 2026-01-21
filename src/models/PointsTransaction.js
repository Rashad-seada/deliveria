// models/PointsTransaction.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const pointsTransactionSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    orderId: {
        type: Schema.Types.ObjectId,
        ref: 'Order',
        default: null
    },
    type: {
        type: String,
        enum: ['earn', 'redeem', 'expire', 'admin_adjust'],
        required: true
    },
    points: {
        type: Number,
        required: true // Positive for earn, negative for redeem/expire
    },
    balance: {
        type: Number,
        required: true // Running total after this transaction
    },
    description: {
        type: String,
        default: ""
    },
    adminId: {
        type: Schema.Types.ObjectId,
        ref: 'Admin',
        default: null // Only set for admin_adjust type
    }
}, { timestamps: true });

// Indexes for efficient querying
pointsTransactionSchema.index({ userId: 1, createdAt: -1 });
pointsTransactionSchema.index({ type: 1 });
pointsTransactionSchema.index({ orderId: 1 });

module.exports = mongoose.model("PointsTransaction", pointsTransactionSchema);
