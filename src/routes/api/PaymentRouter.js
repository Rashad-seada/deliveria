const router = require("express").Router();
const paymentController = require("../../controllers/PaymentController");
const { checkToken } = require("../../middleware/checkToken");

// Public webhook — Paymob calls this after each transaction
// No auth token required (verified via HMAC instead)
router.post("/callback", paymentController.processCallback);

// Client verification — Flutter calls this after WebView payment
// Requires auth token
router.get("/verify/:transactionId", checkToken, paymentController.verifyTransaction);

// Server-side payment initiation — more secure than client-side
// Keeps API key on server, returns only the payment key to client
router.post("/initiate", checkToken, paymentController.initiatePayment);

module.exports = router;
