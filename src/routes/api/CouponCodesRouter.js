const router = require("express").Router();
const { checkToken } = require("../../auth/token_validation");
const couponCodesController = require("../../controllers/CouponCodesController");

// Get all coupons
router.get("/", checkToken, couponCodesController.getCouponCode);

// Get single coupon by ID
router.get("/:id", checkToken, couponCodesController.getCouponById);

// Create new coupon
router.post("/create", checkToken, couponCodesController.createCouponCode);

// Apply/Check coupon for user's cart
router.post("/check/:code", checkToken, couponCodesController.checkCouponCode);

// Toggle enable/disable
router.put("/change_enable/:id", checkToken, couponCodesController.changeEnable);

// Update coupon details
router.put("/update/:id", checkToken, couponCodesController.updateCouponCode);

// Delete coupon
router.delete("/delete/:id", checkToken, couponCodesController.deleteCouponCode);


module.exports = router;
