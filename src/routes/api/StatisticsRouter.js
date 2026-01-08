const router = require('express').Router();
const StatisticsController = require('../../controllers/StatisticsController');
const { checkToken } = require('../../auth/token_validation');

// Get dashboard statistics
router.get('/dashboard', checkToken, StatisticsController.getDashboardStatistics);

// Get revenue report
router.get('/revenue', checkToken, StatisticsController.getRevenueReport);

// Get top selling products
router.get('/products/top-selling', checkToken, StatisticsController.getTopSellingProducts);

// Get order status distribution
router.get('/orders/distribution', checkToken, StatisticsController.getOrderStatusDistribution);

// Get customer analysis
router.get('/customers/analysis', checkToken, StatisticsController.getCustomerAnalysis);

// Get delivery performance
router.get('/delivery/performance', checkToken, StatisticsController.getDeliveryPerformance);

// Export report
router.get('/export', checkToken, StatisticsController.exportReport);

module.exports = router;
