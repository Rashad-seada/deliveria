const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const systemSchema = new Schema(
    {
        is_uploaded: {
            type: Boolean,
        },
    },
    { timestamps: true }
);

const System = mongoose.model("system", systemSchema);
module.exports = System;
