const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const itemSchema = new Schema(
    {
        restaurant_id: {
            type: Schema.Types.ObjectId,
            ref: "restaurant",
            required: true
        },
        branch_id: {
            type: Schema.Types.ObjectId,
            ref: "Branch",
            default: null // Will be used for multi-branch support
        },
        photo: {
            type: String,
            required: true,
        },
        name: {
            type: String,
            required: true,
        },
        description: {
            type: String,
        },
        enable: {
            type: Boolean,
        },
        item_category: {
            type: Schema.Types.ObjectId,
            required: true
        },
        have_option: {
            type: Boolean
        },
        // Inventory Management
        quantity: {
            type: Number,
            default: 0,
            min: 0
        },
        low_stock_threshold: {
            type: Number,
            default: 5,
            description: "Minimum quantity before low-stock alert is triggered"
        },
        low_stock_alert_sent: {
            type: Boolean,
            default: false
        },
        sizes: [
            {
                size: {
                    type: String,
                    required: true
                },
                price_before: {
                    type: Number,
                    required: true
                },
                price_after: {
                    type: Number,
                    required: true
                },
                offer: {
                    type: Number,
                    required: true
                },
                quantity: {
                    type: Number,
                    default: 0,
                    min: 0
                }
            }
        ],
        toppings: [
            {
                topping: {
                    type: String,
                    required: true
                },
                price: {
                    type: Number,
                    required: true
                },
            }
        ],
    },
    { timestamps: true }
);

const Item = mongoose.model("item", itemSchema);
module.exports = Item;
