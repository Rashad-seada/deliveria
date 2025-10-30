const router = require("express").Router();
const { checkToken } = require("../../auth/token_validation");
const itemsController = require("../../controllers/ItemsController");
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

router.post("/create", upload.single('photo'), checkToken, itemsController.createItem);
router.put("/update/:id", checkToken, itemsController.updateItem);
router.get("/all_items_for_restaurant/:restaurant_id/:item_category_id", itemsController.getAllItemsForRestaurant);
router.get("/sort_by_price/:restaurant_id", itemsController.getAllItemsByPrice);
router.delete("/delete/:id", checkToken, itemsController.deleteItem);
router.put("/change_enable/:id", itemsController.changeEnable);
router.get("/search/:id/:search", itemsController.searchItem);
router.put("/all", itemsController.updateAll);

module.exports = router;