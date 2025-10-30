const router = require("express").Router();
const { checkToken } = require("../../auth/token_validation");
const notificationsController = require("../../controllers/NotificationsController");

router.post("/create", checkToken, notificationsController.createNotification);
router.get("/get", checkToken, notificationsController.getNotification);


module.exports = router;
