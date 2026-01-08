/**
 * Branch Management Controller
 * Handles multi-branch operations for restaurants
 */

const Branch = require("../models/Branch");
const Restaurant = require("../models/Restaurants");
const Item = require("../models/Items");
const Order = require("../models/Orders");

/**
 * Creates a new branch for a restaurant
 */
module.exports.createBranch = async (req, res) => {
    try {
        const { restaurant_id } = req.params;
        const { name, address, phone, coordinates, delivery_fee, opening_time, closing_time, manager_id } = req.body;

        // Verify restaurant exists
        const restaurant = await Restaurant.findById(restaurant_id);
        if (!restaurant) {
            return res.status(404).json({ message: "Restaurant not found" });
        }

        // Validate required fields
        const required = ['name', 'address', 'phone', 'coordinates', 'opening_time', 'closing_time'];
        const missing = required.filter(field => !req.body[field]);
        if (missing.length > 0) {
            return res.status(400).json({
                message: `Missing required fields: ${missing.join(', ')}`
            });
        }

        const branch = new Branch({
            restaurant_id,
            name,
            address,
            phone,
            coordinates,
            delivery_fee: delivery_fee || restaurant.delivery_cost,
            opening_time,
            closing_time,
            manager_id
        });

        await branch.save();

        return res.status(201).json({
            message: "Branch created successfully",
            branch
        });
    } catch (error) {
        console.error("Error creating branch:", error);
        return res.status(500).json({ message: "Error creating branch", error: error.message });
    }
};

/**
 * Gets all branches for a restaurant
 */
module.exports.getRestaurantBranches = async (req, res) => {
    try {
        const { restaurant_id } = req.params;
        const { is_active = true } = req.query;

        let query = { restaurant_id };
        if (is_active !== undefined) {
            query.is_active = is_active === 'true';
        }

        const branches = await Branch.find(query)
            .populate('manager_id', 'first_name last_name email')
            .sort({ createdAt: -1 });

        return res.json({
            count: branches.length,
            branches
        });
    } catch (error) {
        console.error("Error fetching branches:", error);
        return res.status(500).json({ message: "Error fetching branches", error: error.message });
    }
};

/**
 * Gets a specific branch
 */
module.exports.getBranchById = async (req, res) => {
    try {
        const { branchId } = req.params;

        const branch = await Branch.findById(branchId)
            .populate('restaurant_id', 'name logo')
            .populate('manager_id', 'first_name last_name email')
            .populate('staff', 'first_name last_name email role')
            .populate('inventory.item_id', 'name photo');

        if (!branch) {
            return res.status(404).json({ message: "Branch not found" });
        }

        return res.json({ branch });
    } catch (error) {
        console.error("Error fetching branch:", error);
        return res.status(500).json({ message: "Error fetching branch", error: error.message });
    }
};

/**
 * Updates a branch
 */
module.exports.updateBranch = async (req, res) => {
    try {
        const { branchId } = req.params;
        const updateData = req.body;

        const branch = await Branch.findByIdAndUpdate(
            branchId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!branch) {
            return res.status(404).json({ message: "Branch not found" });
        }

        return res.json({
            message: "Branch updated successfully",
            branch
        });
    } catch (error) {
        console.error("Error updating branch:", error);
        return res.status(500).json({ message: "Error updating branch", error: error.message });
    }
};

/**
 * Toggles branch open/close status
 */
module.exports.toggleBranchStatus = async (req, res) => {
    try {
        const { branchId } = req.params;

        const branch = await Branch.findById(branchId);
        if (!branch) {
            return res.status(404).json({ message: "Branch not found" });
        }

        branch.is_open = !branch.is_open;
        await branch.save();

        return res.json({
            message: `Branch is now ${branch.is_open ? 'open' : 'closed'}`,
            branch
        });
    } catch (error) {
        console.error("Error toggling branch status:", error);
        return res.status(500).json({ message: "Error toggling branch status", error: error.message });
    }
};

/**
 * Deletes a branch
 */
module.exports.deleteBranch = async (req, res) => {
    try {
        const { branchId } = req.params;

        const branch = await Branch.findByIdAndDelete(branchId);
        if (!branch) {
            return res.status(404).json({ message: "Branch not found" });
        }

        return res.json({ message: "Branch deleted successfully" });
    } catch (error) {
        console.error("Error deleting branch:", error);
        return res.status(500).json({ message: "Error deleting branch", error: error.message });
    }
};

/**
 * Assigns a staff member to a branch
 */
