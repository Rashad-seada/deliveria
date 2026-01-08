/**
 * Offers Management System
 * Handles offer validation, application, and discount calculations
 */

const Offer = require('../models/Offer');

/**
 * Checks if an offer is currently active (considering dates and times)
 * @param {object} offer - Offer document
 * @returns {boolean} - True if offer is active
 */
function isOfferActive(offer) {
    const now = new Date();
    const conditions = offer.activation_conditions;

    // Check date range
    if (now < conditions.start_date || now > conditions.end_date) {
        return false;
    }

    // Check day of week if specified
    if (conditions.day_of_week && conditions.day_of_week.length > 0) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = dayNames[now.getDay()];
        if (!conditions.day_of_week.includes(currentDay)) {
            return false;
        }
    }

    // Check time of day if specified
    if (conditions.start_time && conditions.end_time) {
        const nowTime = now.getHours() * 60 + now.getMinutes();
        const [startHour, startMin] = conditions.start_time.split(':').map(Number);
        const [endHour, endMin] = conditions.end_time.split(':').map(Number);
        
        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;

        if (nowTime < startTime || nowTime > endTime) {
            return false;
        }
    }

    return true;
}

/**
 * Calculates discount amount for a given offer
 * @param {object} offer - Offer document
 * @param {number} basePrice - Base price before discount
 * @returns {number} - Discount amount
 */
function calculateOfferDiscount(offer, basePrice) {
    let discount = 0;

    switch (offer.offer_type) {
        case 'Percentage':
            discount = (basePrice * offer.value) / 100;
            // Apply maximum discount cap if set
            if (offer.maximum_discount && discount > offer.maximum_discount) {
                discount = offer.maximum_discount;
            }
            break;
        case 'FixedAmount':
            discount = offer.value;
            break;
        case 'BuyXGetY':
            // This is handled at order level
            discount = 0;
            break;
        case 'FreeItem':
            // This is handled at order level
            discount = 0;
            break;
    }

    return Math.min(discount, basePrice); // Discount can't exceed base price
}

/**
 * Gets applicable offers for a cart/order
 * @param {string} restaurantId - Restaurant ID
 * @param {array} itemIds - Array of item IDs in cart
 * @param {array} categoryIds - Array of category IDs
 * @param {number} cartTotal - Total cart value
 * @returns {array} - Array of applicable offers
 */
async function getApplicableOffers(restaurantId, itemIds, categoryIds, cartTotal) {
    try {
        // Query for active offers
        const now = new Date();
        
        let query = {
            status: 'Active',
            $and: [
                { 'activation_conditions.start_date': { $lte: now } },
                { 'activation_conditions.end_date': { $gte: now } }
            ],
            // Offer is either global or for this restaurant
            $or: [
                { restaurant_id: null },
                { restaurant_id: restaurantId }
            ],
            // Offer meets minimum purchase
            minimum_purchase: { $lte: cartTotal }
        };

        const offers = await Offer.find(query);

        // Filter by active time and items/categories
        const applicableOffers = offers.filter(offer => {
            if (!isOfferActive(offer)) {
                return false;
            }

            // If specific items are applicable, check if any are in cart
            if (offer.applicable_items && offer.applicable_items.length > 0) {
                const itemMatch = offer.applicable_items.some(offerId =>
                    itemIds.some(cartItemId => offerId.toString() === cartItemId.toString())
                );
                if (!itemMatch && offer.applicable_categories.length === 0) {
                    return false;
                }
            }

            // If specific categories are applicable, check if any are in cart
            if (offer.applicable_categories && offer.applicable_categories.length > 0) {
                const categoryMatch = offer.applicable_categories.some(offerId =>
                    categoryIds.some(cartCatId => offerId.toString() === cartCatId.toString())
                );
                if (!categoryMatch && offer.applicable_items.length === 0) {
                    return false;
                }
            }

            // Check usage limits
            if (offer.usage_limits.max_uses && offer.usage_limits.current_uses >= offer.usage_limits.max_uses) {
                return false;
            }

            return true;
        });

        return { success: true, offers: applicableOffers };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Applies an offer to a price
 * @param {object} offer - Offer document
 * @param {number} price - Base price
 * @returns {object} - {original_price, discount, final_price}
 */function applyOfferToPrice(offer, price) {
    if (!isOfferActive(offer)) {
        return {
            original_price: price,
            discount: 0,
            final_price: price,
            offer_applied: false
        };
    }

    const discount = calculateOfferDiscount(offer, price);
    
    return {
        original_price: price,
        discount: discount,
        final_price: price - discount,
        offer_applied: true,
        offer_id: offer._id,
        offer_type: offer.offer_type,
        offer_value: offer.value
    };
}

/**
 * Records an offer usage
 * @param {string} offerId - Offer ID
 * @param {string} userId - User ID
 * @returns {object} - Success or error
 */
async function recordOfferUsage(offerId, userId) {
    try {
        const offer = await Offer.findById(offerId);
        
        if (!offer) {
            return { success: false, error: 'Offer not found' };
        }

        // Increment global usage
        offer.usage_limits.current_uses += 1;

        await offer.save();

        return { success: true, message: 'Offer usage recorded' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Gets all active offers
 * @param {string} restaurantId - Optional restaurant filter
 * @returns {array} - Array of active offers
 */
async function getActiveOffers(restaurantId = null) {
    try {
        const now = new Date();
        
        let query = {
            status: 'Active',
            'activation_conditions.start_date': { $lte: now },
            'activation_conditions.end_date': { $gte: now }
        };

        if (restaurantId) {
            query.$or = [
                { restaurant_id: null },
                { restaurant_id: restaurantId }
            ];
        }

        const offers = await Offer.find(query)
            .populate('restaurant_id', 'name')
            .populate('applicable_items', 'name')
            .populate('applicable_categories', 'name');

        return {
            success: true,
            count: offers.length,
            offers: offers.filter(offer => isOfferActive(offer))
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Creates a new offer (Admin function)
 * @param {object} offerData - Offer details
 * @returns {object} - Created offer or error
 */
async function createOffer(offerData) {
    try {
        // Validate required fields
        if (!offerData.title || !offerData.offer_type || !offerData.value) {
            return { success: false, error: 'Missing required fields' };
        }

        const offer = new Offer(offerData);
        await offer.save();

        return { success: true, offer };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Updates an existing offer
 * @param {string} offerId - Offer ID
 * @param {object} updateData - Fields to update
 * @returns {object} - Updated offer or error
 */
async function updateOffer(offerId, updateData) {
    try {
        const offer = await Offer.findByIdAndUpdate(
            offerId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!offer) {
            return { success: false, error: 'Offer not found' };
        }

        return { success: true, offer };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Deletes an offer
 * @param {string} offerId - Offer ID
 * @returns {object} - Success or error
 */
async function deleteOffer(offerId) {
    try {
        const result = await Offer.findByIdAndDelete(offerId);

        if (!result) {
            return { success: false, error: 'Offer not found' };
        }

        return { success: true, message: 'Offer deleted successfully' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = {
    isOfferActive,
    calculateOfferDiscount,
    getApplicableOffers,
    applyOfferToPrice,
    recordOfferUsage,
    getActiveOffers,
    createOffer,
    updateOffer,
    deleteOffer
};
