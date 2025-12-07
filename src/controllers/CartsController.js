const Address = require("../models/Address");
const Cart = require("../models/Carts");
const CouponCode = require("../models/CouponCodes");
const Restaurant = require("../models/Restaurants");
const Order = require("../models/Orders");
const User = require("../models/Users");

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    // Radius of the Earth in kilometers
    const R = 6371;

    // Convert degrees to radians
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in kilometers
};

module.exports.getCart = async (req, res) => {
    try {
        const { id } = req.decoded;

        const user = await User.findById(id)

        let address;

        if (user.address_id) {
            address = await Address.findById(user.address_id)

            // ✅ Self-Healing: If address_id exists but invalid (dangling), clear it
            if (!address) {
                console.log(`Self-healing: Clearing invalid address_id ${user.address_id} for user ${id}`);
                user.address_id = undefined;
                await user.save();
            }
        }

        // Handle case where user has no default address
        if (!address) {
            const cartForInfo = await findUserCart(id);
            return res.status(400).json({ success: false, message: 'No default address set. Please select an address.', cart: cartForInfo });
        }

        // Get cart with populated items
        const cart = await findUserCart(id);
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart is empty' });
        }

        const {
            enrichedCarts,
            finalPriceWithoutDelivery,
            finalDeliveryCost
        } = await processCartItems(cart, id, address.coordinates.latitude, address.coordinates.longitude);

        const responseData = buildResponseData(cart, enrichedCarts, finalPriceWithoutDelivery, finalDeliveryCost);

        return res.json({
            success: true,
            address: address,
            data: responseData
        });

    } catch (error) {
        console.error('Cart retrieval error:', error);
        return handleErrorResponse(res, error);
    }
};

async function findUserCart(userId) {
    return await Cart.findOne({ user_id: userId })
        .populate({
            path: 'carts.restaurant_id',
            select: 'delivery_cost name'
        })
        .populate({
            path: 'carts.items.item_id',
            select: 'name description photo sizes toppings'
        })
        .lean();
}

async function processCartItems(cart, id, latitude, longitude) {
    let finalPriceWithoutDelivery = 0;
    let finalDeliveryCost = 0;
    let couponCode;

    if (cart.coupon_code_id) {
        couponCode = await CouponCode.findById(cart.coupon_code_id);
    }

    const orders = await Order.find({ user_id: id });

    // Process all cart entries in parallel
    const enrichedCarts = await Promise.all(cart.carts.map(async (cartEntry) => {
        let restaurantPrice = 0;

        // Calculate delivery cost (moved outside the map to avoid duplicate calculations)
        if (orders.length % 5 !== 0) {
            if (cart.carts.length === 1) {
                finalDeliveryCost = 15;
                const restaurant = await Restaurant.findById(cart.carts[0].restaurant_id);
                let distance = calculateDistance(
                    latitude,
                    longitude,
                    restaurant.coordinates.latitude,
                    restaurant.coordinates.longitude
                );
                console.log(distance)
                if (distance > 3) {
                    distance -= 3;
                    finalDeliveryCost += distance * 4;
                }
                finalDeliveryCost = Math.ceil(finalDeliveryCost)
            } else {
                finalDeliveryCost = 25;
                let maxDistance = 0;
                for (let i = 0; i < cart.carts.length; i++) {
                    const restaurant = await Restaurant.findById(cart.carts[i].restaurant_id);
                    let distance = calculateDistance(
                        latitude,
                        longitude,
                        restaurant.coordinates.latitude,
                        restaurant.coordinates.longitude
                    );
                    if (distance > maxDistance) {
                        maxDistance = distance;
                    }
                }
                if (maxDistance > 3) {
                    maxDistance -= 3;
                    finalDeliveryCost += maxDistance * 5;
                }
                finalDeliveryCost = Math.ceil(finalDeliveryCost)
            }
        } else {
            finalDeliveryCost = 0;
        }

        // Process items for this cart entry
        const processedItems = await Promise.all(cartEntry.items.map(async (item) => {
            return await processCartItem(item, (price) => {
                const discountedPrice = applyCouponDiscount(price, couponCode, cartEntry.restaurant_id._id);
                restaurantPrice += discountedPrice;
                finalPriceWithoutDelivery += discountedPrice;
            });
        }));

        return {
            restaurant_details: {
                _id: cartEntry.restaurant_id._id,
                name: cartEntry.restaurant_id.name,
            },
            items: processedItems,
            price_of_restaurant: restaurantPrice
        };
    }));

    return {
        enrichedCarts,
        finalPriceWithoutDelivery,
        finalDeliveryCost
    };
}

