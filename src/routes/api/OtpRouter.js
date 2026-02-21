const router = require("express").Router();
const otpController = require("../../controllers/OtpController");

// All OTP routes are public (no auth token required)
// They are used during signup before the user has an account

// Send OTP to phone number
router.post("/send", otpController.sendOtp);

// Verify OTP code
router.post("/verify", otpController.verifyOtp);

// Resend OTP (generates a new code)
router.post("/resend", otpController.resendOtp);

module.exports = router;
