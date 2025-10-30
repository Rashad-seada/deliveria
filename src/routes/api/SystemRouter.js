const router = require("express").Router();
const systemController = require("../../controllers/SystemController");

router.post("/create", systemController.createSystem);
router.get("/", systemController.viewSystem);

module.exports = router;