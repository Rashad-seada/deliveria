const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const itemSchema = new Schema(
    {
        restaurant_id: {
            type: Schema.Types.ObjectId,
            ref: "restaurant",
            required: true
        },
        photo: {
            type: String,
            required: true,
        },
        name: {
            type: String,
            required: true,
        },
        description: {
            type: String,
        },
        enable: {
            type: Boolean,
        },
        item_category: {
            type: Schema.Types.ObjectId,
            required: true
        },
        have_option: {
            type: Boolean
        },
        sizes: [
            {
                size: {
                    type: String,
                    required: true
                },
                price_before: {
                    type: Number,
                    required: true
                },
                price_after: {
                    type: Number,
                    required: true
                },
                offer: {
                    type: Number,
                    required: true
                },
            }
        ],
        toppings: [
            {
                topping: {
                    type: String,
                    required: true
                },
                price: {
                    type: Number,
                    required: true
                },
            }
        ],
    },
    { timestamps: true }
);

const Item = mongoose.model("item", itemSchema);
module.exports = Item;
