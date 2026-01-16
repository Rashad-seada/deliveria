const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const zoneSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true
        },
        description: {
            type: String,
            default: ""
        },
        type: {
            type: String,
            enum: ["circular", "polygon"],
            required: true
        },
        // For circular zones
        center: {
            latitude: Number,
            longitude: Number
        },
        radius: {
            type: Number
        },
        // For polygon zones
        polygon: [{
            lat: Number,
            lng: Number
        }],
        // Coverage area boundaries
        boundaries: {
            northeast: { lat: Number, lng: Number },
            southwest: { lat: Number, lng: Number }
        },
        status: {
            type: String,
            enum: ["Active", "Inactive"],
            default: "Active"
        },
        // Associated restaurants (optional, for faster queries)
        restaurants: [{
            type: Schema.Types.ObjectId,
            ref: "restaurant"
        }],
        delivery_fee_multiplier: {
            type: Number,
            default: 1.0
        },
        is_priority: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

// Geospatial index for circular zone queries
zoneSchema.index({ "center": "2dsphere" });

const Zone = mongoose.model("Zone", zoneSchema);
module.exports = Zone;
