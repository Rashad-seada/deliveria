const Cart = require("../models/Carts");
const Item = require("../models/Items");
const Restaurant = require("../models/Restaurants");
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
        if (req.body.decoded.user_type !== "Restaurant") {
            return res.json({
                message: 'This account is not restaurant'
            })
        }
        const body = req.body;

        let sizes = []

        const sizesFront = JSON.parse(body.sizes)

        for (let i = 0; i < sizesFront.length; i++) {
            sizes.push({
                size: sizesFront[i].size,
                price_before: sizesFront[i].price_before,
                price_after: sizesFront[i].price_after,
                offer: (sizesFront[i].price_after / sizesFront[i].price_before) * 100
            })
        }


        let update = {
            name: body.name.trim(),
            description: body.description.trim(),
            sizes: sizes,
            toppings: JSON.parse(body.toppings)
        }

        Item.findByIdAndUpdate(req.params.id, { $set: update }, { new: true }).then(response => {
            return res.status(200).json({
                message: "Item is updated"
            })
        })
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}

module.exports.getAllItemsForRestaurant = async (req, res, next) => {
    try {
        const restaurant = await Restaurant.findById(req.params.restaurant_id).select(not_select.join(' '))
        const is_open = checkIsOpen(restaurant.open_hour, restaurant.close_hour);

        const restaurantWithStatus = {
            ...restaurant.toObject(),
            is_open
        };

        let category

        if (req.params.item_category_id === "all") {
            category = {
                restaurant_id: req.params.restaurant_id,
            }
        } else {
            category = {
                restaurant_id: req.params.restaurant_id,
                item_category: req.params.item_category_id
            }
        }

        const items = await Item.find(category)
        return res.status(200).json({
            response: {
                restaurant: restaurantWithStatus,
                items: items
            }
        })
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
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

module.exports.deleteItem = (req, res, next) => {
    try {
        if (req.body.decoded.user_type !== "Restaurant") {
            return res.json({
                message: 'This account is not restaurant'
            })
        }
        Item.findByIdAndDelete(req.params.id).then(async (response) => {
            await Cart.updateMany(
                { "carts.items.item_id": req.params.id },
                { $pull: { "carts.$[].items": { item_id: req.params.id } } },
            ).then(async (cart) => {
                await Cart.updateMany(
                    { "carts.items": { $size: 0 } },
                    { $pull: { carts: { items: { $size: 0 } } } },
                ).then(async (cart2) => {
                    return res.status(200).json({ message: "Item is delete" })
                });
            });
        })
    } catch (error) {
        return res.json({
            message: "Error"
        })
    }
}

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