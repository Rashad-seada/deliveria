const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const offerSchema = new Schema(
    {
        title: {
            type: String,
            required: true,
            description: "Name of the offer"
        },
        description: {
            type: String,
            description: "Detailed description of the offer"
        },
        offer_type: {
            type: String,
            enum: ["Percentage", "FixedAmount", "BuyXGetY", "FreeItem"],
            required: true,
            description: "Type of discount offered"
        },
        value: {
            type: Number,
            required: true,
            description: "Discount value (percentage or fixed amount)"
        },
        maximum_discount: {
            type: Number,
            description: "Max discount for percentage offers"
        },
        minimum_purchase: {
            type: Number,
            default: 0,
            description: "Minimum cart value to apply offer"
        },
        // Restaurant-specific offer
        restaurant_id: {
            type: Schema.Types.ObjectId,
            ref: "restaurant",
            default: null,
            description: "null = global offer, specific ID = restaurant-specific"
        },
        // Applicable items (if null, applies to all)
        applicable_items: [{
            type: Schema.Types.ObjectId,
            ref: "item"
        }],
        // Applicable categories (if null, applies to all)
        applicable_categories: [{
            type: Schema.Types.ObjectId,
            ref: "item_category"
        }],
        // Activation conditions
        activation_conditions: {
            start_date: {
                type: Date,
                required: true
            },
            end_date: {
                type: Date,
                required: true
            },
            day_of_week: [{
                type: String,
                enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            }],
            start_time: String, // HH:mm format
            end_time: String    // HH:mm format
        },
        usage_limits: {
            max_uses: {
                type: Number,
                description: "Total max uses across all users"
            },
            max_uses_per_user: {
                type: Number,
                description: "Max uses per individual user"
            },
            current_uses: {
                type: Number,
                default: 0
            }
        },
        // For BuyXGetY offer
        buy_quantity: Number,
        get_quantity: Number,
        free_item_id: {
            type: Schema.Types.ObjectId,
            ref: "item"
        },
        status: {
            type: String,
            enum: ["Active", "Inactive", "Scheduled"],
            default: "Inactive"
        },
        is_stackable: {
            type: Boolean,
            default: false,
            description: "Can this offer be combined with coupons"
        },
        created_by: {
            type: Schema.Types.ObjectId,
            ref: "Admin"
        }
    },
    { timestamps: true }
);

// Index for faster queries
offerSchema.index({ restaurant_id: 1, status: 1 });
offerSchema.index({ "activation_conditions.start_date": 1, "activation_conditions.end_date": 1 });

const Offer = mongoose.model("Offer", offerSchema);
module.exports = Offer;
