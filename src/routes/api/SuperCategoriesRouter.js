const router = require("express").Router();
const superCategoriesController = require("../../controllers/SuperCategoriesController");
const { checkToken } = require("../../auth/token_validation");
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ù…Ø¬Ù„Ø¯ Ø¥Ø°Ø§ Ù„Ù… ÙŠÙƒÙ† Ù…ÙˆØ¬ÙˆØ¯Ø§Ù‹
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

// ØªØµÙÙŠØ© Ø§Ù„Ù…Ù„ÙØ§Øª Ù„ÙŠÙ‚Ø¨Ù„ Ø§Ù„ØµÙˆØ± ÙÙ‚Ø·
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