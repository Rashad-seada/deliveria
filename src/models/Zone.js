const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const zoneSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            description: "Zone name (e.g., Downtown, Suburb, etc)"
        },
        description: {
            type: String,
            default: ""
        },
        type: {
            type: String,
            enum: ["circular", "polygon"],
            required: true,
            description: "Zone shape type"
        },
        // For circular zones
        center: {
            latitude: Number,
            longitude: Number,
            description: "Center coordinates for circular zone"
        },
        radius: {
            type: Number,
            description: "Radius in kilometers for circular zone"
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
            default: 1.0,
            description: "Multiplier for delivery fee in this zone"
        },
        is_priority: {
            type: Boolean,
            default: false,
            description: "Priority zone for faster delivery"
        }
    },
    { timestamps: true }
);

// Geospatial index for circular zone queries
zoneSchema.index({ "center": "2dsphere" });

const Zone = mongoose.model("Zone", zoneSchema);
module.exports = Zone;
