const router = require("express").Router();
const superCategoriesController = require("../../controllers/SuperCategoriesController");
const multer = require('multer');

// Set up the multer storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './deliveria_upload'); // Specify the destination folder for uploaded images
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + (Math.floor(Math.random() * (999999 - 1 + 1)) + 1) + file.originalname); // Use the current timestamp to generate a unique filename
    }
});
const upload = multer({ storage: storage });

router.post("/create", upload.single('logo'), superCategoriesController.createSuperCategories);
router.get("/all", superCategoriesController.getAllSuperCategories);

module.exports = router;