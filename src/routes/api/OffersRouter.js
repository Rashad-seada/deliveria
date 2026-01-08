const router = require('express').Router();
const OffersController = require('../../controllers/OffersController');
const { checkToken } = require('../../auth/token_validation');

// Create offer (Admin only)
router.post('/', checkToken, OffersController.createOffer);

// Get all offers
router.get('/', OffersController.getAllOffers);

// Get specific offer
router.get('/:offerId', OffersController.getOfferById);

// Update offer
router.put('/:offerId', checkToken, OffersController.updateOffer);

// Delete offer
router.delete('/:offerId', checkToken, OffersController.deleteOffer);

// Get applicable offers for cart
router.get('/available/applicable', OffersController.getApplicableOffers);

// Apply offer to price
router.post('/:offerId/apply', OffersController.applyOfferToPrice);

// Get active offers
router.get('/active/list', OffersController.getActiveOffers);

// Record offer usage
router.post('/:offerId/usage', checkToken, OffersController.recordOfferUsage);

// Toggle offer status
router.patch('/:offerId/status', checkToken, OffersController.toggleOfferStatus);

// Get offers statistics
router.get('/statistics/summary', OffersController.getOffersStatistics);

module.exports = router;
