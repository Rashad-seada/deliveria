const SubCategory = require("../models/SubCategories");
const SuperCategories = require("../models/SuperCategories");

module.exports.createSuperCategories = async (req, res) => {
    try {
        // التحقق من وجود الملف
        if (!req.file) {
            return res.status(400).json({ message: "Logo file is required" });
        }

        // التحقق من وجود الحقول المطلوبة
        const { name_en, name_ar } = req.body;
        if (!name_en || !name_ar) {
            return res.status(400).json({ message: "Both name_en and name_ar are required" });
        }

        // إنشاء الفئة الرئيسية
        let superCategory = new SuperCategories({
            logo: req.file.path,
            name_en: name_en.trim(),
            name_ar: name_ar.trim(),
        });

        await superCategory.save();
        
        return res.status(201).json({
            message: "Category created successfully",
            category: {
                id: superCategory._id,
                name_en: superCategory.name_en,
                name_ar: superCategory.name_ar,
                logo: superCategory.logo
            }
        });

    } catch (error) {
        console.error("Error creating super category:", error);
        
        // معالجة أنواع الأخطاء المختلفة
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ 
                message: "Validation error", 
                errors 
            });
        }
        
        if (error.code === 11000) {
            return res.status(400).json({ 
                message: "Category name already exists" 
            });
        }
        
        return res.status(500).json({ 
            message: "Server error while creating category",
            error: error.message 
        });
    }
}

module.exports.getAllSuperCategories = async (req, res) => {
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
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    __v: 0
                },
                ...subCategories.map(sub => sub.toObject())
            ];

            return {
                ...superCategory.toObject(),
                subCategories: subCategoriesWithAll
            };
        }));

        return res.status(200).json({ 
            success: true,
            response: result 
        });
        
    } catch (error) {
        console.error("Error fetching super categories:", error);
        return res.status(500).json({ 
            message: "Server error while fetching categories",
            error: error.message 
        });
    }
}

// دالة إضافية للحصول على فئة رئيسية واحدة
module.exports.getSuperCategoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const superCategory = await SuperCategories.findById(id);
        
        if (!superCategory) {
            return res.status(404).json({ message: "Category not found" });
        }

        return res.status(200).json({ 
            success: true,
            category: superCategory 
        });
        
    } catch (error) {
        console.error("Error fetching super category:", error);
        return res.status(500).json({ 
            message: "Server error while fetching category",
            error: error.message 
        });
    }
}

// دالة لتحديث فئة رئيسية
module.exports.updateSuperCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name_en, name_ar } = req.body;

        const updateData = {};
        if (name_en) updateData.name_en = name_en.trim();
        if (name_ar) updateData.name_ar = name_ar.trim();
        if (req.file) updateData.logo = req.file.path;

        const updatedCategory = await SuperCategories.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedCategory) {
            return res.status(404).json({ message: "Category not found" });
        }

        return res.status(200).json({
            message: "Category updated successfully",
            category: updatedCategory
        });

    } catch (error) {
        console.error("Error updating super category:", error);
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ 
                message: "Validation error", 
                errors 
            });
        }
        
        return res.status(500).json({ 
            message: "Server error while updating category",
            error: error.message 
        });
    }
}

// دالة لحذف فئة رئيسية
module.exports.deleteSuperCategory = async (req, res) => {
    try {
        const { id } = req.params;

        // التحقق من وجود فئات فرعية مرتبطة
        const subCategoriesCount = await SubCategory.countDocuments({ super_category_id: id });
        if (subCategoriesCount > 0) {
            return res.status(400).json({ 
                message: "Cannot delete category. There are sub-categories associated with it." 
            });
        }

        const deletedCategory = await SuperCategories.findByIdAndDelete(id);

        if (!deletedCategory) {
            return res.status(404).json({ message: "Category not found" });
        }

        return res.status(200).json({ 
            message: "Category deleted successfully" 
        });

    } catch (error) {
        console.error("Error deleting super category:", error);
        return res.status(500).json({ 
            message: "Server error while deleting category",
            error: error.message 
        });
    }
}