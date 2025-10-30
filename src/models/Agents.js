const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const agentSchema = new Schema({
    status: {
        type: String,
        enum: ['AVAILABLE', 'BUSY', 'OFFLINE'],
        default: 'OFFLINE'
    },
    current_location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],  // [longitude, latitude]
            required: true,
            default: [0, 0]
        }
    },
    active_order: {
        type: Schema.Types.ObjectId,
        ref: 'order'
    },
    statistics: {
        total_orders: {
            type: Number,
            default: 0
        },
        total_distance: {
            type: Number,
            default: 0
        },
        average_rating: {
            type: Number,
            default: 0
        },
        total_earnings: {
            type: Number,
            default: 0
        }
    },
    {
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
        ban: {
            type: Boolean,
            required: true,
        },
    },
    { timestamps: true }
);

agentSchema.statics.isThisUserName = async function (phone) {
    if (!phone) throw new Error("Invalid phone");
    try {
        const user = await this.findOne({ phone: phone });
        if (!user) return false;

        return true;
    } catch (error) {
        console.log(error.message);
        return false;
    }
};

const Agent = mongoose.model("agent", agentSchema);
module.exports = Agent;
