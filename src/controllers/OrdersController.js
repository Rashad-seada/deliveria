
const Order = require("../models/Orders");
const CouponCode = require("../models/CouponCodes");
const Cart = require("../models/Carts");
const User = require("../models/Users");
const Address = require("../models/Address");
const Restaurant = require("../models/Restaurants");
const Item = require("../models/Items");
const Counter = require("../models/Counter");
const { setTimeout } = require('timers/promises');
const Admin = require("../models/Admin");
const { sendNotification } = require("./global");
const { calculateDistance, calculateDeliveryFee, calculateMaxDistanceToRestaurants } = require("../utils/deliveryHelpers");

async function getNextSequenceValue(sequenceName) {
    const sequenceDocument = await Counter.findByIdAndUpdate(
        sequenceName,
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return sequenceDocument.seq;
}



const handleErrorResponse = (res, error, message = "An error occurred.", statusCode = 500) => {
    console.error(message, error);
    return res.status(statusCode).json({ message, error: error.message });
};

module.exports.getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find().populate('user_id', 'first_name last_name').sort({ createdAt: -1 });
        return res.json({ orders });
    } catch (error) {
        return handleErrorResponse(res, error, "Error retrieving all orders.");
    }
};

module.exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('user_id', 'first_name last_name').populate('orders.restaurant_id', 'name logo');
        if (!order) {
            return res.status(404).json({ message: "Order not found." });
        }
        return res.json({ order });
    } catch (error) {
        return handleErrorResponse(res, error, "Error retrieving order by ID.");
    }
};

module.exports.getOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user_id: req.decoded.id }).sort({ createdAt: -1 });
        return res.json({ orders });
    } catch (error) {
        return handleErrorResponse(res, error, "Error retrieving your orders.");
    }
};

module.exports.createOrder = async (req, res) => {
    try {
        const userId = req.decoded.id;
        const { address_id, payment_type } = req.body;

        if (!address_id) {
            return res.status(400).json({ message: "Address is required." });
        }

        const address = await Address.findById(address_id);
        if (!address) {
            return res.status(404).json({ message: "Address not found." });
        }

        const cart = await getCart(userId, address);
        if (!cart || cart.carts.length === 0) {
            return res.status(400).json({ message: "Your cart is empty." });
        }

        const orderType = cart.carts.length > 1 ? "Multi" : "Single";
        const restaurantIds = cart.carts.map(cartItem => cartItem.restaurant_details._id);

        const newSubOrders = cart.carts.map(cartItem => ({
            restaurant_id: cartItem.restaurant_details._id,
            items: cartItem.items,
            price_of_restaurant: cartItem.price_of_restaurant,
            status: "Pending Approval",
            cancel_me: false,
            // Removed manual created_at, relying on Mongoose timestamps
        }));

        const orderId = await getNextSequenceValue('order_id');

        const order = new Order({
            user_id: userId,
            order_type: orderType,
            address: address,
            orders: newSubOrders,
            final_price_without_delivery_cost: cart.final_price_without_delivery_cost,
            final_delivery_cost: cart.final_delivery_cost,
            final_price: cart.final_price,
            delivery_type: "Agent", // Defaulting to Agent delivery
            payment_type: payment_type,
            status: "Pending Approval",
            order_id: orderId
        });

        const savedOrder = await order.save();

        // Clear the user's cart after successful order creation
        await Cart.findOneAndDelete({ user_id: userId });

        // Notify all involved restaurants
        // Assuming sendNotification can take an array of restaurant_ids and also the user_id for context
        sendNotification(restaurantIds, userId, `You have a new order #${savedOrder.order_id}. Please check your dashboard.`);

        // Removed the call to startOrderTimers(savedOrder); as cron job handles it.

        return res.status(201).json({
            success: true,
            message: "Order placed successfully!",
            order: savedOrder
        });

    } catch (error) {
        return handleErrorResponse(res, error, "Error creating order.");
    }
};

// ... (keep the rest of the file as is, since it's mostly cart logic)

