const router = require("express").Router();
const { checkToken } = require("../../auth/token_validation");
const agentsController = require("../../controllers/AgentsController");

router.get("/all", agentsController.getAgents);
router.get("/id/:id", agentsController.getOrderOfAgent);
router.post("/create", agentsController.createAgent);
router.post("/login", agentsController.login);
router.put("/change_ban/:id", agentsController.changeBanAgent);
router.get("/get_orders", checkToken, agentsController.getOrdersNotAccept);
router.get("/my_orders", checkToken, agentsController.myOrder);
router.put("/accept_order/:id", checkToken, agentsController.acceptOrder);
router.put("/change_status/:id", checkToken, agentsController.changeStatusOfOrder);

module.exports = router;