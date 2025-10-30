const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const sliderSchema = new Schema(
    {
        restaurant_id: {
            type: Schema.Types.ObjectId,
            ref: "restaurant"
        },
        image: {
            type: String,
            required: true,
        },
    },
    { timestamps: true }
);

const Slider = mongoose.model("slider", sliderSchema);
module.exports = Slider;
