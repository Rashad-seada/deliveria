const Cart = require("../models/Carts");
const Item = require("../models/Items");
const Restaurant = require("../models/Restaurants");
const Order = require("../models/Orders");
const mongoose = require("mongoose");
const { not_select, checkIsOpen } = require("./global");

module.exports.createItem = async (req, res) => {
    try {
        // The decoded token is attached to req.decoded, not req.body.decoded
        if (req.decoded.user_type !== "Restaurant") {
            return res.status(403).json({
                message: 'Forbidden: This action is only for restaurants.'
            });
        }

        const { name, description, sizes: sizesJSON, have_option, item_category, toppings: toppingsJSON } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: "Item photo is required." });
        }

        if (!name || !description || !sizesJSON || !item_category) {
            return res.status(400).json({ message: "Missing required fields (name, description, sizes, item_category)." });
        }

        const sizes = JSON.parse(sizesJSON).map(s => ({
            size: s.size,
            price_before: s.price_before,
            price_after: s.price_after,
            offer: (s.price_after / s.price_before) * 100
        }));

        let item = new Item({
            restaurant_id: req.decoded.id, // Correctly access decoded token from req
            photo: req.file.path,
            name: name.trim(),
            description: description.trim(),
            sizes: sizes,
            enable: true,
            have_option: have_option,
            item_category: item_category,
            toppings: JSON.parse(toppingsJSON || '[]'),
        });

        const savedItem = await item.save();

        return res.status(201).json({
            message: "Item created successfully",
            item: savedItem
        });

    } catch (error) {
        console.error("Error creating item:", error);
        if (error instanceof SyntaxError) {
            return res.status(400).json({ message: "Invalid JSON format for sizes or toppings." });
        }
        return res.status(500).json({
            message: "Server error while creating item",
            error: error.message
        });
    }
}

