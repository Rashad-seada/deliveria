const SubCategory = require("../models/SubCategories");
const SuperCategories = require("../models/SuperCategories");

module.exports.createSuperCategories = async (req, res) => {
    try {
        let superCategory = new SuperCategories({
            logo: req.file.path,
            name_en: req.body.name_en.trim(),
            name_ar: req.body.name_ar.trim(),
        })

        superCategory.save()
            .then(response => {
                return res.status(200).json({
                    message: "Category is created"
                })
            })
    } catch (error) {
        return res.json({
            message: "Error"
        })
    }
}

module.exports.getAllSuperCategories = async (req, res, next) => {
    try {
        const superCategories = await SuperCategories.find();

        const result = await Promise.all(superCategories.map(async (superCategory) => {
            const subCategories = await SubCategory.find({ super_category_id: superCategory._id });

            // Add "الكل" and "all" to the subCategories array
            const subCategoriesWithAll = [
                {
                    _id: "all",
                    name_ar: "الكل",
                    name_en: "all",
                    super_category_id: superCategory._id,
                    createdAt: "2025-08-15T13:50:19.769Z",
                    updatedAt: "2025-08-15T13:50:19.769Z",
                    __v: 0
                },
                ...subCategories.map(sub => sub.toObject())
            ];

            return {
                ...superCategory.toObject(),
                subCategories: subCategoriesWithAll
            };
        }));

        return res.status(200).json({ response: result });
    } catch (error) {
        return res.json({
            message: "Error"
        })
    }
}