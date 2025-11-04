
const express = require('express');
const router = express.Router();
const { checkToken } = require("../../auth/token_validation");
const deliveryController = require('../../controllers/DeliveryController');

// AGENT ROUTES - Protected by checkToken middleware

// Get a list of all orders available for pickup
router.get('/available', checkToken, deliveryController.getAvailableOrders);

// Get all orders currently assigned to the logged-in agent
router.get('/my_orders', checkToken, deliveryController.getMyOrders);

// Accept an available order
router.put('/accept/:id', checkToken, deliveryController.acceptOrder);

// Update the status of an order (e.g., "On the way", "Delivered")
router.put('/order/:id/status', checkToken, deliveryController.updateOrderStatus);

// Update the agent's current geographical location
router.post('/agent/location', checkToken, deliveryController.updateAgentLocation);

module.exports = router;
