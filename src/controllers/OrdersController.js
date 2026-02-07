
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
        const {
            startDate, endDate, date,
            status, payment_type, order_type, delivery_type,
            user_id, agent_id, restaurant_id
        } = req.query;

        let query = {};

        // --- Date Filter ---
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
            };
        } else if (date) {
            query.createdAt = {
                $gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
                $lte: new Date(new Date(date).setHours(23, 59, 59, 999))
            };
        }

        // --- Status Filter ---
        // Supports single status like ?status=Delivered
        // or multiple query param like ?status=Delivered&status=Canceled (handled by Express as array) not standard usually, 
        // usually ?status=Delivered,Canceled is better if custom parsing, but let's stick to simple match or $in if array.
        if (status) {
            if (Array.isArray(status)) {
                query.status = { $in: status };
            } else if (status.includes(',')) {
                query.status = { $in: status.split(',') };
            } else {
                query.status = status;
            }
        }

        // --- ID Filters ---
        if (user_id) query.user_id = user_id;

        if (agent_id) query['agent.agent_id'] = agent_id;

        // Filter if the order contains a specific restaurant (searching inside sub-orders array)
        if (restaurant_id) {
            query['orders.restaurant_id'] = restaurant_id;
        }

        // --- Type Filters ---
        if (payment_type) query.payment_type = { $regex: new RegExp(`^${payment_type}$`, 'i') };
        if (order_type) query.order_type = order_type;
        if (delivery_type) query.delivery_type = delivery_type;

        // Execute Query
        const orders = await Order.find(query)
            .populate('user_id', 'first_name last_name phone')
            .populate('orders.restaurant_id', 'name logo phone')
            .populate('agent.agent_id', 'name phone')
            .sort({ createdAt: -1 });

        return res.json({
            count: orders.length,
            orders
        });
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
        const { address_id, payment_type, loyalty_code } = req.body;

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

        // --- Loyalty Code Validation ---
        let loyaltyDiscount = 0;
        let validatedReward = null;

        if (loyalty_code) {
            const { validateLoyaltyCode, calculateLoyaltyDiscount } = require("../utils/loyaltyHelpers");
            const validation = await validateLoyaltyCode(userId, loyalty_code);

            if (!validation.valid) {
                return res.status(400).json({ message: validation.message });
            }

            validatedReward = validation.reward;
            loyaltyDiscount = calculateLoyaltyDiscount(validatedReward, cart.final_price);
        }
        // --- End Loyalty Code Validation ---

        const orderType = cart.carts.length > 1 ? "Multi" : "Single";
        const restaurantIds = cart.carts.map(cartItem => cartItem.restaurant_details._id);

        // Fetch all restaurants to get their commission percentages
        const restaurants = await Restaurant.find({ _id: { $in: restaurantIds } })
            .select('_id commission_percentage name');

        const restaurantCommissionMap = {};
        restaurants.forEach(r => {
            restaurantCommissionMap[r._id.toString()] = r.commission_percentage || 0;
        });

        // Calculate commission for each sub-order and Assign Nearest Branch
        let totalCommission = 0;
        let totalRestaurantNet = 0;

        // Helper to find nearest branch
        const findNearestBranch = async (parentId, userCoords) => {
            try {
                // Find all active branches for this parent
                const branches = await Restaurant.find({
                    parent_restaurant_id: parentId,
                    status: "Active",
                    is_show: true,
                    // is_open: true // Optional: Enforce open status strictly?
                }).select('_id coordinates open_hour close_hour is_open');

                if (branches.length === 0) return null;

                let nearestBranch = null;
                let minDistance = Infinity;

                for (const branch of branches) {
                    if (branch.coordinates && branch.coordinates.latitude && branch.coordinates.longitude) {
                        const distance = calculateDistance(
                            userCoords.latitude,
                            userCoords.longitude,
                            branch.coordinates.latitude,
                            branch.coordinates.longitude
                        );
                        if (distance < minDistance) {
                            minDistance = distance;
                            nearestBranch = branch;
                        }
                    }
                }
                return nearestBranch ? nearestBranch._id : null;
            } catch (err) {
                console.error("Error finding nearest branch:", err);
                return null;
            }
        };

        // Use Promise.all since we have async calls inside loop
        const newSubOrders = await Promise.all(cart.carts.map(async (cartItem) => {
            const restaurantId = cartItem.restaurant_details._id.toString();
            const commissionPercentage = restaurantCommissionMap[restaurantId] || 0;
            const priceOfRestaurant = cartItem.price_of_restaurant || 0;

            // Calculate commission amount
            const commissionAmount = (priceOfRestaurant * commissionPercentage) / 100;
            const restaurantNetAmount = priceOfRestaurant - commissionAmount;

            totalCommission += commissionAmount;
            totalRestaurantNet += restaurantNetAmount;

            // Find nearest branch
            let branchId = null;
            if (address && address.coordinates) {
                branchId = await findNearestBranch(cartItem.restaurant_details._id, address.coordinates);
            }

            return {
                restaurant_id: cartItem.restaurant_details._id,
                branch_id: branchId, // Assign nearest branch if found
                items: cartItem.items,
                price_of_restaurant: priceOfRestaurant,
                commission_percentage: commissionPercentage,
                commission_amount: Math.round(commissionAmount * 100) / 100, // Round to 2 decimals
                restaurant_net_amount: Math.round(restaurantNetAmount * 100) / 100,
                status: "Waiting for Approval",
                cancel_me: false,
            };
        }));

        const orderId = await getNextSequenceValue('order_id');

        // Calculate final price with loyalty discount
        const finalPriceAfterLoyalty = Math.max(0, cart.final_price - loyaltyDiscount);

        const order = new Order({
            user_id: userId,
            order_type: orderType,
            address: address,
            orders: newSubOrders,
            final_price_without_delivery_cost: cart.final_price_without_delivery_cost,
            final_delivery_cost: cart.final_delivery_cost,
            final_price: finalPriceAfterLoyalty,
            total_commission_amount: Math.round(totalCommission * 100) / 100,
            total_restaurant_net: Math.round(totalRestaurantNet * 100) / 100,
            delivery_type: "Agent", // Defaulting to Agent delivery
            payment_type: payment_type,
            status: "Waiting for Approval",
            order_id: orderId,
            // Store loyalty discount info if applied
            ...(loyaltyDiscount > 0 && {
                loyalty_discount: {
                    code: loyalty_code,
                    discount_amount: loyaltyDiscount,
                    discount_value: validatedReward.discountValue,
                    discount_type: validatedReward.discountType
                }
            })
        });

        const savedOrder = await order.save();

        // --- Mark Loyalty Code as Used ---
        if (loyalty_code && validatedReward) {
            try {
                const { markCodeAsUsed } = require("../utils/loyaltyHelpers");
                await markCodeAsUsed(userId, loyalty_code, savedOrder._id);
            } catch (loyaltyErr) {
                console.error("Failed to mark loyalty code as used:", loyaltyErr);
            }
        }
        // --- End Mark Loyalty Code ---

        // Update restaurant statistics with commission (optional - for future reporting)
        // This can be done in a background job for better performance
        for (const subOrder of newSubOrders) {
            await Restaurant.findByIdAndUpdate(subOrder.restaurant_id, {
                $inc: {
                    'statistics.total_orders': 1,
                    'statistics.total_revenue': subOrder.price_of_restaurant
                }
            });
        }

        // Clear the user's cart after successful order creation
        const userCart = await Cart.findOne({ user_id: userId });
        const appliedCouponId = userCart?.coupon_code_id;
        await Cart.findOneAndDelete({ user_id: userId });

        // --- Mark Coupon Code as Used ---
        if (appliedCouponId) {
            try {
                const CouponCode = require("../models/CouponCodes");
                await CouponCode.findByIdAndUpdate(appliedCouponId, {
                    $push: { users_used: userId }
                });
                console.log(`Coupon ${appliedCouponId} marked as used by user ${userId}`);
            } catch (couponErr) {
                console.error("Failed to mark coupon as used:", couponErr);
                // Don't fail the order if coupon update fails
            }
        }
        // --- End Mark Coupon Code ---

        // Notify all involved restaurants
        // Assuming sendNotification can take an array of restaurant_ids and also the user_id for context
        sendNotification(restaurantIds, userId, `You have a new order #${savedOrder.order_id}. Please check your dashboard.`);

        // Removed the call to startOrderTimers(savedOrder); as cron job handles it.

        return res.status(201).json({
            success: true,
            message: "Order placed successfully!",
            order: savedOrder,
            loyaltyDiscount: loyaltyDiscount > 0 ? {
                code: loyalty_code,
                amount: loyaltyDiscount
            } : null
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

/**
 * GET /orders/commission-stats
 * Get commission statistics for admin dashboard
 * Query params:
 *   - restaurant_id (optional): Filter by specific restaurant
 *   - start_date (optional): Start date for date range
 *   - end_date (optional): End date for date range
 */
module.exports.getCommissionStats = async (req, res) => {
    try {
        if (!req.decoded) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // Only admin can access commission stats
        if (req.decoded.user_type !== "Admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        const { restaurant_id, start_date, end_date } = req.query;

        // Build match conditions
        const matchConditions = {
            status: { $in: ["Delivered", "Completed"] }
        };

        if (start_date || end_date) {
            matchConditions.createdAt = {};
            if (start_date) matchConditions.createdAt.$gte = new Date(start_date);
            if (end_date) matchConditions.createdAt.$lte = new Date(end_date);
        }

        // Aggregation pipeline for commission statistics
        const pipeline = [
            { $match: matchConditions },
            { $unwind: "$orders" },
        ];

        // Filter by restaurant if specified
        if (restaurant_id) {
            const mongoose = require('mongoose');
            pipeline.push({
                $match: { "orders.restaurant_id": new mongoose.Types.ObjectId(restaurant_id) }
            });
        }

        // Group by restaurant
        pipeline.push({
            $group: {
                _id: "$orders.restaurant_id",
                total_orders: { $sum: 1 },
                total_sales: { $sum: "$orders.price_of_restaurant" },
                total_commission: { $sum: "$orders.commission_amount" },
                total_restaurant_net: { $sum: "$orders.restaurant_net_amount" },
                avg_commission_percentage: { $avg: "$orders.commission_percentage" }
            }
        });

        // Lookup restaurant details
        pipeline.push({
            $lookup: {
                from: "restaurants",
                localField: "_id",
                foreignField: "_id",
                as: "restaurant"
            }
        });

        pipeline.push({ $unwind: "$restaurant" });

        // Project final shape
        pipeline.push({
            $project: {
                restaurant_id: "$_id",
                restaurant_name: "$restaurant.name",
                restaurant_logo: "$restaurant.logo",
                commission_percentage: "$restaurant.commission_percentage",
                total_orders: 1,
                total_sales: { $round: ["$total_sales", 2] },
                total_commission: { $round: ["$total_commission", 2] },
                total_restaurant_net: { $round: ["$total_restaurant_net", 2] },
                avg_commission_percentage: { $round: ["$avg_commission_percentage", 1] }
            }
        });

        // Sort by total commission descending
        pipeline.push({ $sort: { total_commission: -1 } });

        const stats = await Order.aggregate(pipeline);

        // Calculate totals
        const totals = stats.reduce((acc, stat) => {
            acc.total_sales += stat.total_sales || 0;
            acc.total_commission += stat.total_commission || 0;
            acc.total_restaurant_net += stat.total_restaurant_net || 0;
            acc.total_orders += stat.total_orders || 0;
            return acc;
        }, { total_sales: 0, total_commission: 0, total_restaurant_net: 0, total_orders: 0 });

        return res.status(200).json({
            success: true,
            summary: {
                total_orders: totals.total_orders,
                total_sales: Math.round(totals.total_sales * 100) / 100,
                total_commission: Math.round(totals.total_commission * 100) / 100,
                total_restaurant_net: Math.round(totals.total_restaurant_net * 100) / 100,
                platform_revenue: Math.round(totals.total_commission * 100) / 100 // Commission is platform revenue
            },
            restaurants: stats
        });

    } catch (error) {
        console.error("getCommissionStats error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};
