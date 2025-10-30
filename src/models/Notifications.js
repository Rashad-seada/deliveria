const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const notificationSchema = new Schema(
    {
        message: {
            type: String,
            required: true,
        },
        sender_id: {
            type: Schema.Types.ObjectId,
            required: true
        },
        user_id: {
            type: Schema.Types.ObjectId,
            required: true
        },
        seen: {
            type: Boolean,
            required: true
        },
    },
    { timestamps: true }
);

const Notification = mongoose.model("notification", notificationSchema);
module.exports = Notification;
