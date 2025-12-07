// models/Order.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

require('./Restaurants'); // This ensures the Restaurant model is registered before Order model uses it.
const orderSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },

    order_type: { type: String, enum: ["Single", "Multi"], required: true },

    order_status: {
      type: String,
      enum: [
        "Pending Approval", // بانتظار الموافقة
        "Preparing",        // جاري التحضير
        "Ready for Delivery", // جاهز للتسليم
        "On the way",       // تم الاستلام / في الطريق
        "Delivered",        // تم التسليم
        "Completed",        // مكتمل (بعد التسليم)
        "Canceled"          // ملغي
      ],
      default: "Pending Approval"
    },

    status_timeline: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: String
      }
    ],

    agent: {
      agent_id: { type: Schema.Types.ObjectId, ref: "Agent" },
      assigned_at: Date,
      pickup_time: Date,
      delivery_time: Date
    },

    delivery_details: {
      estimated_time: Number, // بالدقائق
      actual_time: Number,
      distance: Number,       // بالكيلومترات
      delivery_fee: Number
    },

    address: {
      address_title: String,
      phone: String,
      details: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    },

    orders: [
      {
        restaurant_id: {
          type: Schema.Types.ObjectId,
          ref: "restaurant",
          required: true
        },
        items: [
          {
            item_details: {
              item_id: String,
              name: String,
              description: String,
              photo: String
            },
            size_details: {
              size_id: String,
              size: String,
              price_before: Number,
              price_after: Number,
              offer: Number,
              quantity: Number,
              price_Of_quantity: Number
            },
            topping_details: [
              {
                topping_id: String,
                topping: String,
                price: Number,
                quantity: Number,
                price_Of_quantity: Number
              }
            ],
            description: String,
            total_price: Number
          }
        ],
        price_of_restaurant: Number,
        status: {
          type: String,
          default: "Pending Approval"
        },
        notification_sent: { type: Boolean, default: false },
        cancel_me: Boolean
      }
    ],

    final_price_without_delivery_cost: Number,
    final_delivery_cost: Number,
    final_price: Number,

    delivery_type: String,
    payment_type: String,

    status: { type: String, default: "Pending Approval" },
    order_id: Number
  },
  { timestamps: true } // ← هنا كان الخطأ في الكود السابق
);

module.exports = mongoose.model("Order", orderSchema);
