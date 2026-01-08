/**
 * Branch Management System
 * Handles multi-branch restaurant operations
 */

const Branch = require("../models/Branch");
const Restaurant = require("../models/Restaurants");
const { checkIsOpen } = require("../controllers/global");

/**
 * Gets all branches for a restaurant
 */
async function getRestaurantBranches(restaurantId) {
    try {
        const branches = await Branch.find({ restaurant_id: restaurantId })
            .populate('manager_id', 'first_name last_name email')
            .select('-inventory -staff'); // Exclude large arrays for list view

        return {
            success: true,
            branches: branches.map(branch => ({
                id: branch._id,
                name: branch.name,
                address: branch.address,
                phone: branch.phone,
                is_open: branch.is_open,
                opening_time: branch.opening_time,
                closing_time: branch.closing_time,
                coordinates: branch.coordinates,
                delivery_fee: branch.delivery_fee,
                manager: branch.manager_id?.first_name + " " + branch.manager_id?.last_name
            }))
        };
    } catch (error) {
        console.error("Error getting branches:", error);
        return {
            success: false,
            message: "Error fetching branches",
            error: error.message
        };
    }
}

/**
 * Gets single branch details
 */
async function getBranchDetails(branchId) {
    try {
        const branch = await Branch.findById(branchId)
            .populate('manager_id', 'first_name last_name email phone')
            .populate('staff', 'first_name last_name email');

        if (!branch) {
            return { success: false, message: "Branch not found" };
        }

        const isOpen = checkIsOpen(branch.opening_time, branch.closing_time);

        return {
            success: true,
            branch: {
                id: branch._id,
                restaurant_id: branch.restaurant_id,
                name: branch.name,
                address: branch.address,
                phone: branch.phone,
                coordinates: branch.coordinates,
                opening_time: branch.opening_time,
                closing_time: branch.closing_time,
                delivery_fee: branch.delivery_fee,
                is_open: isOpen,
                is_active: branch.is_active,
                manager: branch.manager_id,
                staff_count: branch.staff?.length || 0,
                orders_count: branch.orders_count,
                created_at: branch.createdAt
            }
        };
    } catch (error) {
        console.error("Error getting branch details:", error);
        return {
            success: false,
            message: "Error fetching branch details",
            error: error.message
        };
    }
}

/**
 * Creates a new branch
 */
async function createBranch(restaurantId, branchData) {
    try {
        // Validate required fields
        if (!branchData.name || !branchData.address || !branchData.phone) {
            return {
                success: false,
                message: "Name, address, and phone are required"
            };
        }

        // Check if restaurant exists
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) {
            return { success: false, message: "Restaurant not found" };
        }

        const branch = new Branch({
            restaurant_id: restaurantId,
            name: branchData.name.trim(),
            address: branchData.address.trim(),
            phone: branchData.phone.trim(),
            coordinates: branchData.coordinates,
            delivery_fee: branchData.delivery_fee || restaurant.delivery_cost,
            opening_time: branchData.opening_time || restaurant.open_hour,
            closing_time: branchData.closing_time || restaurant.close_hour,
            manager_id: branchData.manager_id || null,
            is_active: true
        });

        await branch.save();

        return {
            success: true,
            message: "Branch created successfully",
            branch: {
                id: branch._id,
                name: branch.name,
                address: branch.address
            }
        };
    } catch (error) {
        console.error("Error creating branch:", error);
        return {
            success: false,
            message: "Error creating branch",
            error: error.message
        };
    }
}

/**
 * Updates branch information
 */
async function updateBranch(branchId, updateData) {
    try {
        const branch = await Branch.findById(branchId);
        if (!branch) {
            return { success: false, message: "Branch not found" };
        }

        // Update allowed fields
        const allowedFields = [
            'name', 'address', 'phone', 'delivery_fee',
            'opening_time', 'closing_time', 'coordinates', 'manager_id'
        ];

        allowedFields.forEach(field => {
            if (updateData[field] !== undefined) {
                branch[field] = updateData[field];
            }
        });

        // Update is_open status if hours changed
        if (updateData.opening_time || updateData.closing_time) {
            const openTime = updateData.opening_time || branch.opening_time;
            const closeTime = updateData.closing_time || branch.closing_time;
            branch.is_open = checkIsOpen(openTime, closeTime);
        }

        await branch.save();

        return {
            success: true,
            message: "Branch updated successfully",
            branch: {
                id: branch._id,
                name: branch.name,
                address: branch.address,
                is_open: branch.is_open
            }
        };
    } catch (error) {
        console.error("Error updating branch:", error);
        return {
            success: false,
            message: "Error updating branch",
            error: error.message
        };
    }
}

/**
 * Toggles branch active/inactive status
 */
async function toggleBranchStatus(branchId, isActive) {
    try {
        const branch = await Branch.findById(branchId);
        if (!branch) {
            return { success: false, message: "Branch not found" };
        }

        branch.is_active = isActive;
        await branch.save();

        return {
            success: true,
            message: `Branch ${isActive ? "activated" : "deactivated"}`,
            is_active: branch.is_active
        };
    } catch (error) {
        console.error("Error toggling branch:", error);
        return {
            success: false,
            message: "Error updating branch status",
            error: error.message
        };
    }
}

/**
 * Deletes a branch
 */
async function deleteBranch(branchId) {
    try {
        const branch = await Branch.findByIdAndDelete(branchId);
        if (!branch) {
            return { success: false, message: "Branch not found" };
        }

        return {
            success: true,
            message: "Branch deleted successfully"
        };
    } catch (error) {
        console.error("Error deleting branch:", error);
        return {
            success: false,
            message: "Error deleting branch",
            error: error.message
        };
    }
}

/**
 * Gets inventory status for a branch
 */
async function getBranchInventory(branchId) {
    try {
        const branch = await Branch.findById(branchId)
            .populate('inventory.item_id', 'name');

        if (!branch) {
            return { success: false, message: "Branch not found" };
        }

        const lowStockItems = branch.inventory.filter(
            item => item.quantity <= item.low_stock_threshold
        );

        return {
            success: true,
            inventory: {
                total_items: branch.inventory.length,
                items: branch.inventory.map(item => ({
                    item_id: item.item_id?._id,
                    item_name: item.item_id?.name,
                    quantity: item.quantity,
                    low_stock_threshold: item.low_stock_threshold,
                    is_low: item.quantity <= item.low_stock_threshold
                })),
                low_stock_items: lowStockItems.length
            }
        };
    } catch (error) {
        console.error("Error getting inventory:", error);
        return {
            success: false,
            message: "Error fetching inventory",
            error: error.message
        };
    }
}

module.exports = {
    getRestaurantBranches,
    getBranchDetails,
    createBranch,
    updateBranch,
    toggleBranchStatus,
    deleteBranch,
    getBranchInventory
};
