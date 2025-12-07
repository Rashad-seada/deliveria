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
    },
    { timestamps: true }
);

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
