const router = require('express').Router();
const CheckoutController = require('../../controllers/CheckoutController');
const { checkToken } = require('../../auth/token_validation');

// Validate cart before checkout
router.post('/validate', checkToken, CheckoutController.validateCheckout);

// Calculate order total with breakdown
router.post('/calculate-total', checkToken, CheckoutController.calculateOrderTotal);

// Get checkout summary
router.get('/summary', checkToken, CheckoutController.getCheckoutSummary);

// Validate coupon code
router.post('/validate-coupon', checkToken, CheckoutController.validateCoupon);

// Complete checkout and create order
router.post('/complete', checkToken, CheckoutController.completeCheckout);

// Process payment
router.post('/:orderId/payment', checkToken, CheckoutController.processPayment);

module.exports = router;
