// RestaurantsRouter.js - Ø§Ù„ÙƒÙˆØ¯ Ø§Ù„ÙƒØ§Ù…Ù„ (Ø¨Ø¯ÙˆÙ† ØªØºÙŠÙŠØ±Ø§Øª)

const router = require("express").Router();
const { checkToken } = require("../../auth/token_validation");
const restaurantsController = require("../../controllers/RestaurantsController");
const branchesController = require("../../controllers/BranchesController");
const multer = require('multer');

// Set up the multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './deliveria_upload');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + (Math.floor(Math.random() * (999999 - 1 + 1)) + 1) + file.originalname.replace(/\s+/g, '_'));
  }
});

const upload = multer({ storage: storage });

// Ø¥Ù†Ø´Ø§Ø¡ Ù…Ø·Ø¹Ù… (Admin)
router.post(
  "/create",
  checkToken,
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'photo', maxCount: 1 }
  ]),
  restaurantsController.createRestaurant
);

// ØªØ­Ø¯ÙŠØ« Ù…Ø·Ø¹Ù…
router.put(
  "/update/:id",
  checkToken,
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'photo', maxCount: 1 }
  ]),
  restaurantsController.updateRestaurant
);

// ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„
router.post("/login", restaurantsController.login);

// Ø¬Ù„Ø¨ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ù…Ø·Ø§Ø¹Ù…
router.get("/all", checkToken, restaurantsController.getAllRestaurants);

// Ø§Ù„ØµÙØ­Ø© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©
router.get("/home/:latitude/:longitude", checkToken, restaurantsController.getHomeRestaurants);

// Ø£Ø¹Ù„Ù‰ ØªÙ‚ÙŠÙŠÙ… (Admin)
router.get("/all_rated_admin", checkToken, restaurantsController.getRestaurantsByRateAdmin);

// Ø£Ø¹Ù„Ù‰ ØªÙ‚ÙŠÙŠÙ… (User)
router.get("/all_rated/:latitude/:longitude", checkToken, restaurantsController.getRestaurantsByRate);

// Ø¨Ø­Ø«
router.post("/search/:latitude/:longitude", checkToken, restaurantsController.searchRestaurant);
router.post("/admin_search", checkToken, restaurantsController.searchRestaurantAdmin);

// Ø­Ø³Ø¨ Ø§Ù„ÙØ¦Ø©
router.get("/category/:super_category/:sub_category/:latitude/:longitude", checkToken, restaurantsController.getRestaurantsByCategory);
router.get("/admin_category/:super_category/:sub_category", checkToken, restaurantsController.getRestaurantsByCategoryAdmin);

// ØªØºÙŠÙŠØ± Ø§Ù„Ø­Ø§Ù„Ø©
router.put("/change_enable/:id", checkToken, restaurantsController.changeShowRestaurant);
router.put("/change_enable_in_home/:id", checkToken, restaurantsController.changeShowInHomeRestaurant);
router.put("/change_have_delivery/:id", checkToken, restaurantsController.changeHaveDelivery);

// Ø­Ø°Ù
router.delete("/delete/:id", checkToken, restaurantsController.deleteRestaurant);

// Upload photo/logo separately
router.post("/upload-photo/:id", checkToken, upload.single('photo'), restaurantsController.uploadPhoto);
router.post("/upload-logo/:id", checkToken, upload.single('logo'), restaurantsController.uploadLogo);

// ØªÙ‚ÙŠÙŠÙ…
router.put("/add_review", checkToken, restaurantsController.addReview);

// Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ù…Ø·Ø¹Ù…
router.get("/my_orders", checkToken, restaurantsController.myOrder);

// Ù‚Ø¨ÙˆÙ„ Ø§Ù„Ø·Ù„Ø¨
router.put("/accept_order/:orderId/:subOrderId", checkToken, restaurantsController.acceptOrder);

// Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ…
router.get("/home_data", checkToken, restaurantsController.getDataOfRestaurant);

// Ø¬Ø§Ù‡Ø² Ù„Ù„Ø§Ø³ØªÙ„Ø§Ù…
router.put("/ready_for_pickup_order/:orderId/:subOrderId", checkToken, restaurantsController.readyOrderAgent);

// Ø£ÙØ¶Ù„ Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª
router.get("/best_seller/:id", checkToken, restaurantsController.getBestSellerItems);

// أفضل المطاعم مبيعاً - Top 10 Best Selling Restaurants
router.get("/best_sellers/:latitude/:longitude", checkToken, restaurantsController.getBestSellerRestaurants);

// =====================================================
// OFFERS ENDPOINTS - Ø§Ù„Ø¹Ø±ÙˆØ¶ ÙˆØ§Ù„Ø®ØµÙˆÙ…Ø§Øª
// =====================================================

// Get restaurants with active offers (for home page carousel)
router.get("/with_offers/:latitude/:longitude", checkToken, restaurantsController.getRestaurantsWithOffers);

// Get offers for a specific restaurant (for "Offers" tab in menu)
router.get("/:id/offers", checkToken, restaurantsController.getRestaurantOffers);

// Get restaurant details with has_offers field
router.get("/details/:id", checkToken, restaurantsController.getRestaurantDetails);

// =====================================================
// MULTI-BRANCH ENDPOINTS - إدارة الفروع
// =====================================================

// Get all branches of a restaurant
router.get("/:id/branches", checkToken, branchesController.getBranches);

// Create a new branch
router.post("/:id/branches", checkToken, branchesController.createBranch);

// Get single branch details
router.get("/branches/:branchId", checkToken, branchesController.getBranchById);

// Update branch details
router.put("/branches/:branchId", checkToken, branchesController.updateBranch);

// Delete a branch (soft delete)
router.delete("/branches/:branchId", checkToken, branchesController.deleteBranch);

// Toggle branch visibility (pause/resume)
router.patch("/branches/:branchId/toggle", checkToken, branchesController.toggleBranch);

module.exports = router;