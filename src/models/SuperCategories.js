const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const superCategoriesSchema = new Schema(
    {
        name_en: {
            type: String,
            required: true,
        },
        name_ar: {
            type: String,
            required: true,
        },
        logo: {
            type: String,
            required: true,
        },
    },
    { timestamps: true }
);

const SuperCategories = mongoose.model("super_categories", superCategoriesSchema);
module.exports = SuperCategories;