function applyCouponDiscount(price, couponCode, restaurantId) {
    if (!couponCode) return price;

    const isFullDiscount = couponCode.restaurant === "Full";
    const isRestaurantDiscount = couponCode.restaurant === restaurantId.toString();

    if (isFullDiscount || isRestaurantDiscount) {
        return price * (100 - couponCode.discount) / 100;
    }
    return price;
}

function processCartItem(item, priceAccumulator) {
    const { item_id, size, quantity, toppings, description } = item;
    const matchedSize = item_id.sizes.find(s => s._id.equals(size));
    let itemPrice = matchedSize ? matchedSize.price_after * quantity : 0;

    let toppingsPrice = 0;
    let matchedTopping = []
    if (toppings && toppings.length > 0) {
        toppings.forEach(toppingItem => {
            const matchedTopping1 = item_id.toppings.find(t => t._id.equals(toppingItem.topping));
            if (matchedTopping1) {
                matchedTopping.push({
                    _id: matchedTopping1._id,
                    topping: matchedTopping1.topping,
                    price: matchedTopping1.price,
                    quantity: toppingItem.topping_quantity,
                    price_of_quantity: matchedTopping1.price * (toppingItem.topping_quantity || 0)
                })
                toppingsPrice += matchedTopping1.price * (toppingItem.topping_quantity || 1);
            }
        });
        itemPrice += toppingsPrice;
    }

    if (matchedSize) {
        priceAccumulator(itemPrice);
    }

    return {
        item_details: {
            _id: item_id._id,
            name: item_id.name,
            description: item_id.description,
            photo: item_id.photo,
        },
        size_details: matchedSize ? {
            _id: matchedSize._id,
            name: matchedSize.size,
            price_before: matchedSize.price_before,
            price_after: matchedSize.price_after,
            quantity,
            price_of_quantity: matchedSize.price_after * quantity,
        } : {},
        topping_details: matchedTopping.length > 0 ? matchedTopping : [],
        description: description,
        total_price: itemPrice
    };
}

function buildResponseData(originalCart, enrichedCarts, finalPriceWithoutDelivery, finalDeliveryCost) {
    return {
        ...originalCart,
        carts: enrichedCarts,
        final_price_without_delivery_cost: finalPriceWithoutDelivery,
        final_delivery_cost: finalDeliveryCost,
        final_price: finalPriceWithoutDelivery + finalDeliveryCost
    };
}

