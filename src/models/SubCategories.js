const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const subCategorySchema = new Schema(
    {
        name_en: {
            type: String,
            required: true,
        },
        name_ar: {
            type: String,
            required: true,
        },
        super_category_id: {
            type: Schema.Types.ObjectId,
            ref: "super_categories",
            required: true
        },
    },
    { timestamps: true }
);

const SubCategory = mongoose.model("sub_categories", subCategorySchema);
module.exports = SubCategory;
