const router = require("express").Router();
const { checkToken } = require("../../auth/token_validation");
const favouriteController = require("../../controllers/FavouritesController");

router.get("/", checkToken, favouriteController.getFavourite);
router.put("/add/:id", checkToken, favouriteController.addFavourite);
router.put("/remove/:id", checkToken, favouriteController.removeFavourite);

module.exports = router;
