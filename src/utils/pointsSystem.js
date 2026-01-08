/**
 * Points System Manager
 * Handles customer loyalty points and rewards
 */

const User = require("../models/Users");
const CouponCode = require("../models/CouponCodes");
const { sendNotification } = require("../controllers/global");

/**
 * Points Conversion Rates
 */
const POINTS_CONFIG = {
    POINTS_PER_ORDER: 10, // 10 points per order
    POINTS_PER_EGP: 0.5,  // 0.5 points per EGP spent
    THRESHOLD_FOR_COUPON: 100, // 100 points = eligible for coupon
    COUPON_DISCOUNT_PERCENTAGE: 10 // 10% discount coupon
};

/**
 * Adds points to user after order completion
 * Points = (base points) + (amount spent * points per EGP)
 */
async function addOrderPoints(userId, orderTotal) {
    try {
        const user = await User.findById(userId);
        if (!user) {
            return { success: false, message: "User not found" };
        }

        // Calculate points
        const basePoints = POINTS_CONFIG.POINTS_PER_ORDER;
        const spendPoints = Math.floor(orderTotal * POINTS_CONFIG.POINTS_PER_EGP);
        const totalPoints = basePoints + spendPoints;

        // Update user points
        user.points = (user.points || 0) + totalPoints;
        await user.save();

        // Check if user is now eligible for coupon
        const wasEligibleBefore = (user.points - totalPoints) >= POINTS_CONFIG.THRESHOLD_FOR_COUPON;
        const isEligibleNow = user.points >= POINTS_CONFIG.THRESHOLD_FOR_COUPON;

        if (!wasEligibleBefore && isEligibleNow) {
            // User just became eligible for a discount coupon
            await sendNotification(
                [userId],
                null,
                `Congratulations! You've earned ${user.points} points. You're now eligible for a 10% discount coupon!`
            );
            return {
                success: true,
                pointsAdded: totalPoints,
                newTotal: user.points,
                couponEligible: true,
                message: "Points added and user is now eligible for coupon"
            };
        } else {
            await sendNotification(
                [userId],
                null,
                `You've earned ${totalPoints} points! Total: ${user.points} points.`
            );
        }

        return {
            success: true,
            pointsAdded: totalPoints,
            newTotal: user.points,
            couponEligible: isEligibleNow,
            message: "Points added successfully"
        };
    } catch (error) {
        console.error("Error adding order points:", error);
        return {
            success: false,
            message: "Error adding points",
            error: error.message
        };
    }
}

/**
 * Checks if user is eligible for discount coupon
 */
async function isEligibleForCoupon(userId) {
    try {
        const user = await User.findById(userId);
        if (!user) {
            return { eligible: false, points: 0 };
        }

        const points = user.points || 0;
        return {
            eligible: points >= POINTS_CONFIG.THRESHOLD_FOR_COUPON,
            points,
            pointsNeeded: Math.max(0, POINTS_CONFIG.THRESHOLD_FOR_COUPON - points)
        };
    } catch (error) {
        console.error("Error checking coupon eligibility:", error);
        return {
            eligible: false,
            points: 0,
            error: error.message
        };
    }
}

/**
 * Redeems points for a discount coupon
 * Deducts threshold points and creates coupon
 */
async function redeemPointsForCoupon(userId) {
    try {
        const user = await User.findById(userId);
        if (!user) {
            return { success: false, message: "User not found" };
        }

        // Check eligibility
        if (user.points < POINTS_CONFIG.THRESHOLD_FOR_COUPON) {
            return {
                success: false,
                message: `You need ${POINTS_CONFIG.THRESHOLD_FOR_COUPON - user.points} more points`
            };
        }

        // Deduct points
        user.points -= POINTS_CONFIG.THRESHOLD_FOR_COUPON;
        await user.save();

        // Create coupon code
        const couponCode = `POINTS${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const coupon = new CouponCode({
            code: couponCode,
            discount_type: 'bill',
            value: POINTS_CONFIG.COUPON_DISCOUNT_PERCENTAGE,
            expired_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            is_active: true,
            users_used: [userId]
        });

        await coupon.save();

        // Notify user
        await sendNotification(
            [userId],
            null,
            `🎉 Coupon Redeemed! Your ${POINTS_CONFIG.COUPON_DISCOUNT_PERCENTAGE}% discount coupon code: ${couponCode} (Valid for 30 days)`
        );

        return {
            success: true,
            message: "Coupon created successfully",
            coupon: {
                code: couponCode,
                discount: POINTS_CONFIG.COUPON_DISCOUNT_PERCENTAGE + "%",
                expiresAt: coupon.expired_date
            },
            pointsRemaining: user.points
        };
    } catch (error) {
        console.error("Error redeeming points:", error);
        return {
            success: false,
            message: "Error redeeming points",
            error: error.message
        };
    }
}

/**
 * Gets user's points summary
 */
async function getUserPointsSummary(userId) {
    try {
        const user = await User.findById(userId);
        if (!user) {
            return { success: false, message: "User not found" };
        }

        const points = user.points || 0;
        const eligible = points >= POINTS_CONFIG.THRESHOLD_FOR_COUPON;

        return {
            success: true,
            summary: {
                currentPoints: points,
                pointsNeededForCoupon: Math.max(0, POINTS_CONFIG.THRESHOLD_FOR_COUPON - points),
                isCouponEligible: eligible,
                couponValue: eligible ? POINTS_CONFIG.COUPON_DISCOUNT_PERCENTAGE + "%" : null,
                info: "Every order earns 10 points + 0.5 points per EGP spent"
            }
        };
    } catch (error) {
        console.error("Error getting points summary:", error);
        return {
            success: false,
            message: "Error getting points",
            error: error.message
        };
    }
}

module.exports = {
    POINTS_CONFIG,
    addOrderPoints,
    isEligibleForCoupon,
    redeemPointsForCoupon,
    getUserPointsSummary
};
