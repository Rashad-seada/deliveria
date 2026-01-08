/**
 * Inventory Management Controller
 * Handles product stock level management and low-stock alerts
 */

const Item = require("../models/Items");
const Branch = require("../models/Branch");
const {
    incrementProductQuantity,
    setProductQuantity,
    getProductQuantity,
    setLowStockThreshold,
    getLowStockItems,
    getInventorySummary
} = require("../utils/inventoryManager");

/**
 * Gets product quantity
 */
module.exports.getProductQuantity = async (req, res) => {
    try {
        const { itemId } = req.params;
        const { sizeId } = req.query;

        const result = await getProductQuantity(itemId, sizeId);

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error("Error getting product quantity:", error);
        return res.status(500).json({ message: "Error getting product quantity", error: error.message });
    }
};

/**
 * Updates product quantity
 */
module.exports.updateProductQuantity = async (req, res) => {
    try {
        const { itemId } = req.params;
        const { quantity, sizeId } = req.body;

        if (quantity === undefined || quantity === null) {
            return res.status(400).json({ message: "Quantity is required" });
        }

        const result = await setProductQuantity(itemId, quantity, sizeId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json({
            message: "Product quantity updated successfully",
            item: result.item
        });
    } catch (error) {
        console.error("Error updating product quantity:", error);
        return res.status(500).json({ message: "Error updating product quantity", error: error.message });
    }
};

/**
 * Increments product quantity (restocking)
 */
module.exports.incrementQuantity = async (req, res) => {
    try {
        const { itemId } = req.params;
        const { quantity, sizeId } = req.body;

        if (!quantity || quantity <= 0) {
            return res.status(400).json({ message: "Quantity must be greater than 0" });
        }

        const result = await incrementProductQuantity(itemId, quantity, sizeId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json({
            message: "Product quantity incremented successfully",
            item: result.item
        });
    } catch (error) {
        console.error("Error incrementing product quantity:", error);
        return res.status(500).json({ message: "Error incrementing product quantity", error: error.message });
    }
};

/**
 * Gets and updates low-stock threshold
 */
module.exports.getLowStockThreshold = async (req, res) => {
    try {
        const { itemId } = req.params;

        const item = await Item.findById(itemId).select('name low_stock_threshold quantity');

        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        return res.json({
            item_id: itemId,
            name: item.name,
            current_quantity: item.quantity,
            low_stock_threshold: item.low_stock_threshold,
            is_low_stock: item.quantity <= item.low_stock_threshold
        });
    } catch (error) {
        console.error("Error getting low-stock threshold:", error);
        return res.status(500).json({ message: "Error getting low-stock threshold", error: error.message });
    }
};

/**
 * Updates low-stock threshold
 */
module.exports.updateLowStockThreshold = async (req, res) => {
    try {
        const { itemId } = req.params;
        const { threshold } = req.body;

        if (threshold === undefined || threshold === null) {
            return res.status(400).json({ message: "Threshold is required" });
        }

        const result = await setLowStockThreshold(itemId, threshold);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json({
            message: "Low-stock threshold updated successfully",
            item: result.item
        });
    } catch (error) {
        console.error("Error updating low-stock threshold:", error);
        return res.status(500).json({ message: "Error updating low-stock threshold", error: error.message });
    }
};

/**
 * Gets all low-stock items for restaurant/branch
 */
module.exports.getLowStockItems = async (req, res) => {
    try {
        const restaurantId = req.decoded?.restaurant_id;
        const { branchId } = req.query;

        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant ID is required" });
        }

        const result = await getLowStockItems(restaurantId, branchId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error("Error getting low-stock items:", error);
        return res.status(500).json({ message: "Error getting low-stock items", error: error.message });
    }
};

/**
 * Gets inventory summary for restaurant/branch
 */
module.exports.getInventorySummary = async (req, res) => {
    try {
        const restaurantId = req.decoded?.restaurant_id;
        const { branchId } = req.query;

        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant ID is required" });
        }

        const result = await getInventorySummary(restaurantId, branchId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error("Error getting inventory summary:", error);
        return res.status(500).json({ message: "Error getting inventory summary", error: error.message });
    }
};

/**
 * Bulk update quantities
 */
module.exports.bulkUpdateQuantities = async (req, res) => {
    try {
        const { updates } = req.body; // Array of {itemId, quantity, sizeId}

        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ message: "Updates array is required" });
        }

        const results = [];
        const errors = [];

        for (const update of updates) {
            const result = await setProductQuantity(update.itemId, update.quantity, update.sizeId);
            if (result.success) {
                results.push({
                    item_id: update.itemId,
                    status: 'success',
                    quantity: update.quantity
                });
            } else {
                errors.push({
                    item_id: update.itemId,
                    status: 'failed',
                    error: result.error
                });
            }
        }

        return res.json({
            message: 'Bulk update completed',
            successful: results.length,
            failed: errors.length,
            results,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error("Error bulk updating quantities:", error);
        return res.status(500).json({ message: "Error bulk updating quantities", error: error.message });
    }
};

/**
 * Gets inventory report for a date range
 */
module.exports.getInventoryReport = async (req, res) => {
    try {
        const restaurantId = req.decoded?.restaurant_id;
        const { startDate, endDate, branchId } = req.query;

        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant ID is required" });
        }

        let query = { restaurant_id: restaurantId };
        if (branchId) {
            query.branch_id = branchId;
        }

        const items = await Item.find(query)
            .select('name quantity low_stock_threshold photo')
            .sort({ name: 1 });

        // Calculate statistics
        const stats = {
            total_items: items.length,
            total_quantity: items.reduce((sum, item) => sum + item.quantity, 0),
            out_of_stock: items.filter(item => item.quantity === 0).length,
            low_stock: items.filter(item => item.quantity > 0 && item.quantity <= item.low_stock_threshold).length,
            generated_at: new Date()
        };

        return res.json({
            statistics: stats,
            items
        });
    } catch (error) {
        console.error("Error getting inventory report:", error);
        return res.status(500).json({ message: "Error getting inventory report", error: error.message });
    }
};
