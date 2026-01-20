const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const restaurantSchema = new Schema(
    {
        photo: {
            type: String,
            required: true,
        },
        logo: {
            type: String,
            required: true,
        },
        address_id: { type: Schema.Types.ObjectId, ref: "address", default: null },
        super_category: [{
            type: Schema.Types.ObjectId,
            ref: "super_categories",
            required: true
        }],
        sub_category: [{
            type: Schema.Types.ObjectId,
            ref: "sub_categories",
            required: true
        }],
        name: {
            type: String,
            required: true,
        },
        phone: {
            type: String,
            required: true,
        },
        user_name: {
            type: String,
            required: true,
        },
        password: {
            type: String,
            required: true,
        },
        about_us: {
            type: String,
            required: true,
        },
        rate_number: {
            type: Number,
            required: true,
        },
        user_rated: {
            type: Number,
            required: true,
        },
        rate: {
            type: Number,
            required: true,
        },
        reviews: [
            {
                user_id: {
                    type: Schema.Types.ObjectId,
                    ref: "user",
                    required: true
                },
                message: {
                    type: String,
                    required: true,
                },
                rate: {
                    type: Number,
                    required: true,
                },
                created_at: { type: Date, default: Date.now }
            }
        ],
        delivery_cost: {
            type: Number,
            required: true,
        },
        location_map: {
            type: String,
            required: true,
        },
        coordinates: {
            latitude: {
                type: Number,
            },
            longitude: {
                type: Number,
            }
        },
        open_hour: {
            type: String,
            required: true,
        },
        close_hour: {
            type: String,
            required: true,
        },
        have_delivery: {
            type: Boolean,
            required: true,
        },
        is_show: {
            type: Boolean,
            required: true,
        },
        is_show_in_home: {
            type: Boolean,
            required: true,
        },
        estimated_time: {
            type: Number,
            required: true,
        },
        // New fields for additional features
        discount_rate: {
            type: Number,
            default: 0
        },
        commission_percentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        preparation_time: {
            type: Number,
            default: 15,
            min: 0
        },
        delivery_time: {
            type: Number,
            default: 30,
            min: 0
        },
        is_open: {
            type: Boolean,
            default: true
        },
        allows_guest_orders: {
            type: Boolean,
            default: true
        },
        minimum_order_value: {
            type: Number,
            default: 0
        },
        status: {
            type: String,
            enum: ["Active", "Inactive", "Suspended"],
            default: "Active"
        },
        statistics: {
            total_orders: { type: Number, default: 0 },
            completed_orders: { type: Number, default: 0 },
            total_revenue: { type: Number, default: 0 },
            average_rating: { type: Number, default: 0 }
        },
        fcm_token: {
            type: String,
            default: null
        },
        // Multi-branch support fields
        parent_restaurant_id: {
            type: Schema.Types.ObjectId,
            ref: 'restaurant',
            default: null,
            index: true
        },
        is_main_branch: {
            type: Boolean,
            default: true
        },
        branch_name: {
            type: String,
            default: null  // e.g., "Downtown", "Mall Branch"
        },
        branch_code: {
            type: String,
            unique: true,
            sparse: true  // Allows null but unique when set
        }
    },
    { timestamps: true }
);

// Indexes for better query performance
restaurantSchema.index({ name: "text", about_us: "text" });
restaurantSchema.index({ "coordinates.latitude": 1, "coordinates.longitude": 1 });
restaurantSchema.index({ status: 1, is_show: 1 });

restaurantSchema.statics.isThisUserNameUsed = async function (phone) {
    const trimmedPhone = phone ? phone.trim() : '';
    if (!trimmedPhone) throw new Error("Invalid phone: Phone number cannot be empty.");
    try {
        const restaurant = await this.findOne({ phone: trimmedPhone });
        if (!restaurant) return false;

        return true;
    } catch (error) {
        console.log(error.message);
        return false;
    }
};

const Restaurant = mongoose.model("restaurant", restaurantSchema);
module.exports = Restaurant;
