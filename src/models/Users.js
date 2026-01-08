// models/User.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  phone: { type: String, unique: true },
  email: { type: String, default: "N/A" },
  password: { type: String, required: true },
  ban: { type: Boolean, default: false },
  fcm_token: { type: String, default: null },
  points: { type: Number, default: 0 },
  address_id: { type: Schema.Types.ObjectId, ref: "address", default: null },
  
  // User preferences
  preferred_payment_method: {
    type: String,
    enum: ["Cash", "Card", "Digital Wallet"],
    default: "Cash"
  },
  
  // Order history tracking
  statistics: {
    total_orders: { type: Number, default: 0 },
    total_spent: { type: Number, default: 0 },
    average_rating_given: { type: Number, default: 0 },
    last_order_date: Date
  },
  
  // Favorite restaurants
  favorite_restaurants: [{
    type: Schema.Types.ObjectId,
    ref: "restaurant"
  }],
  
  // Redeemed coupons
  redeemed_coupons: [{
    coupon_id: { type: Schema.Types.ObjectId, ref: "CouponCode" },
    redeemed_at: { type: Date, default: Date.now }
  }],
  
  // Account status
  is_verified: { type: Boolean, default: false },
  verification_date: Date,
  
  is_guest: { type: Boolean, default: false }
}, { timestamps: true });

userSchema.statics.isPhoneTaken = async function (phone) {
  if (!phone) throw new Error("Invalid phone");
  const user = await this.findOne({ phone });
  return !!user;
};

// Index for frequently queried fields
userSchema.index({ phone: 1 });
userSchema.index({ email: 1 });

module.exports = mongoose.model("User", userSchema);
