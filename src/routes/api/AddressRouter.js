const router = require("express").Router();
const { checkToken } = require("../../auth/token_validation");
const addressController = require("../../controllers/AddressController");

router.post("/create", checkToken, addressController.createAddress);
router.get("/", checkToken, addressController.getAddress);
router.put("/change_default/:id", checkToken, addressController.setDefaultAddress);
router.delete("/delete/:id", checkToken, addressController.deleteAddress);

module.exports = router;