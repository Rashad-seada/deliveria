const SubCategory = require("../models/SubCategories");
const SuperCategories = require("../models/SuperCategories");

// @desc    Create a new sub category
// @route   POST /api/sub_categories/create
// @access  Private (Admin)
module.exports.createSubCategory = async (req, res) => {
    try {
        const { name_en, name_ar, super_category_id } = req.body;

        if (!name_en || !name_ar || !super_category_id) {
            return res.status(400).json({ 
                message: "All fields are required: name_en, name_ar, super_category_id" 
            });
        }

        // التحقق من وجود الفئة الرئيسية
        const superCategory = await SuperCategories.findById(super_category_id);
        if (!superCategory) {
            return res.status(404).json({ message: "Super category not found" });
        }

        // التحقق من عدم تكرار الاسم
        const existingSubCategory = await SubCategory.findOne({
            $or: [
                { name_en: name_en.trim() },
                { name_ar: name_ar.trim() }
            ],
            super_category_id: super_category_id
        });

        if (existingSubCategory) {
            return res.status(409).json({ 
                message: "Sub-category name already exists in this super category" 
            });
        }

        let subCategory = new SubCategory({
            name_en: name_en.trim(),
            name_ar: name_ar.trim(),
            super_category_id: super_category_id
        });

        await subCategory.save();

        return res.status(201).json({
            message: "Sub-category created successfully",
            subCategory: subCategory
        });

    } catch (error) {
        console.error("Error creating sub-category:", error);
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ 
                message: "Validation error", 
                errors 
            });
        }
        
        return res.status(500).json({ 
            message: "Server error while creating sub-category",
            error: error.message 
        });
    }
};

// @desc    Get all sub categories for a specific super category
// @route   GET /api/sub_categories/:super_category_id
// @access  Public
module.exports.getSubCategoriesBySuper = async (req, res) => {
    try {
        const { super_category_id } = req.params;
        
        // التحقق من وجود الفئة الرئيسية
        const superCategory = await SuperCategories.findById(super_category_id);
        if (!superCategory) {
            return res.status(404).json({ message: "Super category not found" });
        }

        const subCategories = await SubCategory.find({ super_category_id: super_category_id });
        
        return res.status(200).json({ 
            success: true,
            superCategory: {
                id: superCategory._id,
                name_en: superCategory.name_en,
                name_ar: superCategory.name_ar,
                logo: superCategory.logo
            },
            subCategories 
        });
        
    } catch (error) {
        console.error("Error fetching sub-categories:", error);
        return res.status(500).json({ 
            message: "Server error while fetching sub-categories",
            error: error.message 
        });
    }
};

// @desc    Get all sub categories
// @route   GET /api/sub_categories
// @access  Public
module.exports.getAllSubCategories = async (req, res) => {
    try {
        const subCategories = await SubCategory.find().populate('super_category_id', 'name_en name_ar logo');
        
        return res.status(200).json({ 
            success: true,
            subCategories 
        });
        
    } catch (error) {
        console.error("Error fetching all sub-categories:", error);
        return res.status(500).json({ 
            message: "Server error while fetching sub-categories",
            error: error.message 
        });
    }
};

// @desc    Update a sub category
// @route   PUT /api/sub_categories/:id
// @access  Private (Admin)
module.exports.updateSubCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name_en, name_ar } = req.body;

        if (!name_en && !name_ar) {
            return res.status(400).json({ 
                message: "At least one field is required: name_en or name_ar" 
            });
        }

        const updateData = {};
        if (name_en) updateData.name_en = name_en.trim();
        if (name_ar) updateData.name_ar = name_ar.trim();

        const updatedSubCategory = await SubCategory.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedSubCategory) {
            return res.status(404).json({ message: "Sub-category not found" });
        }

        return res.status(200).json({
            message: "Sub-category updated successfully",
            subCategory: updatedSubCategory
        });

    } catch (error) {
        console.error("Error updating sub-category:", error);
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ 
                message: "Validation error", 
                errors 
            });
        }
        
        return res.status(500).json({ 
            message: "Server error while updating sub-category",
            error: error.message 
        });
    }
};

// @desc    Delete a sub category
// @route   DELETE /api/sub_categories/:id
// @access  Private (Admin)
module.exports.deleteSubCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedSubCategory = await SubCategory.findByIdAndDelete(id);

        if (!deletedSubCategory) {
            return res.status(404).json({ message: "Sub-category not found" });
        }

        return res.status(200).json({ 
            message: "Sub-category deleted successfully" 
        });

    } catch (error) {
        console.error("Error deleting sub-category:", error);
        return res.status(500).json({ 
            message: "Server error while deleting sub-category",
            error: error.message 
        });
    }
};