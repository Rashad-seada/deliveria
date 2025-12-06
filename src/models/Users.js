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
  address_id: { type: Schema.Types.ObjectId, ref: "address", default: null }
}, { timestamps: true });

userSchema.statics.isPhoneTaken = async function (phone) {
  if (!phone) throw new Error("Invalid phone");
  const user = await this.findOne({ phone });
  return !!user;
};

module.exports = mongoose.model("User", userSchema);
