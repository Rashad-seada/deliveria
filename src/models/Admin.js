const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const adminSchema = new Schema(
    {
        phone: {
            type: String,
            required: true,
        },
        password: {
            type: String,
            required: true,
        },
    },
    { timestamps: true }
);

adminSchema.statics.isThisUserName = async function (phone) {
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

const Admin = mongoose.model("admin", adminSchema);
module.exports = Admin;
