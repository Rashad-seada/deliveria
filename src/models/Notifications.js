const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const notificationSchema = new Schema(
    {
        title: {
            type: String,
            default: "Deliveria"
        },
        message: {
            type: String,
            required: true,
        },
        sender_id: {
            type: Schema.Types.ObjectId,
            default: null
        },
        user_id: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "User"
        },
        seen: {
            type: Boolean,
            default: false,
            required: true
        },
        type: {
            type: String,
            enum: ["ORDER_STATUS", "ALERT", "URGENT", "PROMOTIONAL", "REWARD"],
            default: "ORDER_STATUS"
        },
        related_order_id: {
            type: Schema.Types.ObjectId,
            ref: "Order",
            default: null
        },
        action_url: {
            type: String,
            default: null
        }
    },
    { timestamps: true }
);

// Index for faster queries
notificationSchema.index({ user_id: 1, createdAt: -1 });
notificationSchema.index({ user_id: 1, seen: 1 });

const Notification = mongoose.model("notification", notificationSchema);
module.exports = Notification;
