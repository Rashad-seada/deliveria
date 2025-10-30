const router = require("express").Router();
const { checkToken } = require("../../auth/token_validation");
const cartController = require("../../controllers/CartsController");

router.get("/", checkToken, cartController.getCart);
router.post("/add", checkToken, cartController.addCart);
router.put("/remove", checkToken, cartController.removeCart);
router.put('/increase-item', checkToken, cartController.increaseItemQuantity);
router.put('/decrease-item', checkToken, cartController.decreaseItemQuantity);

module.exports = router;
