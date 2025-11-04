const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const agentSchema = new Schema({
  status: { type: String, enum: ["AVAILABLE", "BUSY", "OFFLINE"], default: "OFFLINE" },
  current_location: {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], default: [0, 0] } // [lng, lat]
  },
  active_order: { type: Schema.Types.ObjectId, ref: "Order", default: null },
  statistics: {
    total_orders: { type: Number, default: 0 },
    total_distance: { type: Number, default: 0 },
    average_rating: { type: Number, default: 0 },
    total_earnings: { type: Number, default: 0 }
  },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  user_name: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  ban: { type: Boolean, default: false },
  fcm_token: { type: String, default: null }
}, { timestamps: true });

agentSchema.index({ current_location: "2dsphere" }); // دا ضروري للجغرافيا فقط

agentSchema.statics.isPhoneTaken = async function(phone) {
  if (!phone) throw new Error("Invalid phone");
  const agent = await this.findOne({ phone });
  return !!agent;
};

agentSchema.methods.updateLocation = async function(lng, lat) {
  this.current_location = { type: "Point", coordinates: [lng, lat] };
  return await this.save();
};

module.exports = mongoose.model("Agent", agentSchema);
