const Order = require("../models/Orders");
const CouponCode = require("../models/CouponCodes");
const Cart = require("../models/Carts");
const User = require("../models/Users");
const Address = require("../models/Address");
const Restaurant = require("../models/Restaurants");
const Item = require("../models/Items");
const { setTimeout } = require('timers/promises');
const Admin = require("../models/Admin");
const { sendNotification } = require("./global");

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

module.exports.getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find()
        return res.json({
            orders: orders
        });

    } catch (error) {
        console.error('Order retrieval error:', error);
        return handleErrorResponse(res, error);
    }
}

module.exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
        return res.json({
            order: order
        });

    } catch (error) {
        console.error('Order retrieval error:', error);
        return handleErrorResponse(res, error);
    }
}

module.exports.getOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user_id: req.body.decoded.id })
        return res.json({
            orders: orders
        });

    } catch (error) {
        console.error('Order retrieval error:', error);
        return handleErrorResponse(res, error);
    }
}

module.exports.createOrder = async (req, res) => {
    try {
        if (!req.body.address_id) {
            return res.status(400).json({
                message: "Address is required"
            });
        }

        const address = await Address.findById(req.body.address_id);
        if (!address) {
            return res.status(404).json({
                message: "Address not found"
            });
        }

        const cart = await getCart(req.body.decoded.id, address);

        let newItems = [];
        let delivery_type = "Agent";
        let restaurantIds = [];

        cart.carts.forEach(cartItems => {
            restaurantIds.push(cartItems.restaurant_details._id)

            newItems.push({
                restaurant_id: cartItems.restaurant_details._id,
                items: cartItems.items,
                price_of_restaurant: cartItems.price_of_restaurant,
                status: "New",
                cancel_me: false,
                created_at: new Date() // Add timestamp for tracking
            });
        });

        if (newItems.length === 1) {
            const restaurant = await Restaurant.findById(newItems[0].restaurant_id);
        }

        const ordersCount = await Order.countDocuments()

        const order = new Order({
            user_id: req.body.decoded.id,
            address: address,
            orders: newItems,
            final_price_without_delivery_cost: cart.final_price_without_delivery_cost,
            final_delivery_cost: cart.final_delivery_cost,
            final_price: cart.final_price,
            delivery_type: delivery_type,
            payment_type: req.body.payment_type,
            status: "New",
            order_id: ordersCount + 1
        });

        const savedOrder = await order.save();

        // Clear the cart
        await Cart.findOneAndDelete({ user_id: req.body.decoded.id });

        startOrderTimers(savedOrder);

        sendNotification(restaurantIds, req.body.decoded.id, `راجع طلباتك ربما يوجد جديد`)

        return res.status(200).json({
            success: true,
            message: "Order is successful"
        });

    } catch (error) {
        console.error('Order creation error:', error);
        return res.status(500).json({
            message: "Error creating order",
            error: error.message
        });
    }
};

function startOrderTimers(order) {
    order.orders.forEach((orderItem, index) => {
        if (orderItem.status === "New") {
            // Set timeout for 15 minutes (900000 milliseconds)
            setTimeout(600000).then(async () => {
                try {
                    const currentOrder = await Order.findById(order._id);
                    const admins = await Admin.find()

                    let adminsId = []

                    for (let i = 0; i < admins.length; i++) {
                        adminsId.push(admins[i]._id)
                    }

                    sendNotification(adminsId, currentOrder.user_id, `Order #${currentOrder._id.toString().slice(-4)} wait from 10 min`)
                } catch (error) {
                    console.error('Error in order timer:', error);
                }
            });
            setTimeout(1200000).then(async () => {
                try {
                    const currentOrder = await Order.findById(order._id);
                    if (currentOrder) {
                        await Order.findByIdAndUpdate(
                            order._id,
                            {
                                $set: {
                                    [`orders.${index}.status`]: "Canceled",
                                }
                            }
                        );

                        await Order.findByIdAndUpdate(
                            order._id,
                            {
                                $set: {
                                    status: "Canceled"
                                }
                            }
                        );

                    }
                } catch (error) {
                    console.error('Error in order timer:', error);
                }
            });
        }
    });
}

