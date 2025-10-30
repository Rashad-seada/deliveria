const router = require("express").Router();
const { checkToken } = require("../../auth/token_validation");
const itemCategoriesController = require("../../controllers/ItemCategoriesController");

router.post("/create", checkToken, itemCategoriesController.createItemCategory);
router.get("/restaurant", checkToken, itemCategoriesController.getAllItemCategories);
router.get("/user/:id", checkToken, itemCategoriesController.getAllItemCategoriesForUser);

module.exports = router;