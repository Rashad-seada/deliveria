// utils/loyaltyHelpers.js
const crypto = require('crypto');
const User = require('../models/Users');
const RewardTier = require('../models/RewardTier');
const PointsTransaction = require('../models/PointsTransaction');
const { sendNotification } = require('../controllers/global');

/**
 * Calculate points earned from an order
 * @param {number} finalPrice - Order total in EGP
 * @param {number} pointsPerUnit - Points per spending unit (default: 1 point per 10 EGP)
 * @returns {number} Points earned
 */
function calculatePointsEarned(finalPrice, pointsPerUnit = 10) {
    if (!finalPrice || finalPrice <= 0) return 0;
    return Math.floor(finalPrice / pointsPerUnit);
}

/**
 * Generate a unique loyalty code
 * @returns {string} Unique code like "LOYAL-A1B2C3D4"
 */
function generateUniqueCode() {
    const prefix = 'LOYAL';
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}-${random}`;
}

/**
 * Check and award rewards when user reaches tier thresholds
 * @param {string} userId - User's MongoDB ObjectId
 * @returns {Array} Array of newly awarded rewards
 */
async function checkAndAwardRewards(userId) {
    try {
        const user = await User.findById(userId);
        if (!user) return [];

        const tiers = await RewardTier.find({ isActive: true }).sort({ pointsRequired: 1 });
        const awardedRewards = [];

        for (const tier of tiers) {
            // Check if user qualifies AND hasn't already earned this tier
            const alreadyEarned = user.loyalty.earnedRewards.some(
                r => r.rewardTierId && r.rewardTierId.toString() === tier._id.toString()
            );

            if (user.loyalty.totalPoints >= tier.pointsRequired && !alreadyEarned) {
                // Generate unique code
                const code = generateUniqueCode();

                const rewardEntry = {
                    rewardTierId: tier._id,
                    tierName: tier.name,
                    code: code,
                    earnedAt: new Date(),
                    isUsed: false,
                    discountValue: tier.discountValue,
                    discountType: tier.discountType,
                    maxDiscount: tier.maxDiscount
                };

                user.loyalty.earnedRewards.push(rewardEntry);
                awardedRewards.push({ ...rewardEntry, tierName: tier.name });

                // Send notification to user
                try {
                    const discountText = tier.discountType === 'percentage'
                        ? `${tier.discountValue}%`
                        : `${tier.discountValue} EGP`;

                    sendNotification(
                        [userId],
                        null,
                        `🎉 Congratulations! You've unlocked the ${tier.name} reward! Use code ${code} for ${discountText} off your next order.`
                    );
                } catch (notifErr) {
                    console.error('Failed to send reward notification:', notifErr);
                }
            }
        }

        if (awardedRewards.length > 0) {
            await user.save();
        }

        return awardedRewards;
    } catch (error) {
        console.error('Error in checkAndAwardRewards:', error);
        return [];
    }
}

/**
 * Award loyalty points to a user after order delivery
 * @param {Object} order - The delivered order object
 * @returns {Object} Result with points earned and any new rewards
 */
