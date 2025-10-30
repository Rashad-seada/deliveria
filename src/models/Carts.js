const mongoose = require("mongoose");
const Restaurant = require("./Restaurants");
const Schema = mongoose.Schema;

const cartSchema = new Schema(
    {
        user_id: {
            type: Schema.Types.ObjectId,
            ref: "user",
            required: true,
        },
        coupon_code_id: {
            type: Schema.Types.ObjectId,
            ref: "couponCode",
        },
        carts: [
            {
                restaurant_id: {
                    type: Schema.Types.ObjectId,
                    ref: "restaurant",
                    required: true,
                },
                items: [
                    {
                        item_id: {
                            type: Schema.Types.ObjectId,
                            ref: "item",
                            required: true,
                        },
                        size: {
                            type: Schema.Types.ObjectId,
                            required: true,
                        },
                        quantity: {
                            type: Number,
                            required: true,
                        },
                        toppings: [{
                            topping: {
                                type: Schema.Types.ObjectId,
                            },
                            topping_quantity: {
                                type: Number,
                            },
                        }],
                        description: {
                            type: String,
                        },
                    }
                ]
            }
        ],
    },
    { timestamps: true }
);

const Cart = mongoose.model("cart", cartSchema);
module.exports = Cart;
