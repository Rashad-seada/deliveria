const router = require("express").Router();
const { checkToken } = require("../../auth/token_validation");
const authController = require("../../controllers/AuthController");

router.post("/login", authController.login);
router.get("/get_data", checkToken, authController.getData);

module.exports = router;