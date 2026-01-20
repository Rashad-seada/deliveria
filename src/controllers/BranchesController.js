/**
 * BranchesController.js
 * Controller for multi-branch restaurant management
 * Allows both Admins and Restaurant Owners to manage branches
 */

const Restaurant = require("../models/Restaurants");
const Item = require("../models/Items");
const { hashSync, genSaltSync } = require("bcrypt");

/**
 * Generate unique branch code
 * Format: RESTNAME-BRANCH-XXX
 */
const generateBranchCode = async (parentName, branchName) => {
    const prefix = parentName.substring(0, 6).toUpperCase().replace(/\s+/g, '');
    const branchPrefix = branchName.substring(0, 4).toUpperCase().replace(/\s+/g, '');

    // Find existing codes with this prefix to get the next number
    const existingBranches = await Restaurant.find({
        branch_code: { $regex: `^${prefix}-${branchPrefix}` }
    }).select('branch_code');

    const nextNum = existingBranches.length + 1;
    return `${prefix}-${branchPrefix}-${String(nextNum).padStart(3, '0')}`;
};

/**
 * Check if user has permission to manage this restaurant's branches
 */
const hasPermission = (decoded, restaurantId) => {
    if (!decoded) return false;
    if (decoded.user_type === "Admin") return true;
    if (decoded.user_type === "Restaurant" && decoded.id === restaurantId.toString()) return true;
    return false;
};

/**
 * GET /restaurants/:id/branches
 * Get all branches of a restaurant
 */
