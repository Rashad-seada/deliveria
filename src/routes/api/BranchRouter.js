const router = require('express').Router();
const BranchController = require('../../controllers/BranchController');
const { checkToken } = require('../../auth/token_validation');

// Create branch
router.post('/:restaurant_id', checkToken, BranchController.createBranch);

// Get restaurant branches
router.get('/:restaurant_id', BranchController.getRestaurantBranches);

// Get available branches (for customers)
router.get('/available/:restaurant_id', BranchController.getAvailableBranches);

// Get specific branch
router.get('/branch/:branchId', BranchController.getBranchById);

// Update branch
router.put('/branch/:branchId', checkToken, BranchController.updateBranch);

// Toggle branch status
router.patch('/branch/:branchId/toggle', checkToken, BranchController.toggleBranchStatus);

// Delete branch
router.delete('/branch/:branchId', checkToken, BranchController.deleteBranch);

// Assign staff to branch
router.post('/branch/:branchId/staff', checkToken, BranchController.assignStaffToBranch);

// Remove staff from branch
router.delete('/branch/:branchId/staff/:staffId', checkToken, BranchController.removeStaffFromBranch);

// Get branch inventory
router.get('/branch/:branchId/inventory', BranchController.getBranchInventory);

// Get branch orders
router.get('/branch/:branchId/orders', BranchController.getBranchOrders);

// Get branch statistics
router.get('/branch/:branchId/statistics', BranchController.getBranchStatistics);

module.exports = router;