async function recreateOrder(user_id, payment_type, address_id) {
    try {
        let address;

        if (address_id) {
            address = await Address.findById(address_id)
        } else {
            return res.status(200).json({
                message: "Address is required"
            })
        }

        const cart = await getCart(user_id, address)

        let newItems = [];

        let delivery_type = "Agent"
        let delivery_id

        const items = cart.carts.map(cartItems => {
            newItems.push({
                restaurant_id: cartItems.restaurant_id._id,
                items: cartItems.items,
                price_of_restaurant: cartItems.price_of_restaurant,
                status: "New",
                cancel_me: false,
                created_at: new Date()
            })
        });

        if (newItems.length === 1) {
            const restaurant = await Restaurant.findById(newItems[0].restaurant_id)
        }

        let order = new Order({
            user_id: user_id,
            address: address,
            orders: newItems,
            final_price_without_delivery_cost: cart.final_price_without_delivery_cost,
            final_delivery_cost: cart.final_delivery_cost,
            final_price: cart.final_price,
            delivery_type: delivery_type,
            payment_type: payment_type,
            status: "New"
        })

        order.save().then(async (response) => {
            await Cart.findOneAndDelete({ user_id: user_id })
        })
    } catch (error) {
        console.error('Cart retrieval error:', error);
    }
};

module.exports.reorder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        // Use Promise.all to wait for all async operations to complete
        const list = await Promise.all(order.orders.map(async (orderAgain) => {
            let mapOrder = {
                restaurant_id: orderAgain.restaurant_id,
                items: []
            };

            // Process items sequentially with Promise.all
            await Promise.all(orderAgain.items.map(async (item) => {
                try {
                    const itemData = await Item.findById(item.item_details.item_id);
                    if (itemData) {
                        mapOrder.items.push({
                            item_id: item.item_details.item_id,
                            size: item.size_details.size_id,
                            quantity: item.size_details.quantity,
                            topping: item.topping_details.topping_id,
                            topping_quantity: item.topping_details.quantity,
                            description: item.description
                        });
                    }
                } catch (error) {
                    console.error('Error fetching item:', error);
                    // You might want to handle individual item errors differently
                }
            }));

            return mapOrder;
        }));

        const cart = await Cart.findOne({ user_id: req.body.decoded.id })

        if (cart) {
            if (cart.carts.length === 0) {
                await Cart.findByIdAndDelete(cart._id)
            } else {
                return res.status(200).json({
                    message: "Please clear your cart"
                });
            }
        }

        const newCart = Cart({
            user_id: req.body.decoded.id,
            carts: list
        })

        await newCart.save().then(async (newC) => {
            return res.status(200).json({
                message: "Done reorder"
            });
        })
    } catch (error) {
        console.error('Cart retrieval error:', error);
        return res.status(500).json({
            message: "Error retrieving cart"
        });
    }
};

async function getCart(id, address) {
    const cart = await findUserCart(id);

    const {
        enrichedCarts,
        finalPriceWithoutDelivery,
        finalDeliveryCost
    } = await processCartItems(cart, id, address.coordinates.latitude, address.coordinates.longitude);

    const responseData = buildResponseData(cart, enrichedCarts, finalPriceWithoutDelivery, finalDeliveryCost);

    return responseData
};

async function findUserCart(userId) {
    return await Cart.findOne({ user_id: userId })
        .populate({
            path: 'carts.restaurant_id',
            select: 'delivery_cost'
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

const applyCouponDiscount = (price, couponCode, restaurantId) => {
    if (!couponCode) return price;

    const isFullDiscount = couponCode.restaurant === "Full";
    const isRestaurantDiscount = couponCode.restaurant === restaurantId.toString();

    if (isFullDiscount || isRestaurantDiscount) {
        return price * (100 - couponCode.discount) / 100;
    }
    return price;
};

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
            item_id: item_id._id,
            name: item_id.name,
            description: item_id.description || "",
            photo: item_id.photo
        },
        size_details: matchedSize ? {
            ...matchedSize,
            size_id: matchedSize._id,
            quantity,
            price_Of_quantity: matchedSize.price_after * quantity
        } : {},
        topping_details: matchedTopping.length > 0 ? matchedTopping : [],
        description: description || "",
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

module.exports.updateAll = async (req, res) => {
    try {
        const orders = await Order.find();

        let x = 1000;
        for (const order of orders) {
            order.order_id = x
            await order.save(); // Save the changes
            x += 1
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