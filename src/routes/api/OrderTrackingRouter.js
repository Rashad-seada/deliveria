const router = require('express').Router();
const OrderTrackingController = require('../../controllers/OrderTrackingController');
const { checkToken } = require('../../auth/token_validation');

// Get order details
router.get('/:orderId', checkToken, OrderTrackingController.getOrderDetails);

// Get order tracking timeline
router.get('/:orderId/tracking', checkToken, OrderTrackingController.getOrderTracking);

// Update order status
router.put('/:orderId/status', checkToken, OrderTrackingController.updateOrderStatus);

// Update sub-order status
router.put('/:orderId/restaurant/:restaurantId/status', checkToken, OrderTrackingController.updateSubOrderStatus);

// Cancel order
router.post('/:orderId/cancel', checkToken, OrderTrackingController.cancelOrder);

// Get customer orders
router.get('/customer/orders', checkToken, OrderTrackingController.getCustomerOrders);

// Get restaurant orders
router.get('/restaurant/orders', checkToken, OrderTrackingController.getRestaurantOrders);

// Get agent delivery orders
router.get('/agent/orders', checkToken, OrderTrackingController.getAgentOrders);

// Assign delivery agent
router.post('/:orderId/assign-agent', checkToken, OrderTrackingController.assignDeliveryAgent);

module.exports = router;
