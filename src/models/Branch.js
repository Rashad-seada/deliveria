const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const branchSchema = new Schema(
    {
        restaurant_id: {
            type: Schema.Types.ObjectId,
            ref: "restaurant",
            required: true
        },
        name: {
            type: String,
            required: true,
            description: "Branch name/location"
        },
        address: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            required: true
        },
        coordinates: {
            latitude: {
                type: Number,
                required: true
            },
            longitude: {
                type: Number,
                required: true
            }
        },
        delivery_fee: {
            type: Number,
            description: "Delivery fee specific to this branch"
        },
        opening_time: {
            type: String, // HH:mm format
            required: true
        },
        closing_time: {
            type: String, // HH:mm format
            required: true
        },
        is_open: {
            type: Boolean,
            default: true
        },
        manager_id: {
            type: Schema.Types.ObjectId,
            ref: "User",
            description: "Manager responsible for this branch"
        },
        staff: [{
            type: Schema.Types.ObjectId,
            ref: "User"
        }],
        inventory: [{
            item_id: {
                type: Schema.Types.ObjectId,
                ref: "item"
            },
            quantity: Number,
            low_stock_threshold: Number
        }],
        orders_count: {
            type: Number,
            default: 0
        },
        is_active: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

const Branch = mongoose.model("Branch", branchSchema);
module.exports = Branch;
