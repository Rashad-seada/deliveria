/**
 * Offers Management Controller
 * Handles CRUD operations for promotional offers
 */

const Offer = require("../models/Offer");
const {
    getApplicableOffers,
    applyOfferToPrice,
    recordOfferUsage,
    getActiveOffers,
    createOffer,
    updateOffer,
    deleteOffer
} = require("../utils/offerManager");

/**
 * Creates a new offer (Admin only)
 */
module.exports.createOffer = async (req, res) => {
    try {
        const offerData = req.body;

        // Validate required fields
        if (!offerData.title || !offerData.offer_type || offerData.value === undefined) {
            return res.status(400).json({ message: "Missing required fields: title, offer_type, value" });
        }

        // Set creator
        offerData.created_by = req.decoded?.id;

        const result = await createOffer(offerData);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(201).json({
            message: "Offer created successfully",
            offer: result.offer
        });
    } catch (error) {
        console.error("Error creating offer:", error);
        return res.status(500).json({ message: "Error creating offer", error: error.message });
    }
};

/**
 * Gets all offers (with filters)
 */
module.exports.getAllOffers = async (req, res) => {
    try {
        const { status, restaurantId, limit = 10, page = 1 } = req.query;

        let query = {};
        if (status) {
            query.status = status;
        }
        if (restaurantId) {
            query.$or = [
                { restaurant_id: null },
                { restaurant_id: restaurantId }
            ];
        }

        const skip = (page - 1) * limit;

        const offers = await Offer.find(query)
            .populate('restaurant_id', 'name')
            .populate('applicable_items', 'name')
            .populate('applicable_categories', 'name')
            .limit(parseInt(limit))
            .skip(skip)
            .sort({ createdAt: -1 });

        const total = await Offer.countDocuments(query);

        return res.json({
            offers,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Error fetching offers:", error);
        return res.status(500).json({ message: "Error fetching offers", error: error.message });
    }
};

/**
 * Gets a specific offer by ID
 */
module.exports.getOfferById = async (req, res) => {
    try {
        const { offerId } = req.params;

        const offer = await Offer.findById(offerId)
            .populate('restaurant_id', 'name')
            .populate('applicable_items', 'name photo')
            .populate('applicable_categories', 'name')
            .populate('created_by', 'first_name last_name');

        if (!offer) {
            return res.status(404).json({ message: "Offer not found" });
        }

        return res.json({ offer });
    } catch (error) {
        console.error("Error fetching offer:", error);
        return res.status(500).json({ message: "Error fetching offer", error: error.message });
    }
};

/**
 * Updates an offer (Admin only)
 */
module.exports.updateOffer = async (req, res) => {
    try {
        const { offerId } = req.params;
        const updateData = req.body;

        const result = await updateOffer(offerId, updateData);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json({
            message: "Offer updated successfully",
            offer: result.offer
        });
    } catch (error) {
        console.error("Error updating offer:", error);
        return res.status(500).json({ message: "Error updating offer", error: error.message });
    }
};

/**
 * Deletes an offer (Admin only)
 */
module.exports.deleteOffer = async (req, res) => {
    try {
        const { offerId } = req.params;

        const result = await deleteOffer(offerId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error("Error deleting offer:", error);
        return res.status(500).json({ message: "Error deleting offer", error: error.message });
    }
};

/**
 * Gets active offers for cart
 */
module.exports.getApplicableOffers = async (req, res) => {
    try {
        const { restaurantId, itemIds = [], categoryIds = [], cartTotal = 0 } = req.query;

        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant ID is required" });
        }

        const itemIdArray = Array.isArray(itemIds) ? itemIds : [itemIds];
        const categoryIdArray = Array.isArray(categoryIds) ? categoryIds : [categoryIds];

        const result = await getApplicableOffers(restaurantId, itemIdArray, categoryIdArray, parseFloat(cartTotal));

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json({
            count: result.offers.length,
            offers: result.offers
        });
    } catch (error) {
        console.error("Error fetching applicable offers:", error);
        return res.status(500).json({ message: "Error fetching applicable offers", error: error.message });
    }
};

/**
 * Applies an offer to a price
 */
module.exports.applyOfferToPrice = async (req, res) => {
    try {
        const { offerId } = req.params;
        const { price } = req.body;

        if (!price || price <= 0) {
            return res.status(400).json({ message: "Valid price is required" });
        }

        const offer = await Offer.findById(offerId);
        if (!offer) {
            return res.status(404).json({ message: "Offer not found" });
        }

        const result = applyOfferToPrice(offer, price);

        return res.json(result);
    } catch (error) {
        console.error("Error applying offer:", error);
        return res.status(500).json({ message: "Error applying offer", error: error.message });
    }
};

/**
 * Gets active offers for restaurant
 */
module.exports.getActiveOffers = async (req, res) => {
    try {
        const { restaurantId } = req.query;

        const result = await getActiveOffers(restaurantId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error("Error fetching active offers:", error);
        return res.status(500).json({ message: "Error fetching active offers", error: error.message });
    }
};

/**
 * Records offer usage when applied to an order
 */
module.exports.recordOfferUsage = async (req, res) => {
    try {
        const { offerId } = req.params;
        const userId = req.decoded?.id;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        const result = await recordOfferUsage(offerId, userId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error("Error recording offer usage:", error);
        return res.status(500).json({ message: "Error recording offer usage", error: error.message });
    }
};

/**
 * Toggles offer status (Active/Inactive)
 */
module.exports.toggleOfferStatus = async (req, res) => {
    try {
        const { offerId } = req.params;
        const { status } = req.body;

        if (!['Active', 'Inactive', 'Scheduled'].includes(status)) {
            return res.status(400).json({ message: "Invalid status. Must be: Active, Inactive, or Scheduled" });
        }

        const result = await updateOffer(offerId, { status });

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json({
            message: "Offer status updated successfully",
            offer: result.offer
        });
    } catch (error) {
        console.error("Error toggling offer status:", error);
        return res.status(500).json({ message: "Error toggling offer status", error: error.message });
    }
};

/**
 * Gets offers statistics
 */
module.exports.getOffersStatistics = async (req, res) => {
    try {
        const { restaurantId } = req.query;

        let query = {};
        if (restaurantId) {
            query.$or = [
                { restaurant_id: null },
                { restaurant_id: restaurantId }
            ];
        }

        const totalOffers = await Offer.countDocuments(query);
        const activeOffers = await Offer.countDocuments({ ...query, status: 'Active' });
        const inactiveOffers = await Offer.countDocuments({ ...query, status: 'Inactive' });

        const offers = await Offer.find(query);
        const totalUsage = offers.reduce((sum, offer) => sum + (offer.usage_limits?.current_uses || 0), 0);

        return res.json({
            statistics: {
                total_offers: totalOffers,
                active_offers: activeOffers,
                inactive_offers: inactiveOffers,
                total_usage: totalUsage,
                percentage_used: totalOffers > 0 ? ((activeOffers / totalOffers) * 100).toFixed(2) : 0
            }
        });
    } catch (error) {
        console.error("Error getting offers statistics:", error);
        return res.status(500).json({ message: "Error getting offers statistics", error: error.message });
    }
};
