// routes/api/LoyaltyRouter.js
const express = require('express');
const router = express.Router();
const LoyaltyController = require('../../controllers/LoyaltyController');
const { verifyToken, isAdmin, isUser } = require('../../middleware/auth');

// ####################################################################################################################
// #################################################### User Routes ###################################################
// ####################################################################################################################

// Get user's loyalty dashboard (points, rewards, progress)
router.get('/users/loyalty', verifyToken, isUser, LoyaltyController.getUserLoyalty);

// Get user's points transaction history
router.get('/users/loyalty/history', verifyToken, isUser, LoyaltyController.getPointsHistory);

// Validate a loyalty code (preview discount without using)
router.post('/users/loyalty/validate', verifyToken, isUser, LoyaltyController.validateCode);

// Get all active reward tiers (public endpoint for displaying progress)
router.get('/reward-tiers', LoyaltyController.getRewardTiers);

// ####################################################################################################################
// #################################################### Admin Routes ##################################################
// ####################################################################################################################

// Reward Tier Management
router.get('/admin/reward-tiers', verifyToken, isAdmin, LoyaltyController.adminGetAllTiers);
router.post('/admin/reward-tiers', verifyToken, isAdmin, LoyaltyController.adminCreateTier);
router.put('/admin/reward-tiers/:id', verifyToken, isAdmin, LoyaltyController.adminUpdateTier);
router.delete('/admin/reward-tiers/:id', verifyToken, isAdmin, LoyaltyController.adminDeleteTier);

// User Loyalty Management
router.get('/admin/loyalty/users', verifyToken, isAdmin, LoyaltyController.adminGetUsersLoyalty);
router.get('/admin/loyalty/users/:userId', verifyToken, isAdmin, LoyaltyController.adminGetUserLoyaltyDetails);
router.post('/admin/loyalty/adjust', verifyToken, isAdmin, LoyaltyController.adminAdjustPoints);

// Analytics
router.get('/admin/loyalty/analytics', verifyToken, isAdmin, LoyaltyController.adminGetAnalytics);

module.exports = router;
