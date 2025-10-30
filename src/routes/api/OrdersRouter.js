const router = require("express").Router();
const { checkToken } = require("../../auth/token_validation");
const orderController = require("../../controllers/OrdersController");

router.get("/", checkToken, orderController.getOrders);
router.get("/all", checkToken, orderController.getAllOrders);
router.get("/id/:id", checkToken, orderController.getOrderById);
router.post("/add", checkToken, orderController.createOrder);
router.put("/reorder/:id", checkToken, orderController.reorder);
router.put("/update_all", orderController.updateAll);

module.exports = router;
