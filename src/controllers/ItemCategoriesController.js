const ItemCategory = require("../models/ItemCategorites");

module.exports.createItemCategory = async (req, res) => {
    try {
        const { name_en, name_ar } = req.body;

        if (!name_en || !name_ar) {
            return res.status(400).json({
                message: "English and Arabic names are required."
            });
        }

        let itemCategory = new ItemCategory({
            restaurant_id: req.decoded.id, // Correctly access decoded token from req
            name_en: name_en.trim(),
            name_ar: name_ar.trim(),
        });

        const savedCategory = await itemCategory.save();

        return res.status(201).json({
            message: "Item category created successfully",
            itemCategory: savedCategory
        });

    } catch (error) {
        console.error("Error creating item category:", error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: "Validation error", errors });
        }
        return res.status(500).json({
            message: "Server error while creating item category",
            error: error.message
        });
    }
}

module.exports.getAllItemCategories = async (req, res, next) => {
    try {
        // Fix: Use req.decoded instead of req.body.decoded
        if (!req.decoded || !req.decoded.id) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        ItemCategory.find({ restaurant_id: req.decoded.id }).then(itemCategories => {
            return res.status(200).json({
                success: true,
                itemCategories: itemCategories
            })
        })
    } catch (error) {
        console.error("getAllItemCategories error:", error);
        return res.status(500).json({
            message: "Server Error",
            error: error.message
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