module.exports.updateItem = async (req, res) => {
    try {
        if (!req.decoded) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const itemId = req.params.id;
        const item = await Item.findById(itemId);

        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }

        // Check permissions: Restaurant owner or Admin
        const isOwner = req.decoded.user_type === "Restaurant" && req.decoded.id === item.restaurant_id.toString();
        const isAdmin = req.decoded.user_type === "Admin";

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ success: false, message: "Forbidden: You do not have permission to update this item." });
        }

        const body = req.body;
        const updateData = {};

        // Update name and description
        if (body.name?.trim()) updateData.name = body.name.trim();
        if (body.description?.trim()) updateData.description = body.description.trim();

        // Update item_category
        if (body.item_category) updateData.item_category = body.item_category;

        // Update enable status
        if (body.enable !== undefined) {
            updateData.enable = body.enable === true || body.enable === 'true';
        }

        // Update have_option
        if (body.have_option !== undefined) {
            updateData.have_option = body.have_option === true || body.have_option === 'true';
        }

        // Handle sizes update
        if (body.sizes) {
            try {
                const sizesFront = typeof body.sizes === 'string' ? JSON.parse(body.sizes) : body.sizes;
                updateData.sizes = sizesFront.map(s => ({
                    size: s.size,
                    price_before: parseFloat(s.price_before) || 0,
                    price_after: parseFloat(s.price_after) || 0,
                    offer: s.price_before > 0
                        ? Math.round(((s.price_before - s.price_after) / s.price_before) * 100)
                        : 0
                }));
            } catch (e) {
                console.log("Error parsing sizes:", e.message);
            }
        }

        // Handle toppings update
        if (body.toppings) {
            try {
                updateData.toppings = typeof body.toppings === 'string'
                    ? JSON.parse(body.toppings)
                    : body.toppings;
            } catch (e) {
                console.log("Error parsing toppings:", e.message);
            }
        }

        // Handle photo update
        if (req.file?.path) {
            updateData.photo = req.file.path;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ success: false, message: "No valid fields to update" });
        }

        const updatedItem = await Item.findByIdAndUpdate(
            itemId,
            { $set: updateData },
            { new: true }
        );

        return res.status(200).json({
            success: true,
            message: "Item updated successfully",
            data: updatedItem
        });
    } catch (error) {
        console.error("updateItem error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
}

module.exports.getAllItemsForRestaurant = async (req, res, next) => {
    try {
        const restaurantId = req.params.restaurant_id;

        const restaurant = await Restaurant.findById(restaurantId).select(not_select.join(' '))
        const is_open = checkIsOpen(restaurant.open_hour, restaurant.close_hour);

        const restaurantWithStatus = {
            ...restaurant.toObject(),
            is_open
        };

        let category

        if (req.params.item_category_id === "all") {
            category = {
                restaurant_id: restaurantId,
            }
        } else {
            category = {
                restaurant_id: restaurantId,
                item_category: req.params.item_category_id
            }
        }

        // 1. Calculate Top Selling Items for this restaurant
        // Aggregate orders to count how many times each item has been sold
        const topSellingItems = await Order.aggregate([
            { $unwind: "$orders" },
            {
                $match: {
                    "orders.restaurant_id": new mongoose.Types.ObjectId(restaurantId),
                    "order_status": "Delivered" // Only count delivered orders for accuracy
                }
            },
            { $unwind: "$orders.items" },
            {
                $group: {
                    _id: "$orders.items.item_details.item_id", // Group by Item ID string
                    total_sold: { $sum: "$orders.items.size_details.quantity" } // Sum quantity
                }
            },
            { $sort: { total_sold: -1 } }, // Sort descending
            { $limit: 10 } // Get top 10
        ]);

        // Create a set of best seller IDs for O(1) lookup
        const bestSellerIds = new Set(topSellingItems.map(item => item._id.toString()));

        // Fetch items and mark best sellers
        const items = await Item.find(category).lean();

        const itemsWithBestSeller = items.map(item => ({
            ...item,
            is_best_seller: bestSellerIds.has(item._id.toString())
        }));

        return res.status(200).json({
            response: {
                restaurant: restaurantWithStatus,
                items: itemsWithBestSeller
            }
        })
    } catch (error) {
        console.error("getAllItemsForRestaurant error:", error);
        return res.status(500).json({
            message: "Error fetching items",
            error: error.message
        })
    }
}

module.exports.getAllItemsByPrice = (req, res, next) => {
    try {
        Item.find({ restaurant_id: req.params.restaurant_id }).sort({ price: -1 }).then(response => {
            return res.status(200).json({ response })
        })
    } catch (error) {
        return res.json({
            message: "Error"
        })
    }
}

module.exports.deleteItem = async (req, res, next) => {
    try {
        if (!req.decoded) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const itemId = req.params.id;
        const item = await Item.findById(itemId);

        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }

        // Check permissions: Restaurant owner or Admin
        const isOwner = req.decoded.user_type === "Restaurant" && req.decoded.id === item.restaurant_id.toString();
        const isAdmin = req.decoded.user_type === "Admin";

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ success: false, message: "Forbidden: You do not have permission to delete this item." });
        }

        // Delete the item
        await Item.findByIdAndDelete(itemId);

        // Clean up carts that contain this item
        await Cart.updateMany(
            { "carts.items.item_id": itemId },
            { $pull: { "carts.$[].items": { item_id: itemId } } }
        );

        // Remove empty cart entries
        await Cart.updateMany(
            { "carts.items": { $size: 0 } },
            { $pull: { carts: { items: { $size: 0 } } } }
        );

        return res.status(200).json({
            success: true,
            message: "Item deleted successfully"
        });
    } catch (error) {
        console.error("deleteItem error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
}

// Upload item image
module.exports.uploadImage = async (req, res) => {
    try {
        if (!req.decoded) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const itemId = req.params.id;
        const item = await Item.findById(itemId);

        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }

        // Check permissions: Restaurant owner or Admin
        const isOwner = req.decoded.user_type === "Restaurant" && req.decoded.id === item.restaurant_id.toString();
        const isAdmin = req.decoded.user_type === "Admin";

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ success: false, message: "Forbidden: You do not have permission to update this item." });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: "Image file is required" });
        }

        const updatedItem = await Item.findByIdAndUpdate(
            itemId,
            { $set: { photo: req.file.path } },
            { new: true }
        );

        return res.status(200).json({
            success: true,
            message: "Image updated successfully",
            data: { photo: updatedItem.photo }
        });
    } catch (error) {
        console.error("uploadImage error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

module.exports.changeEnable = async (req, res, next) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) {
            return res.status(200).json({
                message: `Item is not found`,
            });
        }
        item.enable = !item.enable;
        await item.save();

        return res.status(200).json({
            message: `This item is ${item.enable ? "enabled" : "disabled"}`,
            enable: item.enable,
        });
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}

module.exports.searchItem = async (req, res) => {
    try {
        const items = await Item.find({ restaurant_id: req.params.id, name: { $regex: new RegExp(req.params.search, 'i') } });

        return res.status(200).json({
            items: items,
        });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({
            message: "Error updating units.",
        });
    }
};

module.exports.updateAll = async (req, res) => {
    try {
        const items = await Item.find();

        for (const item of items) {
            item.have_option = false
            await item.save(); // Save the changes
        }

        return res.status(200).json({
            message: "All units updated successfully!",
        });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({
            message: "Error updating units.",
        });
    }
};