const router = require('express').Router();
const RestaurantStatusController = require('../../controllers/RestaurantStatusController');
const { checkToken } = require('../../auth/token_validation');

// Get restaurant status
router.get('/:restaurantId/status', RestaurantStatusController.getRestaurantStatus);

// Close restaurant
router.post('/:restaurantId/close', checkToken, RestaurantStatusController.closeRestaurant);

// Open restaurant
router.post('/:restaurantId/open', checkToken, RestaurantStatusController.openRestaurant);

// Set operating hours
router.put('/:restaurantId/hours', checkToken, RestaurantStatusController.setOperatingHours);

// Get operating schedule
router.get('/:restaurantId/schedule', RestaurantStatusController.getOperatingSchedule);

// Schedule auto open/close
router.post('/:restaurantId/schedule-auto', checkToken, RestaurantStatusController.scheduleAutoOpenClose);

// Validate order placement
router.get('/:restaurantId/validate-order', RestaurantStatusController.validateOrderPlacement);

// Handle last-minute orders
router.post('/:restaurantId/last-minute-orders', checkToken, RestaurantStatusController.handleLastMinuteOrders);

module.exports = router;
