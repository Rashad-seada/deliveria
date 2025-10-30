const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const favouriteSchema = new Schema(
    {
        user_id: {
            type: Schema.Types.ObjectId,
            ref: "user",
            required: true,
        },
        favourites: [{
            type: Schema.Types.ObjectId,
            ref: "restaurant",
            required: true,
        }],
    },
    { timestamps: true }
);

const Favourite = mongoose.model("favourite", favouriteSchema);
module.exports = Favourite;
