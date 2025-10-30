const router = require("express").Router();
const { checkToken } = require("../../auth/token_validation");
const couponCodesController = require("../../controllers/CouponCodesController");

router.get("/", checkToken, couponCodesController.getCouponCode);
router.post("/create", couponCodesController.createCouponCode);
router.post("/check/:code", checkToken, couponCodesController.checkCouponCode);
router.put("/change_enable/:id", checkToken, couponCodesController.changeEnable);


module.exports = router;