module.exports.assignStaffToBranch = async (req, res) => {
    try {
        const { branchId } = req.params;
        const { staffId } = req.body;

        const branch = await Branch.findById(branchId);
        if (!branch) {
            return res.status(404).json({ message: "Branch not found" });
        }

        if (!branch.staff.includes(staffId)) {
            branch.staff.push(staffId);
            await branch.save();
        }

        return res.json({
            message: "Staff member assigned successfully",
            branch
        });
    } catch (error) {
        console.error("Error assigning staff:", error);
        return res.status(500).json({ message: "Error assigning staff", error: error.message });
    }
};

/**
 * Removes a staff member from a branch
 */
module.exports.removeStaffFromBranch = async (req, res) => {
    try {
        const { branchId, staffId } = req.params;

        const branch = await Branch.findById(branchId);
        if (!branch) {
            return res.status(404).json({ message: "Branch not found" });
        }

        branch.staff = branch.staff.filter(id => id.toString() !== staffId);
        await branch.save();

        return res.json({
            message: "Staff member removed successfully",
            branch
        });
    } catch (error) {
        console.error("Error removing staff:", error);
        return res.status(500).json({ message: "Error removing staff", error: error.message });
    }
};

/**
 * Gets branch inventory
 */
module.exports.getBranchInventory = async (req, res) => {
    try {
        const { branchId } = req.params;

        const branch = await Branch.findById(branchId)
            .populate('inventory.item_id', 'name photo');

        if (!branch) {
            return res.status(404).json({ message: "Branch not found" });
        }

        const stats = {
            total_items: branch.inventory.length,
            total_quantity: branch.inventory.reduce((sum, item) => sum + item.quantity, 0),
            out_of_stock: branch.inventory.filter(item => item.quantity === 0).length,
            low_stock: branch.inventory.filter(item => item.quantity > 0 && item.quantity <= item.low_stock_threshold).length
        };

        return res.json({
            statistics: stats,
            inventory: branch.inventory
        });
    } catch (error) {
        console.error("Error fetching branch inventory:", error);
        return res.status(500).json({ message: "Error fetching branch inventory", error: error.message });
    }
};

/**
 * Gets branch orders
 */
module.exports.getBranchOrders = async (req, res) => {
    try {
        const { branchId } = req.params;
        const { status, limit = 10, page = 1 } = req.query;

        const branch = await Branch.findById(branchId);
        if (!branch) {
            return res.status(404).json({ message: "Branch not found" });
        }

        let query = {
            "orders.restaurant_id": branch.restaurant_id,
            // TODO: Filter by branch when orders support branch_id
        };

        if (status) {
            query["orders.status"] = status;
        }

        const skip = (page - 1) * limit;
        const orders = await Order.find(query)
            .limit(parseInt(limit))
            .skip(skip)
            .sort({ createdAt: -1 });

        const total = await Order.countDocuments(query);

        return res.json({
            orders,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Error fetching branch orders:", error);
        return res.status(500).json({ message: "Error fetching branch orders", error: error.message });
    }
};

/**
 * Gets branch statistics
 */
module.exports.getBranchStatistics = async (req, res) => {
    try {
        const { branchId } = req.params;

        const branch = await Branch.findById(branchId);
        if (!branch) {
            return res.status(404).json({ message: "Branch not found" });
        }

        // Get orders
        const orders = await Order.find({
            "orders.restaurant_id": branch.restaurant_id
        });

        const stats = {
            total_orders: orders.length,
            total_revenue: orders.reduce((sum, order) => sum + (order.final_price || 0), 0),
            staff_count: branch.staff.length,
            is_open: branch.is_open
        };

        return res.json({
            branch: {
                id: branch._id,
                name: branch.name,
                address: branch.address,
                is_open: branch.is_open
            },
            statistics: stats
        });
    } catch (error) {
        console.error("Error fetching branch statistics:", error);
        return res.status(500).json({ message: "Error fetching branch statistics", error: error.message });
    }
};

/**
 * Gets available branches for customers
 */
module.exports.getAvailableBranches = async (req, res) => {
    try {
        const { restaurant_id } = req.params;

        const branches = await Branch.find({
            restaurant_id,
            is_active: true,
            is_open: true
        }).select('name address phone coordinates delivery_fee opening_time closing_time');

        return res.json({
            count: branches.length,
            branches
        });
    } catch (error) {
        console.error("Error fetching available branches:", error);
        return res.status(500).json({ message: "Error fetching available branches", error: error.message });
    }
};
