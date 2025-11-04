const router = require("express").Router();
const superCategoriesController = require("../../controllers/SuperCategoriesController");
const { checkToken } = require("../../auth/token_validation");
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// إنشاء المجلد إذا لم يكن موجوداً
const uploadDir = './deliveria_upload';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up the multer storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'category-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// تصفية الملفات ليقبل الصور فقط
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Create super category (Admin only)
router.post("/create", checkToken, upload.single('logo'), superCategoriesController.createSuperCategories);

// Get all super categories
router.get("/all", superCategoriesController.getAllSuperCategories);

// Get single super category
router.get("/:id", superCategoriesController.getSuperCategoryById);

// Update super category (Admin only)
router.put("/:id", checkToken, upload.single('logo'), superCategoriesController.updateSuperCategory);

// Delete super category (Admin only)
router.delete("/:id", checkToken, superCategoriesController.deleteSuperCategory);

module.exports = router;