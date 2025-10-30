const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const addressSchema = new Schema(
    {
        user_id: {
            type: Schema.Types.ObjectId,
            ref: "user"
        },
        address_title: {
            type: String,
            required: true,
        },
        phone: {
            type: String,
            required: true,
        },
        details: {
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
    },
    { timestamps: true }
);

const Address = mongoose.model("address", addressSchema);
module.exports = Address;
