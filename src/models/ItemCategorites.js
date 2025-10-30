const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const itemCategorySchema = new Schema(
    {
        name_en: {
            type: String,
            required: true,
        },
        name_ar: {
            type: String,
            required: true,
        },
        restaurant_id: {
            type: Schema.Types.ObjectId,
            ref: "restaurant",
            required: true
        },
    },
    { timestamps: true }
);

const ItemCategory = mongoose.model("item_categories", itemCategorySchema);
module.exports = ItemCategory;
