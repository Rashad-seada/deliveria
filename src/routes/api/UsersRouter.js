const router = require("express").Router();
const { checkToken } = require("../../auth/token_validation");
const usersController = require("../../controllers/UsersController");

router.post("/signup", usersController.signUp);
router.post("/login", usersController.login);
router.get("/all", usersController.getAllUsers);
router.put("/update", checkToken, usersController.updateProfile);
router.get("/my_orders", checkToken, usersController.myOrder);
router.put("/change_ban/:id", checkToken, usersController.changeBan);
router.post("/search", checkToken, usersController.searchByPhone);

module.exports = router;