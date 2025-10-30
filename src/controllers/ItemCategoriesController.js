const ItemCategory = require("../models/ItemCategorites");

module.exports.createItemCategory = async (req, res) => {
    try {
        let itemCategory = new ItemCategory({
            restaurant_id: req.body.decoded.id,
            name_en: req.body.name_en.trim(),
            name_ar: req.body.name_ar.trim(),
        })

        itemCategory.save()
            .then(response => {
                return res.status(200).json({
                    message: "Item category is created"
                })
            })
    } catch (error) {
        return res.json({
            message: "Error"
        })
    }
}

module.exports.getAllItemCategories = async (req, res, next) => {
    try {
        ItemCategory.find({ restaurant_id: req.body.decoded.id }).then(itemCategories => {
            return res.json({
                itemCategories: itemCategories
            })
        })
    } catch (error) {
        return res.json({
            message: "Error"
        })
    }
}

module.exports.getAllItemCategoriesForUser = async (req, res, next) => {
    try {
        const itemCategories = await ItemCategory.find({ restaurant_id: req.params.id })

        const itemCategoriesWithAll = [
            {
                _id: "all",
                name_ar: "الكل",
                name_en: "all",
                restaurant_id: req.params.id,
                createdAt: "2025-08-15T13:50:19.769Z",
                updatedAt: "2025-08-15T13:50:19.769Z",
                __v: 0
            },
            ...itemCategories.map(sub => sub.toObject())
        ];

        return res.json({
            itemCategories: itemCategoriesWithAll
        })
    } catch (error) {
        return res.json({
            message: "Error"
        })
    }
}