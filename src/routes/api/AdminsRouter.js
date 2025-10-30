const router = require("express").Router();
const { checkToken } = require("../../auth/token_validation");
const adminsController = require("../../controllers/AdminsController");

router.post("/create", adminsController.createAdmin);
router.post("/login", adminsController.login);
router.get("/get_data_of_app", checkToken, adminsController.getDataOfApp);
router.get("/all_orders", checkToken, adminsController.getAllOrders);

module.exports = router;