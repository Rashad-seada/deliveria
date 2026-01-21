// controllers/LoyaltyController.js
const User = require("../models/Users");
const RewardTier = require("../models/RewardTier");
const PointsTransaction = require("../models/PointsTransaction");
const {
    validateLoyaltyCode,
    markCodeAsUsed,
    calculateLoyaltyDiscount,
    checkAndAwardRewards
} = require("../utils/loyaltyHelpers");

// ####################################################################################################################
// #################################################### User Endpoints ################################################
// ####################################################################################################################

/**
 * Get user's loyalty dashboard
 * GET /users/loyalty
 */
module.exports.getUserLoyalty = async (req, res) => {
    try {
        const userId = req.decoded.id;

        const user = await User.findById(userId).select('loyalty first_name last_name');
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Get all active tiers for progress display
        const tiers = await RewardTier.find({ isActive: true })
            .sort({ pointsRequired: 1 })
            .select('name pointsRequired discountValue discountType');

        const totalPoints = user.loyalty?.totalPoints || 0;

        // Find next tier (first tier user hasn't reached yet)
        let nextTier = null;
        for (const tier of tiers) {
            if (totalPoints < tier.pointsRequired) {
                nextTier = {
                    name: tier.name,
                    pointsRequired: tier.pointsRequired,
                    pointsNeeded: tier.pointsRequired - totalPoints,
                    progress: Math.round((totalPoints / tier.pointsRequired) * 100)
                };
                break;
            }
        }

        // Build tiers list with achieved status
        const tiersWithStatus = tiers.map(tier => ({
            name: tier.name,
            pointsRequired: tier.pointsRequired,
            discountValue: tier.discountValue,
            discountType: tier.discountType,
            achieved: totalPoints >= tier.pointsRequired
        }));

        // Format earned rewards
        const earnedRewards = (user.loyalty?.earnedRewards || []).map(reward => ({
            tierName: reward.tierName,
            code: reward.code,
            discountValue: reward.discountValue,
            discountType: reward.discountType,
            maxDiscount: reward.maxDiscount,
            isUsed: reward.isUsed,
            earnedAt: reward.earnedAt,
            usedAt: reward.usedAt
        }));

        return res.status(200).json({
            success: true,
            data: {
                totalPoints,
                nextTier,
                earnedRewards,
                tiers: tiersWithStatus
            }
        });

    } catch (error) {
        console.error("getUserLoyalty error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Get all active reward tiers (for progress bar display)
 * GET /reward-tiers
 */
module.exports.getRewardTiers = async (req, res) => {
    try {
        const tiers = await RewardTier.find({ isActive: true })
            .sort({ pointsRequired: 1 })
            .select('name pointsRequired discountValue discountType description');

        return res.status(200).json({
            success: true,
            data: tiers
        });
    } catch (error) {
        console.error("getRewardTiers error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Validate a loyalty code (without marking it as used)
 * POST /users/loyalty/validate
 */
module.exports.validateCode = async (req, res) => {
    try {
        const userId = req.decoded.id;
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ success: false, message: "Code is required" });
        }

        const result = await validateLoyaltyCode(userId, code);

        if (!result.valid) {
            return res.status(400).json({ success: false, message: result.message });
        }

        return res.status(200).json({
            success: true,
            data: result.reward
        });

    } catch (error) {
        console.error("validateCode error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Get user's points transaction history
 * GET /users/loyalty/history
 */
module.exports.getPointsHistory = async (req, res) => {
    try {
        const userId = req.decoded.id;
        const { page = 1, limit = 20 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const transactions = await PointsTransaction.find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('orderId', 'order_id');

        const total = await PointsTransaction.countDocuments({ userId });

        return res.status(200).json({
            success: true,
            data: {
                transactions,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            }
        });

    } catch (error) {
        console.error("getPointsHistory error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ####################################################################################################################
// #################################################### Admin Endpoints ###############################################
// ####################################################################################################################

/**
 * Get all reward tiers (including inactive)
 * GET /admin/reward-tiers
 */
module.exports.adminGetAllTiers = async (req, res) => {
    try {
        const tiers = await RewardTier.find().sort({ pointsRequired: 1 });

        return res.status(200).json({
            success: true,
            data: tiers
        });
    } catch (error) {
        console.error("adminGetAllTiers error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Create a new reward tier
 * POST /admin/reward-tiers
 */
module.exports.adminCreateTier = async (req, res) => {
    try {
        const { name, pointsRequired, discountValue, discountType, maxDiscount, description } = req.body;

        if (!name || !pointsRequired || !discountValue) {
            return res.status(400).json({
                success: false,
                message: "Name, pointsRequired, and discountValue are required"
            });
        }

        // Check if tier with same points exists
        const existing = await RewardTier.findOne({ pointsRequired });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: `A tier with ${pointsRequired} points already exists`
            });
        }

        const tier = new RewardTier({
            name,
            pointsRequired,
            discountValue,
            discountType: discountType || 'percentage',
            maxDiscount: maxDiscount || null,
            description: description || ''
        });

        await tier.save();

        return res.status(201).json({
            success: true,
            message: "Reward tier created successfully",
            data: tier
        });

    } catch (error) {
        console.error("adminCreateTier error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Update a reward tier
 * PUT /admin/reward-tiers/:id
 */
module.exports.adminUpdateTier = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, pointsRequired, discountValue, discountType, maxDiscount, description, isActive } = req.body;

        const tier = await RewardTier.findById(id);
        if (!tier) {
            return res.status(404).json({ success: false, message: "Tier not found" });
        }

        // Check for duplicate pointsRequired if changing
        if (pointsRequired && pointsRequired !== tier.pointsRequired) {
            const existing = await RewardTier.findOne({ pointsRequired, _id: { $ne: id } });
            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: `A tier with ${pointsRequired} points already exists`
                });
            }
        }

        // Update fields
        if (name !== undefined) tier.name = name;
        if (pointsRequired !== undefined) tier.pointsRequired = pointsRequired;
        if (discountValue !== undefined) tier.discountValue = discountValue;
        if (discountType !== undefined) tier.discountType = discountType;
        if (maxDiscount !== undefined) tier.maxDiscount = maxDiscount;
        if (description !== undefined) tier.description = description;
        if (isActive !== undefined) tier.isActive = isActive;

        await tier.save();

        return res.status(200).json({
            success: true,
            message: "Reward tier updated successfully",
            data: tier
        });

    } catch (error) {
        console.error("adminUpdateTier error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Soft-delete a reward tier (set isActive to false)
 * DELETE /admin/reward-tiers/:id
 */
module.exports.adminDeleteTier = async (req, res) => {
    try {
        const { id } = req.params;

        const tier = await RewardTier.findById(id);
        if (!tier) {
            return res.status(404).json({ success: false, message: "Tier not found" });
        }

        tier.isActive = false;
        await tier.save();

        return res.status(200).json({
            success: true,
            message: "Reward tier deactivated successfully"
        });

    } catch (error) {
        console.error("adminDeleteTier error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Get all users' loyalty data (for admin dashboard)
 * GET /admin/loyalty/users
 */
module.exports.adminGetUsersLoyalty = async (req, res) => {
    try {
        const { page = 1, limit = 20, search } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        let query = {};
        if (search) {
            query = {
                $or: [
                    { first_name: { $regex: search, $options: 'i' } },
                    { last_name: { $regex: search, $options: 'i' } },
                    { phone: { $regex: search, $options: 'i' } }
                ]
            };
        }

        const users = await User.find(query)
            .select('first_name last_name phone loyalty.totalPoints loyalty.earnedRewards points')
            .sort({ 'loyalty.totalPoints': -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

        const formattedUsers = users.map(user => ({
            _id: user._id,
            name: `${user.first_name} ${user.last_name}`,
            phone: user.phone,
            totalPoints: user.loyalty?.totalPoints || 0,
            legacyPoints: user.points || 0,
            totalRewards: user.loyalty?.earnedRewards?.length || 0,
            usedRewards: user.loyalty?.earnedRewards?.filter(r => r.isUsed).length || 0
        }));

        return res.status(200).json({
            success: true,
            data: {
                users: formattedUsers,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            }
        });

    } catch (error) {
        console.error("adminGetUsersLoyalty error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Get specific user's loyalty details
 * GET /admin/loyalty/users/:userId
 */
module.exports.adminGetUserLoyaltyDetails = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId)
            .select('first_name last_name phone email loyalty');

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const transactions = await PointsTransaction.find({ userId })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('orderId', 'order_id final_price');

        return res.status(200).json({
            success: true,
            data: {
                user: {
                    _id: user._id,
                    name: `${user.first_name} ${user.last_name}`,
                    phone: user.phone,
                    email: user.email
                },
                loyalty: user.loyalty,
                transactions
            }
        });

    } catch (error) {
        console.error("adminGetUserLoyaltyDetails error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Manually adjust user's points (admin)
 * POST /admin/loyalty/adjust
 */
module.exports.adminAdjustPoints = async (req, res) => {
    try {
        const adminId = req.decoded.id;
        const { userId, points, description } = req.body;

        if (!userId || points === undefined) {
            return res.status(400).json({
                success: false,
                message: "userId and points are required"
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Initialize loyalty if needed
        if (!user.loyalty) {
            user.loyalty = { totalPoints: 0, earnedRewards: [] };
        }

        const previousBalance = user.loyalty.totalPoints || 0;
        const newBalance = Math.max(0, previousBalance + parseInt(points)); // Cannot go below 0

        user.loyalty.totalPoints = newBalance;
        await user.save();

        // Log the transaction
        await PointsTransaction.create({
            userId,
            type: 'admin_adjust',
            points: parseInt(points),
            balance: newBalance,
            description: description || `Admin adjustment`,
            adminId
        });

        // Check for new rewards
        const newRewards = await checkAndAwardRewards(userId);

        return res.status(200).json({
            success: true,
            message: `Points adjusted successfully. New balance: ${newBalance}`,
            data: {
                previousBalance,
                adjustment: parseInt(points),
                newBalance,
                newRewards
            }
        });

    } catch (error) {
        console.error("adminAdjustPoints error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Get loyalty analytics
 * GET /admin/loyalty/analytics
 */
module.exports.adminGetAnalytics = async (req, res) => {
    try {
        // Total users with points
        const usersWithPoints = await User.countDocuments({ 'loyalty.totalPoints': { $gt: 0 } });

        // Total points in circulation
        const pointsAgg = await User.aggregate([
            { $group: { _id: null, totalPoints: { $sum: '$loyalty.totalPoints' } } }
        ]);
        const totalPointsInCirculation = pointsAgg[0]?.totalPoints || 0;

        // Rewards statistics
        const rewardsAgg = await User.aggregate([
            { $unwind: { path: '$loyalty.earnedRewards', preserveNullAndEmptyArrays: false } },
            {
                $group: {
                    _id: null,
                    totalEarned: { $sum: 1 },
                    totalUsed: { $sum: { $cond: ['$loyalty.earnedRewards.isUsed', 1, 0] } }
                }
            }
        ]);
        const rewardsStats = rewardsAgg[0] || { totalEarned: 0, totalUsed: 0 };

        // Points earned this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const monthlyPoints = await PointsTransaction.aggregate([
            { $match: { type: 'earn', createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$points' } } }
        ]);

        // Tier distribution
        const tiers = await RewardTier.find({ isActive: true }).sort({ pointsRequired: 1 });
        const tierDistribution = [];

        for (let i = 0; i < tiers.length; i++) {
            const minPoints = tiers[i].pointsRequired;
            const maxPoints = tiers[i + 1]?.pointsRequired || Infinity;

            const count = await User.countDocuments({
                'loyalty.totalPoints': { $gte: minPoints, $lt: maxPoints }
            });

            tierDistribution.push({
                tier: tiers[i].name,
                count
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                usersWithPoints,
                totalPointsInCirculation,
                totalRewardsEarned: rewardsStats.totalEarned,
                totalRewardsUsed: rewardsStats.totalUsed,
                redemptionRate: rewardsStats.totalEarned > 0
                    ? Math.round((rewardsStats.totalUsed / rewardsStats.totalEarned) * 100)
                    : 0,
                pointsEarnedThisMonth: monthlyPoints[0]?.total || 0,
                tierDistribution
            }
        });

    } catch (error) {
        console.error("adminGetAnalytics error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
