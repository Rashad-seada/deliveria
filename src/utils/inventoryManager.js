/**
 * Product Quantity Management Utilities
 * Handles inventory tracking, low-stock alerts, and quantity updates
 */

const Item = require('../models/Items');
const Branch = require('../models/Branch');

/**
 * Decrements product quantity when an order is confirmed
 * @param {string} itemId - The item to decrement
 * @param {number} quantity - Quantity to decrement
 * @param {string} sizeId - Size ID for size-specific inventory
 * @param {string} branchId - Branch ID for branch-specific inventory
 * @returns {object} - Updated item or error
 */
async function decrementProductQuantity(itemId, quantity, sizeId = null, branchId = null) {
    try {
        const item = await Item.findById(itemId);
        
        if (!item) {
            return { success: false, error: 'Item not found' };
        }

        // Decrement overall quantity
        if (item.quantity < quantity) {
            return { 
                success: false, 
                error: 'Insufficient quantity in stock',
                available: item.quantity
            };
        }

        // If size-specific inventory exists
        if (sizeId) {
            const size = item.sizes.find(s => s._id.toString() === sizeId.toString());
            if (size) {
                if (size.quantity < quantity) {
                    return { 
                        success: false, 
                        error: 'Insufficient quantity for this size',
                        available: size.quantity
                    };
                }
                size.quantity -= quantity;
            }
        }

        // Update main quantity
        item.quantity -= quantity;
        
        // Check for low stock alert
        if (item.quantity <= item.low_stock_threshold && !item.low_stock_alert_sent) {
            item.low_stock_alert_sent = true;
            // Trigger low-stock notification (implement notification service)
            console.warn(`⚠️ Low Stock Alert: ${item.name} quantity is ${item.quantity}`);
        }

        // Reset alert when stock is replenished
        if (item.quantity > item.low_stock_threshold) {
            item.low_stock_alert_sent = false;
        }

        await item.save();
        return { success: true, item };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Increments product quantity (for restocking)
 * @param {string} itemId - The item to increment
 * @param {number} quantity - Quantity to add
 * @param {string} sizeId - Size ID for size-specific inventory
 * @returns {object} - Updated item or error
 */
async function incrementProductQuantity(itemId, quantity, sizeId = null) {
    try {
        const item = await Item.findById(itemId);
        
        if (!item) {
            return { success: false, error: 'Item not found' };
        }

        // Increment overall quantity
        item.quantity += quantity;

        // If size-specific inventory exists
        if (sizeId) {
            const size = item.sizes.find(s => s._id.toString() === sizeId.toString());
            if (size) {
                size.quantity += quantity;
            }
        }

        // Reset low-stock alert when stock is replenished
        if (item.quantity > item.low_stock_threshold) {
            item.low_stock_alert_sent = false;
        }

        await item.save();
        return { success: true, item };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Sets product quantity to a specific value
 * @param {string} itemId - The item to update
 * @param {number} quantity - New quantity value
 * @param {string} sizeId - Size ID for size-specific inventory
 * @returns {object} - Updated item or error
 */
async function setProductQuantity(itemId, quantity, sizeId = null) {
    try {
        const item = await Item.findById(itemId);
        
        if (!item) {
            return { success: false, error: 'Item not found' };
        }

        // Validate quantity
        if (quantity < 0) {
            return { success: false, error: 'Quantity cannot be negative' };
        }

        // Set overall quantity
        item.quantity = quantity;

        // If size-specific inventory exists
        if (sizeId) {
            const size = item.sizes.find(s => s._id.toString() === sizeId.toString());
            if (size) {
                size.quantity = quantity;
            }
        }

        // Check for low stock alert
        if (item.quantity <= item.low_stock_threshold && !item.low_stock_alert_sent) {
            item.low_stock_alert_sent = true;
            console.warn(`⚠️ Low Stock Alert: ${item.name} quantity is ${item.quantity}`);
        } else if (item.quantity > item.low_stock_threshold) {
            item.low_stock_alert_sent = false;
        }

        await item.save();
        return { success: true, item };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Gets the available quantity of a product
 * @param {string} itemId - The item to check
 * @param {string} sizeId - Optional size ID for size-specific quantity
 * @returns {object} - Quantity and availability status
 */
async function getProductQuantity(itemId, sizeId = null) {
    try {
        const item = await Item.findById(itemId);
        
        if (!item) {
            return { success: false, error: 'Item not found' };
        }

        let quantity = item.quantity;
        let isLowStock = item.quantity <= item.low_stock_threshold;

        // If size-specific inventory exists
        if (sizeId) {
            const size = item.sizes.find(s => s._id.toString() === sizeId.toString());
            if (size) {
                quantity = size.quantity;
            }
        }

        return {
            success: true,
            item_id: itemId,
            available_quantity: quantity,
            is_in_stock: quantity > 0,
            is_low_stock: isLowStock,
            low_stock_threshold: item.low_stock_threshold
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Sets the low-stock threshold for an item
 * @param {string} itemId - The item to update
 * @param {number} threshold - New threshold value
 * @returns {object} - Updated item or error
 */
async function setLowStockThreshold(itemId, threshold) {
    try {
        const item = await Item.findById(itemId);
        
        if (!item) {
            return { success: false, error: 'Item not found' };
        }

        if (threshold < 0) {
            return { success: false, error: 'Threshold cannot be negative' };
        }

        item.low_stock_threshold = threshold;

        // Check if current quantity triggers the alert
        if (item.quantity <= threshold && !item.low_stock_alert_sent) {
            item.low_stock_alert_sent = true;
        } else if (item.quantity > threshold) {
            item.low_stock_alert_sent = false;
        }

        await item.save();
        return { success: true, item };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Gets all items with low stock status
 * @param {string} restaurantId - Optional restaurant filter
 * @param {string} branchId - Optional branch filter
 * @returns {array} - Array of low-stock items
 */
async function getLowStockItems(restaurantId = null, branchId = null) {
    try {
        let query = { $expr: { $lte: ["$quantity", "$low_stock_threshold"] } };

        if (restaurantId) {
            query.restaurant_id = restaurantId;
        }
        if (branchId) {
            query.branch_id = branchId;
        }

        const items = await Item.find(query).select('name quantity low_stock_threshold restaurant_id');
        
        return {
            success: true,
            count: items.length,
            items
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Gets inventory summary for a restaurant or branch
 * @param {string} restaurantId - Restaurant ID
 * @param {string} branchId - Optional branch ID
 * @returns {object} - Inventory statistics
 */
async function getInventorySummary(restaurantId, branchId = null) {
    try {
        let query = { restaurant_id: restaurantId };
        if (branchId) {
            query.branch_id = branchId;
        }

        const items = await Item.find(query).select('quantity low_stock_threshold');

        const totalItems = items.length;
        const outOfStock = items.filter(item => item.quantity === 0).length;
        const lowStock = items.filter(item => item.quantity > 0 && item.quantity <= item.low_stock_threshold).length;
        const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

        return {
            success: true,
            total_items: totalItems,
            out_of_stock: outOfStock,
            low_stock: lowStock,
            total_quantity: totalQuantity,
            in_stock: totalItems - outOfStock,
            stock_status_percentage: ((totalItems - outOfStock) / totalItems * 100).toFixed(2)
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = {
    decrementProductQuantity,
    incrementProductQuantity,
    setProductQuantity,
    getProductQuantity,
    setLowStockThreshold,
    getLowStockItems,
    getInventorySummary
};
