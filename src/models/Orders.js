const mongoose = require("mongoose");
const Restaurant = require("./Restaurants");
const Schema = mongoose.Schema;

const orderSchema = new Schema(
    {
        user_id: {
            type: Schema.Types.ObjectId,
            ref: "user",
            required: true,
        },
        order_status: {
            type: String,
            enum: [
                'PENDING',          // عند إنشاء الطلب
                'CONFIRMED',        // تم تأكيد الطلب من المطعم
                'PREPARING',        // جاري التحضير
                'READY',           // جاهز للاستلام
                'PICKED_UP',       // تم الاستلام من المندوب
                'ON_WAY',          // في الطريق
                'DELIVERED',       // تم التوصيل
                'CANCELLED'        // تم الإلغاء
            ],
            default: 'PENDING'
        },
        status_timeline: [{
            status: {
                type: String,
                required: true
            },
            timestamp: {
                type: Date,
                default: Date.now
            },
            note: String
        }],
        agent: {
            agent_id: {
                type: Schema.Types.ObjectId,
                ref: "agent"
            },
            assigned_at: Date,
            pickup_time: Date,
            delivery_time: Date
        },
        delivery_details: {
            estimated_time: Number,  // بالدقائق
            actual_time: Number,     // بالدقائق
            distance: Number,        // بالكيلومترات
            delivery_fee: Number
        },
        rating: {
            restaurant_rating: {
                score: { type: Number, min: 1, max: 5 },
                comment: String
            },
            delivery_rating: {
                score: { type: Number, min: 1, max: 5 },
                comment: String
            }
        },
        address: {
            address_title: {
                type: String,
                required: true,
            },
            phone: {
                type: String,
                required: true,
            },
            details: {
                type: String,
                required: true,
            },
            coordinates: {
                latitude: {
                    type: String,
                },
                longitude: {
                    type: String,
                }
            },
        },
        orders: [
            {
                restaurant_id: {
                    type: Schema.Types.ObjectId,
                    ref: "restaurant",
                    required: true,
                },
                items: [
                    {
                        item_details: {
                            item_id: {
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
                            photo: {
                                type: String,
                                required: true,
                            },
                        },
                        size_details: {
                            size_id: {
                                type: String,
                                required: true,
                            },
                            size: {
                                type: String,
                                required: true,
                            },
                            price_before: {
                                type: Number,
                                required: true,
                            },
                            price_after: {
                                type: Number,
                                required: true,
                            },
                            offer: {
                                type: Number,
                                required: true,
                            },
                            quantity: {
                                type: Number,
                                required: true,
                            },
                            price_Of_quantity: {
                                type: Number,
                                required: true,
                            },
                        },
                        topping_details: [{
                            topping_id: {
                                type: String
                            },
                            topping: {
                                type: String
                            },
                            price: {
                                type: Number
                            },
                            quantity: {
                                type: Number
                            },
                            price_Of_quantity: {
                                type: Number
                            }
                        }],
                        description: {
                            type: String
                        },
                        total_price: {
                            type: Number
                        }
                    }
                ],
                price_of_restaurant: {
                    type: Number,
                    required: true
                },
                status: {
                    type: String,
                    enum: ["New", "Preparing", "Ready for pickup", "Out of delivery", "Completed", "Pick up", "On the way", "Delivered", "Canceled", "Accepted"],
                    required: true
                },
                cancel_me: {
                    type: Boolean,
                    required: true
                },
            },
        ],
        final_price_without_delivery_cost: {
            type: Number,
            required: true,
        },
        final_delivery_cost: {
            type: Number,
            required: true,
        },
        final_price: {
            type: Number,
            required: true,
        },
        delivery_type: {
            type: String,
            required: true,
        },
        delivery_id: {
            type: Schema.Types.ObjectId,
        },
        payment_type: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ["New", "Preparing", "Ready for pickup", "Out of delivery", "Completed", "Pick up", "On the way", "Delivered", "Canceled", "Accepted"],
            required: true
        },
        order_id: {
            type: Number,
            required: true
        }
    },
    { timestamps: true }
);

const Order = mongoose.model("order", orderSchema);
module.exports = Order;