function handleErrorResponse(res, error) {
    return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
}
module.exports.addCart = async (req, res) => {
    try {
        if (!req.decoded || !req.decoded.id) {
            return res.status(401).json({ success: false, message: "Unauthorized: Invalid or missing token" });
        }

        const userId = req.decoded.id;
        const body = req.body;

        const restaurant = await Restaurant.findById(body.restaurant_id);
        if (!restaurant) {
            return res.status(404).json({ success: false, message: "Restaurant not found" });
        }

        let cart = await Cart.findOne({ user_id: userId });

        // ✅ أول مرة يضيف
        if (!cart) {
            let newCart = new Cart({
                user_id: userId,
                carts: [
                    {
                        restaurant_id: body.restaurant_id,
                        items: [
                            {
                                item_id: body.item_id,
                                size: body.size,
                                quantity: 1,
                                toppings: body.toppings?.map(t => ({
                                    topping: t.topping,
                                    topping_quantity: 1
                                })) || [],
                                description: body.description || ""
                            }
                        ]
                    }
                ]
            });

            await newCart.save();
            return res.status(200).json({ success: true, message: "Added to cart" });
        }

        // ✅ لو فيه كارت بالفعل
        const itemExists = cart.carts.some(cartMap =>
            cartMap.restaurant_id.equals(body.restaurant_id) &&
            cartMap.items.some(itemsMap =>
                itemsMap.item_id.equals(body.item_id) &&
                itemsMap.size.equals(body.size) &&
                areToppingsEqual(itemsMap.toppings, body.toppings)
            )
        );

        if (itemExists) {
            return res.status(200).json({ success: false, message: "Already in cart" });
        }

        const hasRestaurant = cart.carts.some(c => c.restaurant_id.equals(body.restaurant_id));

        if (!hasRestaurant) {
            if (cart.carts.length >= 3) {
                return res.status(400).json({ success: false, message: "Only 3 restaurants allowed in cart" });
            }

            cart.carts.push({
                restaurant_id: body.restaurant_id,
                items: [
                    {
                        item_id: body.item_id,
                        size: body.size,
                        quantity: 1,
                        toppings: body.toppings?.map(t => ({
                            topping: t.topping,
                            topping_quantity: 1
                        })) || [],
                        description: body.description || ""
                    }
                ]
            });

            await cart.save();
            return res.status(200).json({ success: true, message: "Added to cart" });
        }

        // ✅ نفس المطعم
        const restaurantCart = cart.carts.find(c => c.restaurant_id.equals(body.restaurant_id));
        restaurantCart.items.push({
            item_id: body.item_id,
            size: body.size,
            quantity: 1,
            toppings: body.toppings?.map(t => ({
                topping: t.topping,
                topping_quantity: 1
            })) || [],
            description: body.description || ""
        });

        await cart.save();
        return res.status(200).json({ success: true, message: "Added to cart" });

    } catch (error) {
        // تحسين رسالة الخطأ
        if (error.name === 'ValidationError' && error.errors['carts.0.items.0.size']) {
            return res.status(400).json({ success: false, message: "Invalid format for 'size'. Please provide a valid size ID." });
        }

        console.error("Cart add error:", error.message);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};


function areToppingsEqual(toppings1, toppings2) {
    if (!toppings1 && !toppings2) return true;
    if (!toppings1 || !toppings2) return false;
    if (toppings1.length !== toppings2.length) return false;

    // Sort both arrays by topping ID for comparison
    const sorted1 = [...toppings1].sort((a, b) => a.topping.toString().localeCompare(b.topping.toString()));
    const sorted2 = [...toppings2].sort((a, b) => a.topping.toString().localeCompare(b.topping.toString()));

    return sorted1.every((topping, index) =>
        topping.topping.equals(sorted2[index].topping)
    );
}

module.exports.removeCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user_id: req.decoded.id })

        const body = req.body
        const itemExists = cart.carts.some(cartMap =>
            cartMap.restaurant_id.equals(body.restaurant_id) &&
            cartMap.items.some(itemsMap =>
                itemsMap.item_id.equals(body.item_id) &&
                itemsMap.size.equals(body.size)
            )
        );

        if (itemExists) {
            const restaurantCart = cart.carts.find(c =>
                c.restaurant_id.equals(body.restaurant_id)
            );
            const itemIndex = restaurantCart.items.findIndex(item =>
                item.item_id.equals(body.item_id)
            );
            if (itemIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: "Item not found in cart"
                });
            }

            restaurantCart.items.splice(itemIndex, 1);

            // Remove the restaurant cart if it's now empty
            if (restaurantCart.items.length === 0) {
                cart.carts.pull({ _id: restaurantCart._id });
            }

            await cart.save()

            return res.status(200).json({
                message: "Removed from cart"
            });
        } else {
            return res.status(200).json({
                message: "Item is not in cart"
            });
        }
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}