module.exports.getBranches = async (req, res) => {
    try {
        if (!req.decoded) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const parentId = req.params.id;

        // Get the parent restaurant
        const parent = await Restaurant.findById(parentId)
            .select('name logo photo is_main_branch branch_name branch_code is_show');

        if (!parent) {
            return res.status(404).json({ success: false, message: "Restaurant not found" });
        }

        // Check permission
        if (!hasPermission(req.decoded, parentId)) {
            return res.status(403).json({ success: false, message: "You don't have permission to view these branches" });
        }

        // Get all branches of this restaurant
        const branches = await Restaurant.find({ parent_restaurant_id: parentId })
            .select('branch_name branch_code phone coordinates location_map open_hour close_hour delivery_cost preparation_time delivery_time is_show is_open status createdAt')
            .sort({ createdAt: -1 });

        // Count branches
        const branchesCount = branches.length;

        return res.status(200).json({
            success: true,
            data: {
                parent: {
                    _id: parent._id,
                    name: parent.name,
                    logo: parent.logo,
                    photo: parent.photo,
                    is_main_branch: parent.is_main_branch,
                    branches_count: branchesCount
                },
                branches: branches.map(branch => ({
                    ...branch.toObject(),
                    is_open: checkIsOpen(branch.open_hour, branch.close_hour)
                }))
            }
        });
    } catch (error) {
        console.error("getBranches error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

/**
 * GET /restaurants/branches/:branchId
 * Get single branch details
 */
module.exports.getBranchById = async (req, res) => {
    try {
        if (!req.decoded) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const branchId = req.params.branchId;

        const branch = await Restaurant.findById(branchId)
            .populate('parent_restaurant_id', 'name logo photo super_category sub_category commission_percentage');

        if (!branch) {
            return res.status(404).json({ success: false, message: "Branch not found" });
        }

        if (!branch.parent_restaurant_id) {
            return res.status(400).json({ success: false, message: "This is not a branch" });
        }

        // Check permission
        const parentId = branch.parent_restaurant_id._id || branch.parent_restaurant_id;
        if (!hasPermission(req.decoded, parentId)) {
            return res.status(403).json({ success: false, message: "You don't have permission to view this branch" });
        }

        return res.status(200).json({
            success: true,
            data: {
                ...branch.toObject(),
                is_open: checkIsOpen(branch.open_hour, branch.close_hour)
            }
        });
    } catch (error) {
        console.error("getBranchById error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

/**
 * POST /restaurants/:id/branches
 * Create a new branch
 */
module.exports.createBranch = async (req, res) => {
    try {
        if (!req.decoded) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const parentId = req.params.id;

        // Get the parent restaurant
        const parent = await Restaurant.findById(parentId);
        if (!parent) {
            return res.status(404).json({ success: false, message: "Parent restaurant not found" });
        }

        // Check permission
        if (!hasPermission(req.decoded, parentId)) {
            return res.status(403).json({ success: false, message: "You don't have permission to create branches for this restaurant" });
        }

        // Ensure parent is not itself a branch
        if (parent.parent_restaurant_id) {
            return res.status(400).json({ success: false, message: "Cannot create a branch of a branch. Use the main restaurant." });
        }

        const {
            branch_name,
            phone,
            address,
            latitude,
            longitude,
            location_map,
            open_hour,
            close_hour,
            delivery_cost,
            preparation_time,
            delivery_time,
            password
        } = req.body;

        if (!branch_name?.trim()) {
            return res.status(400).json({ success: false, message: "Branch name is required" });
        }

        if (!phone?.trim()) {
            return res.status(400).json({ success: false, message: "Phone number is required" });
        }

        // Check if phone is already used
        const existingPhone = await Restaurant.findOne({ phone: phone.trim() });
        if (existingPhone) {
            return res.status(409).json({ success: false, message: "Phone number already in use" });
        }

        // Generate branch code
        const branchCode = await generateBranchCode(parent.name, branch_name);

        // Hash password (use parent's password if not provided)
        const hashedPassword = password?.trim()
            ? hashSync(password.trim(), genSaltSync(10))
            : parent.password;

        // Create branch - inheriting from parent
        const branch = new Restaurant({
            // Inherited from parent
            name: parent.name,
            logo: parent.logo,
            photo: parent.photo,
            super_category: parent.super_category,
            sub_category: parent.sub_category,
            about_us: parent.about_us,
            commission_percentage: parent.commission_percentage,

            // Branch-specific required fields
            phone: phone.trim(),
            user_name: phone.trim(),
            password: hashedPassword,

            // Branch relationship
            parent_restaurant_id: parentId,
            is_main_branch: false,
            branch_name: branch_name.trim(),
            branch_code: branchCode,

            // Branch-specific optional fields
            location_map: location_map?.trim() || "",
            coordinates: {
                latitude: parseFloat(latitude) || 0,
                longitude: parseFloat(longitude) || 0
            },
            open_hour: open_hour?.trim() || parent.open_hour,
            close_hour: close_hour?.trim() || parent.close_hour,
            delivery_cost: parseFloat(delivery_cost) || parent.delivery_cost,
            preparation_time: parseInt(preparation_time) || parent.preparation_time,
            delivery_time: parseInt(delivery_time) || parent.delivery_time,

            // Default branch settings
            rate_number: 0,
            user_rated: 0,
            rate: 0,
            reviews: [],
            have_delivery: parent.have_delivery,
            is_show: true,
            is_show_in_home: false, // Branches don't show in home by default
            estimated_time: parent.estimated_time,
            is_open: true,
            status: "Active"
        });

        await branch.save();

        return res.status(201).json({
            success: true,
            message: "Branch created successfully",
            data: {
                _id: branch._id,
                parent_restaurant_id: branch.parent_restaurant_id,
                branch_name: branch.branch_name,
                branch_code: branch.branch_code,
                is_main_branch: branch.is_main_branch,
                is_show: branch.is_show,
                phone: branch.phone,
                coordinates: branch.coordinates
            }
        });
    } catch (error) {
        console.error("createBranch error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

/**
 * PUT /restaurants/branches/:branchId
 * Update branch details
 */
module.exports.updateBranch = async (req, res) => {
    try {
        if (!req.decoded) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const branchId = req.params.branchId;

        const branch = await Restaurant.findById(branchId);
        if (!branch) {
            return res.status(404).json({ success: false, message: "Branch not found" });
        }

        if (!branch.parent_restaurant_id) {
            return res.status(400).json({ success: false, message: "This is not a branch. Use the restaurant update endpoint." });
        }

        // Check permission
        if (!hasPermission(req.decoded, branch.parent_restaurant_id)) {
            return res.status(403).json({ success: false, message: "You don't have permission to update this branch" });
        }

        const updateData = {};
        const body = req.body;

        // Branch-specific fields that can be updated
        if (body.branch_name?.trim()) updateData.branch_name = body.branch_name.trim();
        if (body.phone?.trim()) {
            // Check if new phone is already in use
            const existingPhone = await Restaurant.findOne({ phone: body.phone.trim(), _id: { $ne: branchId } });
            if (existingPhone) {
                return res.status(409).json({ success: false, message: "Phone number already in use" });
            }
            updateData.phone = body.phone.trim();
            updateData.user_name = body.phone.trim();
        }
        if (body.location_map?.trim()) updateData.location_map = body.location_map.trim();
        if (body.latitude !== undefined && body.longitude !== undefined) {
            updateData.coordinates = {
                latitude: parseFloat(body.latitude),
                longitude: parseFloat(body.longitude)
            };
        }
        if (body.open_hour?.trim()) updateData.open_hour = body.open_hour.trim();
        if (body.close_hour?.trim()) updateData.close_hour = body.close_hour.trim();
        if (body.delivery_cost !== undefined) updateData.delivery_cost = parseFloat(body.delivery_cost);
        if (body.preparation_time !== undefined) updateData.preparation_time = parseInt(body.preparation_time);
        if (body.delivery_time !== undefined) updateData.delivery_time = parseInt(body.delivery_time);
        if (body.have_delivery !== undefined) updateData.have_delivery = body.have_delivery === true || body.have_delivery === 'true';

        // Admin-only fields
        if (req.decoded.user_type === "Admin") {
            if (body.commission_percentage !== undefined) {
                let commission = parseFloat(body.commission_percentage);
                if (!isNaN(commission)) {
                    if (commission < 0) commission = 0;
                    if (commission > 100) commission = 100;
                    updateData.commission_percentage = commission;
                }
            }
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ success: false, message: "No valid fields to update" });
        }

        const updatedBranch = await Restaurant.findByIdAndUpdate(
            branchId,
            { $set: updateData },
            { new: true }
        ).select('-password');

        return res.status(200).json({
            success: true,
            message: "Branch updated successfully",
            data: updatedBranch
        });
    } catch (error) {
        console.error("updateBranch error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

/**
 * DELETE /restaurants/branches/:branchId
 * Delete a branch
 */
module.exports.deleteBranch = async (req, res) => {
    try {
        if (!req.decoded) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const branchId = req.params.branchId;

        const branch = await Restaurant.findById(branchId);
        if (!branch) {
            return res.status(404).json({ success: false, message: "Branch not found" });
        }

        if (!branch.parent_restaurant_id) {
            return res.status(400).json({ success: false, message: "This is not a branch. Use the restaurant delete endpoint." });
        }

        // Check permission
        if (!hasPermission(req.decoded, branch.parent_restaurant_id)) {
            return res.status(403).json({ success: false, message: "You don't have permission to delete this branch" });
        }

        // Soft delete - deactivate the branch
        await Restaurant.findByIdAndUpdate(branchId, {
            $set: {
                status: "Inactive",
                is_show: false,
                is_show_in_home: false
            }
        });

        return res.status(200).json({
            success: true,
            message: "Branch deleted successfully"
        });
    } catch (error) {
        console.error("deleteBranch error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

/**
 * PATCH /restaurants/branches/:branchId/toggle
 * Toggle branch visibility (pause/resume)
 */
module.exports.toggleBranch = async (req, res) => {
    try {
        if (!req.decoded) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const branchId = req.params.branchId;

        const branch = await Restaurant.findById(branchId);
        if (!branch) {
            return res.status(404).json({ success: false, message: "Branch not found" });
        }

        if (!branch.parent_restaurant_id) {
            return res.status(400).json({ success: false, message: "This is not a branch" });
        }

        // Check permission
        if (!hasPermission(req.decoded, branch.parent_restaurant_id)) {
            return res.status(403).json({ success: false, message: "You don't have permission to toggle this branch" });
        }

        // Toggle is_show
        const newStatus = !branch.is_show;

        await Restaurant.findByIdAndUpdate(branchId, {
            $set: { is_show: newStatus }
        });

        return res.status(200).json({
            success: true,
            message: newStatus ? "Branch resumed successfully" : "Branch paused successfully",
            data: { is_show: newStatus }
        });
    } catch (error) {
        console.error("toggleBranch error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

/**
 * Helper function to check if restaurant is open
 */
const checkIsOpen = (openHour, closeHour) => {
    if (!openHour || !closeHour) return true;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [openH, openM] = openHour.split(':').map(Number);
    const [closeH, closeM] = closeHour.split(':').map(Number);

    const openTime = openH * 60 + (openM || 0);
    const closeTime = closeH * 60 + (closeM || 0);

    if (closeTime < openTime) {
        // Open overnight (e.g., 22:00 - 02:00)
        return currentTime >= openTime || currentTime <= closeTime;
    }

    return currentTime >= openTime && currentTime <= closeTime;
};