async function awardLoyaltyPoints(order) {
    try {
        if (!order || !order.user_id) {
            return { success: false, message: 'Invalid order or user' };
        }

        const userId = order.user_id._id || order.user_id;
        const user = await User.findById(userId);

        if (!user) {
            return { success: false, message: 'User not found' };
        }

        // Calculate points from order total
        const finalPrice = order.final_price || 0;
        const pointsEarned = calculatePointsEarned(finalPrice);

        if (pointsEarned <= 0) {
            return { success: true, pointsEarned: 0, newRewards: [] };
        }

        // Initialize loyalty if not exists
        if (!user.loyalty) {
            user.loyalty = { totalPoints: 0, earnedRewards: [] };
        }

        const previousBalance = user.loyalty.totalPoints || 0;
        const newBalance = previousBalance + pointsEarned;

        // Update user's points
        user.loyalty.totalPoints = newBalance;
        await user.save();

        // Log the transaction
        await PointsTransaction.create({
            userId: userId,
            orderId: order._id,
            type: 'earn',
            points: pointsEarned,
            balance: newBalance,
            description: `Earned from order #${order.order_id || order._id.toString().slice(-6)}`
        });

        // Check for new rewards
        const newRewards = await checkAndAwardRewards(userId);

        return {
            success: true,
            pointsEarned,
            totalPoints: newBalance,
            newRewards
        };
    } catch (error) {
        console.error('Error in awardLoyaltyPoints:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Validate a loyalty code for a user
 * @param {string} userId - User's MongoDB ObjectId
 * @param {string} code - The loyalty code to validate
 * @returns {Object} Validation result with discount details
 */
async function validateLoyaltyCode(userId, code) {
    try {
        const user = await User.findById(userId);
        if (!user) {
            return { valid: false, message: 'User not found' };
        }

        if (!user.loyalty || !user.loyalty.earnedRewards) {
            return { valid: false, message: 'No loyalty rewards found' };
        }

        const reward = user.loyalty.earnedRewards.find(
            r => r.code === code.toUpperCase()
        );

        if (!reward) {
            return { valid: false, message: 'Invalid code or code does not belong to you' };
        }

        if (reward.isUsed) {
            return { valid: false, message: 'This code has already been used' };
        }

        return {
            valid: true,
            reward: {
                code: reward.code,
                discountValue: reward.discountValue,
                discountType: reward.discountType,
                maxDiscount: reward.maxDiscount,
                tierName: reward.tierName
            }
        };
    } catch (error) {
        console.error('Error in validateLoyaltyCode:', error);
        return { valid: false, message: 'Error validating code' };
    }
}

/**
 * Mark a loyalty code as used
 * @param {string} userId - User's MongoDB ObjectId
 * @param {string} code - The loyalty code to mark as used
 * @param {string} orderId - The order ID where the code was used
 * @returns {Object} Result of the operation
 */
async function markCodeAsUsed(userId, code, orderId) {
    try {
        const user = await User.findById(userId);
        if (!user) {
            return { success: false, message: 'User not found' };
        }

        const rewardIndex = user.loyalty.earnedRewards.findIndex(
            r => r.code === code.toUpperCase()
        );

        if (rewardIndex === -1) {
            return { success: false, message: 'Code not found' };
        }

        const reward = user.loyalty.earnedRewards[rewardIndex];

        if (reward.isUsed) {
            return { success: false, message: 'Code already used' };
        }

        user.loyalty.earnedRewards[rewardIndex].isUsed = true;
        user.loyalty.earnedRewards[rewardIndex].usedAt = new Date();
        user.loyalty.earnedRewards[rewardIndex].usedInOrderId = orderId;

        await user.save();

        return { success: true, message: 'Code marked as used' };
    } catch (error) {
        console.error('Error in markCodeAsUsed:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Calculate discount amount based on loyalty reward
 * @param {Object} reward - The reward object with discountValue, discountType, maxDiscount
 * @param {number} orderTotal - The order total to apply discount to
 * @returns {number} The discount amount
 */
function calculateLoyaltyDiscount(reward, orderTotal) {
    if (!reward || !orderTotal || orderTotal <= 0) return 0;

    let discount = 0;

    if (reward.discountType === 'percentage') {
        discount = (orderTotal * reward.discountValue) / 100;
        // Apply max discount cap if set
        if (reward.maxDiscount && discount > reward.maxDiscount) {
            discount = reward.maxDiscount;
        }
    } else {
        // Fixed discount
        discount = reward.discountValue;
    }

    // Discount cannot exceed order total
    return Math.min(discount, orderTotal);
}

module.exports = {
    calculatePointsEarned,
    generateUniqueCode,
    checkAndAwardRewards,
    awardLoyaltyPoints,
    validateLoyaltyCode,
    markCodeAsUsed,
    calculateLoyaltyDiscount
};