module.exports.increaseItemQuantity = async (req, res) => {
    try {
        const { id } = req.decoded;
        const { restaurant_id, item_id, size, topping } = req.body;

        const cart = await Cart.findOne({ user_id: id });

        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        // Find the restaurant in the cart
        const restaurantCart = cart.carts.find(c => c.restaurant_id.equals(restaurant_id));

        if (!restaurantCart) {
            return res.status(404).json({ success: false, message: 'Restaurant not found in cart' });
        }

        const itemToUpdate = restaurantCart.items.find(
            item => item.item_id.equals(item_id) &&
                item.size.equals(size)
        );

        if (!itemToUpdate) {
            return res.status(404).json({ success: false, message: 'Item not found in cart' });
        }

        if (topping) {
            // Find the specific topping in the item's toppings array
            const toppingToUpdate = itemToUpdate.toppings.find(
                t => t.topping.equals(topping)
            );

            if (!toppingToUpdate) {
                return res.status(404).json({
                    success: false,
                    message: 'Topping not found for this item'
                });
            }

            toppingToUpdate.topping_quantity += 1;
            await cart.save();

            return res.json({
                success: true,
                message: 'Topping quantity increased',
                data: {
                    item_id,
                    size,
                    topping,
                    new_topping_quantity: toppingToUpdate.topping_quantity,
                    item_quantity: itemToUpdate.quantity
                }
            });
        } else {
            itemToUpdate.quantity += 1;
            await cart.save();

            return res.json({
                success: true,
                message: 'Item quantity increased',
                data: {
                    item_id,
                    size,
                    new_quantity: itemToUpdate.quantity,
                    toppings: itemToUpdate.toppings
                }
            });
        }
    } catch (error) {
        console.error('Error increasing quantity:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
};

module.exports.decreaseItemQuantity = async (req, res) => {
    try {
        const { id } = req.decoded;
        const { restaurant_id, item_id, size, topping } = req.body;

        const cart = await Cart.findOne({ user_id: id });

        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        // Find the restaurant in the cart
        const restaurantCart = cart.carts.find(c => c.restaurant_id.equals(restaurant_id));

        if (!restaurantCart) {
            return res.status(404).json({ success: false, message: 'Restaurant not found in cart' });
        }

        // Find the item in the cart
        const itemToUpdate = restaurantCart.items.find(
            item => item.item_id.equals(item_id) && item.size.equals(size)
        );

        if (!itemToUpdate) {
            return res.status(404).json({ success: false, message: 'Item not found in cart' });
        }

        if (topping) {
            // Handle topping quantity decrease
            const toppingToUpdate = itemToUpdate.toppings.find(
                t => t.topping.equals(topping)
            );

            if (!toppingToUpdate) {
                return res.status(404).json({
                    success: false,
                    message: 'Topping not found for this item'
                });
            }

            toppingToUpdate.topping_quantity -= 1;

            if (toppingToUpdate.topping_quantity <= 0) {
                // Remove the topping from the array if quantity reaches 0
                itemToUpdate.toppings = itemToUpdate.toppings.filter(
                    t => !t.topping.equals(topping)
                );
            }

            await cart.save();

            return res.json({
                success: true,
                message: toppingToUpdate.topping_quantity > 0 ?
                    'Topping quantity decreased' : 'Topping removed',
                data: {
                    item_id,
                    size,
                    topping,
                    new_topping_quantity: toppingToUpdate.topping_quantity > 0 ?
                        toppingToUpdate.topping_quantity : 0,
                    topping_removed: toppingToUpdate.topping_quantity <= 0,
                    item_quantity: itemToUpdate.quantity
                }
            });

        } else {
            // Handle main item quantity decrease
            itemToUpdate.quantity -= 1;

            // Check if we should remove the entire item entry
            let itemRemoved = false;
            if (itemToUpdate.quantity <= 0) {
                const itemIndex = restaurantCart.items.findIndex(item =>
                    item.item_id.equals(item_id) && item.size.equals(size)
                );

                if (itemIndex !== -1) {
                    restaurantCart.items.splice(itemIndex, 1);
                    itemRemoved = true;

                    // Remove the restaurant cart if it's now empty
                    if (restaurantCart.items.length === 0) {
                        const restaurantIndex = cart.carts.findIndex(c =>
                            c.restaurant_id.equals(restaurant_id)
                        );
                        if (restaurantIndex !== -1) {
                            cart.carts.splice(restaurantIndex, 1);
                        }
                    }
                }
            }

            await cart.save();

            return res.json({
                success: true,
                message: itemRemoved ? 'Item removed from cart' : 'Item quantity decreased',
                data: {
                    item_id,
                    size,
                    new_quantity: itemToUpdate.quantity > 0 ? itemToUpdate.quantity : 0,
                    item_removed: itemRemoved,
                    toppings: itemToUpdate.toppings
                }
            });
        }

    } catch (error) {
        console.error('Error decreasing quantity:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
};