// models/Order.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

require('./Restaurants'); // This ensures the Restaurant model is registered before Order model uses it.

// Order status enum based on state machine
const ORDER_STATUS = {
  WAITING_FOR_APPROVAL: 'Waiting for Approval',
  APPROVED_PREPARING: 'Approved / Preparing',
  PACKED_READY_FOR_PICKUP: 'Packed / Ready for Pickup',
  ON_THE_WAY: 'On the Way',
  DELIVERED: 'Delivered',
  CANCELED: 'Canceled'
};

const orderSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User" }, // Optional for guest orders

    // Guest user support - required when not using registered user
    guest_user: {
      name: String,
      phone: String,
      email: String
    },

    order_type: { type: String, enum: ["Single", "Multi"], required: true },

    order_status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.WAITING_FOR_APPROVAL
    },

    status_timeline: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: String,
        updated_by: { type: Schema.Types.ObjectId, ref: "User" }
      }
    ],

    agent: {
      agent_id: { type: Schema.Types.ObjectId, ref: "Agent" },
      assigned_at: Date,
      pickup_time: Date,
      delivery_time: Date
    },

    delivery_details: {
      estimated_time: Number, // in minutes
      actual_time: Number,
      distance: Number,       // in kilometers
      delivery_fee: Number,
      estimated_arrival: Date
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

    // Sub-orders for multi-restaurant orders
    orders: [
      {
        restaurant_id: {
          type: Schema.Types.ObjectId,
          ref: "restaurant",
          required: true
        },
        branch_id: {
          type: Schema.Types.ObjectId,
          ref: "restaurant",
          default: null
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
        // Commission tracking per sub-order
        commission_percentage: { type: Number, default: 0 },
        commission_amount: { type: Number, default: 0 },
        restaurant_net_amount: { type: Number, default: 0 }, // Amount restaurant receives after commission
        status: {
          type: String,
          enum: Object.values(ORDER_STATUS),
          default: ORDER_STATUS.WAITING_FOR_APPROVAL
        },
        notification_sent: { type: Boolean, default: false },
        delay_notification_sent: { type: Boolean, default: false },
        cancel_me: Boolean,
        response_time: Date // When restaurant responded
      }
    ],

    // Pricing breakdown
    final_price_without_delivery_cost: Number,
    final_delivery_cost: Number,
    final_price: Number,

    // Total commission for the entire order
    total_commission_amount: { type: Number, default: 0 },
    total_restaurant_net: { type: Number, default: 0 }, // Sum of all restaurant net amounts

    // Applied discounts
    coupon_code: {
      code: String,
      discount_percentage: Number,
      discount_amount: Number,
      coupon_id: { type: Schema.Types.ObjectId, ref: "CouponCode" }
    },

    applied_offers: [{
      offer_id: { type: Schema.Types.ObjectId, ref: "Offer" },
      discount_amount: Number,
      description: String
    }],

    delivery_type: String,
    payment_type: String,

    // Cancel reason if order was canceled
    cancellation_reason: String,
    canceled_by: { type: String, enum: ["User", "Restaurant", "Admin", "System"] },
    canceled_at: Date,

    status: { type: String, default: ORDER_STATUS.WAITING_FOR_APPROVAL },
    order_id: Number,

    // Multi-order specific tracking
    acceptance_status: {
      accepted_by_restaurants: [{ type: Schema.Types.ObjectId, ref: "restaurant" }],
      rejected_by_restaurants: [{ type: Schema.Types.ObjectId, ref: "restaurant" }],
      first_acceptance_time: Date
    },

    // For delayed order tracking
    delay_notifications: {
      first_delay_notified_at: Date,
      second_delay_notified_at: Date
    },

    // Rating and review
    rating: {
      score: { type: Number, min: 1, max: 5 },
      comment: String,
      rated_at: Date
    }
  },
  { timestamps: true }
);

// Indexes for better query performance
orderSchema.index({ user_id: 1, createdAt: -1 });
orderSchema.index({ order_status: 1 });
orderSchema.index({ "agent.agent_id": 1 });
orderSchema.index({ "orders.restaurant_id": 1 });

module.exports = mongoose.model("Order", orderSchema);
