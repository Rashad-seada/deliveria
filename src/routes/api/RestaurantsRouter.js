// RestaurantsRouter.js - الكود الكامل (بدون تغييرات)

const router = require("express").Router();
const { checkToken } = require("../../auth/token_validation");
const restaurantsController = require("../../controllers/RestaurantsController");
const multer = require('multer');

const upload = multer({ dest: 'uploads/' });

// إنشاء مطعم (Admin)
router.post(
  "/create",
  checkToken,
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'photo', maxCount: 1 }
  ]),
  restaurantsController.createRestaurant
);

// تحديث مطعم
router.put(
  "/update/:id",
  checkToken,
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'photo', maxCount: 1 }
  ]),
  restaurantsController.updateRestaurant
);

// تسجيل الدخول
router.post("/login", restaurantsController.login);

// جلب جميع المطاعم
router.get("/all", checkToken, restaurantsController.getAllRestaurants);

// الصفحة الرئيسية
router.get("/home/:latitude/:longitude", checkToken, restaurantsController.getHomeRestaurants);

// أعلى تقييم (Admin)
router.get("/all_rated_admin", checkToken, restaurantsController.getRestaurantsByRateAdmin);

// أعلى تقييم (User)
router.get("/all_rated/:latitude/:longitude", checkToken, restaurantsController.getRestaurantsByRate);

// بحث
router.post("/search/:latitude/:longitude", checkToken, restaurantsController.searchRestaurant);
router.post("/admin_search", checkToken, restaurantsController.searchRestaurantAdmin);

// حسب الفئة
router.get("/category/:super_category/:sub_category/:latitude/:longitude", checkToken, restaurantsController.getRestaurantsByCategory);
router.get("/admin_category/:super_category/:sub_category", checkToken, restaurantsController.getRestaurantsByCategoryAdmin);

// تغيير الحالة
router.put("/change_enable/:id", checkToken, restaurantsController.changeShowRestaurant);
router.put("/change_enable_in_home/:id", checkToken, restaurantsController.changeShowInHomeRestaurant);
router.put("/change_have_delivery/:id", checkToken, restaurantsController.changeHaveDelivery);

// حذف
router.delete("/delete/:id", checkToken, restaurantsController.deleteRestaurant);

// تقييم
router.put("/add_review", checkToken, restaurantsController.addReview);

// طلبات المطعم
router.get("/my_orders", checkToken, restaurantsController.myOrder);

// قبول الطلب
router.put("/accept_order/:orderId/:subOrderId", checkToken, restaurantsController.acceptOrder);

// لوحة التحكم
router.get("/home_data", checkToken, restaurantsController.getDataOfRestaurant);

// جاهز للاستلام
router.put("/ready_for_pickup_order/:orderId/:subOrderId", checkToken, restaurantsController.readyOrderAgent);

// أفضل المبيعات
router.get("/best_seller/:id", checkToken, restaurantsController.getBestSellerItems);

// =====================================================
// OFFERS ENDPOINTS - العروض والخصومات
// =====================================================

// Get restaurants with active offers (for home page carousel)
router.get("/with_offers/:latitude/:longitude", checkToken, restaurantsController.getRestaurantsWithOffers);

// Get offers for a specific restaurant (for "Offers" tab in menu)
router.get("/:id/offers", checkToken, restaurantsController.getRestaurantOffers);

// Get restaurant details with has_offers field
router.get("/details/:id", checkToken, restaurantsController.getRestaurantDetails);

module.exports = router;