async function getCart(id, address) {
    const cart = await findUserCart(id);
    if (!cart) return null;
    
    const { enrichedCarts, finalPriceWithoutDelivery } = await processCartItems(cart);
    const finalDeliveryCost = await calculateDeliveryCost(id, cart, address);

    return buildResponseData(cart, enrichedCarts, finalPriceWithoutDelivery, finalDeliveryCost);
}

async function findUserCart(userId) {
    return await Cart.findOne({ user_id: userId })
        .populate('carts.items.item_id', 'name description photo sizes toppings')
        .lean();
}

async function calculateDeliveryCost(userId, cart, address) {
    const restaurantIds = [...new Set(cart.carts.map(c => c.restaurant_id.toString()))];
    const restaurants = await Restaurant.find({ '_id': { $in: restaurantIds } }).select('coordinates');
    
    if (restaurants.length === 0) return 0;
    
    // استخدام الدالة المشتركة لحساب أقصى مسافة
    const maxDistance = calculateMaxDistanceToRestaurants(
        restaurants,
        address.coordinates
    );
    
    const orderType = restaurants.length > 1 ? "Multi" : "Single";
    const deliveryFee = calculateDeliveryFee(maxDistance, orderType);
    
    return Math.ceil(deliveryFee);
}

async function processCartItems(cart) {
    let finalPriceWithoutDelivery = 0;
    let couponCode = null;

    if (cart.coupon_code_id) {
        couponCode = await CouponCode.findById(cart.coupon_code_id);
    }

    const enrichedCarts = await Promise.all(cart.carts.map(async (cartEntry) => {
        let restaurantPrice = 0;

        const processedItems = await Promise.all(cartEntry.items.map(async (item) => {
            return processCartItem(item, (price) => {
                const discountedPrice = applyCouponDiscount(price, couponCode, cartEntry.restaurant_id);
                restaurantPrice += discountedPrice;
                finalPriceWithoutDelivery += discountedPrice;
            });
        }));

        const restaurantDetails = await Restaurant.findById(cartEntry.restaurant_id).select('name').lean();

        return {
            restaurant_details: {
                _id: cartEntry.restaurant_id,
                name: restaurantDetails ? restaurantDetails.name : 'N/A',
            },
            items: processedItems,
            price_of_restaurant: restaurantPrice
        };
    }));

    return { enrichedCarts, finalPriceWithoutDelivery };
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

    // If the item was deleted from the DB, `populate` will make item_id null.
    if (!item_id) {
        return {
            item_details: { name: "Item unavailable", description: "This item has been removed." },
            size_details: {},
            topping_details: [],
            description: "Item no longer available",
            total_price: 0,
            unavailable: true
        };
    }

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

module.exports.reorder = async (req, res) => {
    try {
        const userId = req.decoded.id;
        const { id: orderId } = req.params; // Assuming the order ID is passed in params

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found." });
        }

        // Clear existing cart for the user
        await Cart.findOneAndDelete({ user_id: userId });

        const newCartItems = [];
        for (const subOrder of order.orders) {
            const restaurantCart = {
                restaurant_id: subOrder.restaurant_id,
                items: []
            };
            for (const item of subOrder.items) {
                // Ensure item exists in DB
                const itemData = await Item.findById(item.item_details.item_id);
                if (itemData) {
                    const toppings = item.topping_details.map(topping => ({
                        topping: topping.topping_id,
                        topping_quantity: topping.quantity
                    }));

                    restaurantCart.items.push({
                        item_id: item.item_details.item_id,
                        size: item.size_details.size_id,
                        quantity: item.size_details.quantity,
                        toppings: toppings, // Corrected assignment
                        description: item.description
                    });
                }
            }
            if (restaurantCart.items.length > 0) {
                newCartItems.push(restaurantCart);
            }
        }

        if (newCartItems.length === 0) {
            return res.status(400).json({ message: "No valid items to reorder." });
        }

        const newCart = new Cart({
            user_id: userId,
            carts: newCartItems
        });

        await newCart.save();

        return res.status(200).json({
            message: "Order reordered successfully into your cart!",
            cart: newCart
        });

    } catch (error) {
        console.error('Error reordering:', error);
        return handleErrorResponse(res, error, "Error reordering cart.");
    }
};

