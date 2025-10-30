const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema(
    {
        first_name: {
            type: String,
            required: true,
        },
        last_name: {
            type: String,
            required: true,
        },
        phone: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
        },
        password: {
            type: String,
            required: true,
        },
        address_id: {
            type: Schema.Types.ObjectId,
            ref: "address"
        },
        ban: {
            type: Boolean,
            required: true,
        },
    },
    { timestamps: true }
);

userSchema.statics.isThisPhoneUse = async function (phone) {
    if (!phone) throw new Error("Invalid Phone number");
    try {
        const user = await this.findOne({ phone: phone });
        if (!user) return false;

        return true;
    } catch (error) {
        console.log(error.message);
        return false;
    }
};

const User = mongoose.model("user", userSchema);
module.exports = User;
