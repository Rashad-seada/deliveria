const router = require('express').Router();
const InventoryController = require('../../controllers/InventoryController');
const { checkToken } = require('../../auth/token_validation');

// Get product quantity
router.get('/product/:itemId/quantity', InventoryController.getProductQuantity);

// Update product quantity
router.put('/product/:itemId/quantity', checkToken, InventoryController.updateProductQuantity);

// Increment product quantity
router.post('/product/:itemId/increment', checkToken, InventoryController.incrementQuantity);

// Get low-stock threshold
router.get('/product/:itemId/threshold', InventoryController.getLowStockThreshold);

// Update low-stock threshold
router.put('/product/:itemId/threshold', checkToken, InventoryController.updateLowStockThreshold);

// Get low-stock items
router.get('/low-stock', checkToken, InventoryController.getLowStockItems);

// Get inventory summary
router.get('/summary', checkToken, InventoryController.getInventorySummary);

// Bulk update quantities
router.post('/bulk-update', checkToken, InventoryController.bulkUpdateQuantities);

// Get inventory report
router.get('/report', checkToken, InventoryController.getInventoryReport);

module.exports = router;
