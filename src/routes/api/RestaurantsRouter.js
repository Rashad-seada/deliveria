const router = require("express").Router();
const { checkToken } = require("../../auth/token_validation");
const restaurantsController = require("../../controllers/RestaurantsController");
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

router.post("/create", upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'photo', maxCount: 1 }
]), checkToken, restaurantsController.createRestaurant);
router.put("/update/:id", upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'photo', maxCount: 1 }
]), restaurantsController.updateRestaurant);
router.post("/login", restaurantsController.login)
router.get("/all", checkToken, restaurantsController.getAllRestaurants);
router.get("/home/:latitude/:longitude", checkToken, restaurantsController.getHomeRestaurants);
router.get("/all_rated_admin", checkToken, restaurantsController.getRestaurantsByRateAdmin);
router.post("/search/:latitude/:longitude", checkToken, restaurantsController.searchRestaurant);
router.post("/admin_search", checkToken, restaurantsController.searchRestaurantAdmin);
router.get("/all_rated/:latitude/:longitude", checkToken, restaurantsController.getRestaurantsByRate);
router.get("/category/:super_category/:sub_category/:latitude/:longitude", checkToken, restaurantsController.getRestaurantsByCategory);
router.get("/admin_category/:super_category/:sub_category", checkToken, restaurantsController.getRestaurantsByCategoryAdmin);
router.put("/change_enable/:id", checkToken, restaurantsController.changeShowRestaurant);
router.put("/change_enable_in_home/:id", checkToken, restaurantsController.changeShowInHomeRestaurant);
router.put("/change_have_delivery/:id", checkToken, restaurantsController.changeHaveDelivery);
router.delete("/delete/:id", checkToken, restaurantsController.deleteRestaurant);
router.put("/add_review", checkToken, restaurantsController.addReview);
router.get("/my_orders", checkToken, restaurantsController.myOrder);
router.put("/accept_order/:id", checkToken, restaurantsController.acceptOrder);
router.put("/change_status/:id", checkToken, restaurantsController.changeStatusOfOrder);
router.put("/home_data", checkToken, restaurantsController.getDataOfRestaurant);
router.put("/preparing_order/:id", checkToken, restaurantsController.preparingOrderAgent);
router.put("/ready_for_pickup_order/:id", checkToken, restaurantsController.readyOrderAgent);
router.get("/best_seller/:id", restaurantsController.getBestSellerItems);

module.exports = router;