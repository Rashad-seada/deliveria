
const Order = require("../models/Orders");
const Agent = require("../models/Agents");
const User = require("../models/Users");
const Restaurant = require("../models/Restaurants");
const Admin = require("../models/Admin");
const { sendNotification } = require("./global");
const { setTimeout } = require('timers/promises');
const { calculateDistance, calculateEstimatedTime, calculateDeliveryFee, calculateMaxDistanceToRestaurants } = require("../utils/deliveryHelpers");

// ####################################################################################################################
// #################################################### Helper Functions ################################################
// ####################################################################################################################
// Note: Delivery calculation functions moved to src/utils/deliveryHelpers.js for reusability

module.exports.startOrderTimers = (order) => {
    setTimeout(1500000).then(async () => { // 25 minutes
        try {
            const currentOrder = await Order.findById(order._id);
            // This timer checks if an order is waiting for an agent for too long.
            // It should only trigger if the order is still "Ready for Delivery".
            if (currentOrder && currentOrder.status === "Ready for Delivery") {
                const admins = await Admin.find().select('_id');
                const adminIds = admins.map(admin => admin._id);
                sendNotification(adminIds, currentOrder.user_id, `Order #${order._id.toString().slice(-4)} has been waiting for an agent for 25 minutes.`);
            }
        } catch (error) {
            console.error('Error in order timer:', error);
        }
    });
}


// ####################################################################################################################
// #################################################### Agent-facing Functions ##########################################
// ####################################################################################################################

// Get all orders that are ready for pickup and not yet assigned to any agent
module.exports.getAvailableOrders = async (req, res) => {
    try {
        const { date, startDate, endDate, payment_type, order_type } = req.query;

        let query = {
            delivery_type: "Agent",
            "agent.agent_id": null, // Correctly check if an agent is assigned
            status: "Ready for Delivery" // Only show orders that are ready for delivery
        };

        // --- Filter: Date Range ---
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
            };
        } else if (date) {
            // Specific single date
            query.createdAt = {
                $gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
                $lte: new Date(new Date(date).setHours(23, 59, 59, 999))
            };
        }

        // --- Filter: Payment Type ---
        if (payment_type) {
            query.payment_type = { $regex: new RegExp(`^${payment_type}$`, 'i') }; // Case-insensitive exact match
        }

        // --- Filter: Order Type ---
        if (order_type) {
            // "Single" or "Multi"
            query.order_type = order_type;
        }

        const orders = await Order.find(query).populate({
            path: 'user_id',
            select: 'first_name last_name'
        }).populate({
            path: 'orders.restaurant_id',
            select: 'logo name phone'
        }).sort({ createdAt: -1 }); // Newest first

        if (!orders || orders.length === 0) {
            return res.status(200).json({ message: "There are no available orders at the moment.", orders: [] });
        }

        return res.status(200).json({ orders });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error fetching available orders." });
    }
};

// Get all orders assigned to the currently logged-in agent
module.exports.getMyOrders = async (req, res) => {
    try {
        const { date, startDate, endDate, status, payment_type } = req.query;

        let query = {
            "agent.agent_id": req.decoded.id, // Correctly find orders by agent ID
            status: { $nin: ["Canceled", "Completed"] } // Default: Show active + delivered (but usually we might want to separate)
        };

        // If status is specifically requested (e.g. ?status=Delivered or ?status=active)
        if (status) {
            if (status === 'active') {
                query.status = { $in: ["Accepted", "On the way", "Pick up"] };
            } else if (status === 'history') {
                query.status = { $in: ["Delivered", "Completed", "Canceled"] };
            } else {
                query.status = status;
            }
        }

        // --- Filter: Date Range ---
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

        // --- Filter: Payment Type ---
        if (payment_type) {
            query.payment_type = { $regex: new RegExp(`^${payment_type}$`, 'i') };
        }

        const orders = await Order.find(query).populate({
            path: 'user_id',
            select: 'first_name last_name'
        }).populate({
            path: 'orders.restaurant_id',
            select: 'logo name phone'
        }).sort({ createdAt: -1 });

        return res.status(200).json({ orders });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error fetching your orders." });
    }
};

// Agent accepts an order
module.exports.acceptOrder = async (req, res) => {
    try {
        const agentId = req.decoded.id;
        const orderId = req.params.id;

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: "Order not found." });
        }

        // Fetch active orders for this agent to validate limits
        const ongoingOrdersList = await Order.find({
            "agent.agent_id": agentId,
            status: { $nin: ["Completed", "Canceled", "Delivered"] }
        }).select('order_type');

        const currentSingle = ongoingOrdersList.filter(o => o.order_type === 'Single').length;
        const currentMulti = ongoingOrdersList.filter(o => o.order_type === 'Multi').length;
        const incomingType = order.order_type || (order.orders.length > 1 ? 'Multi' : 'Single'); // Fallback if type missing

        let allowed = false;

        // Rules:
        // 1. Single Orders: Max 3
        // 2. Multi Orders: Max 2
        // 3. Mixed Orders: Max 2 Single + 1 Multi

        if (incomingType === 'Single') {
            // Incoming is Single
            if (currentMulti === 0 && currentSingle < 3) allowed = true;      // 0M, <3S -> OK
            else if (currentMulti === 1 && currentSingle < 2) allowed = true; // 1M, <2S -> OK (Mixed limit)
        } else {
            // Incoming is Multi
            if (currentMulti === 0 && currentSingle <= 2) allowed = true;     // 0M, <=2S -> OK (Mixed limit allows 1M+2S)
            else if (currentMulti === 1 && currentSingle === 0) allowed = true; // 1M, 0S -> OK (Max 2 Multi)
        }

        if (!allowed) {
            return res.status(400).json({
                message: `Order limit reached. Current: ${currentSingle} Single, ${currentMulti} Multi. Rules: Max 3 Single, Max 2 Multi, or Mixed (2 Single + 1 Multi).`
            });
        }

        if (order.agent && order.agent.agent_id) {
            return res.status(400).json({ message: "This order has already been accepted by another agent." });
        }

        if (order.status !== "Ready for Delivery") {
            return res.status(400).json({ message: "This order is no longer available for acceptance." });
        }

        // The agent is accepting the order. The status should become "Accepted".
        // The restaurant will later change it to "Ready for pickup".
        const newStatus = "Accepted";

        const agent = await Agent.findById(agentId);
        if (!agent) {
            return res.status(404).json({ message: "Agent profile not found." });
        }

        // حساب المسافة من المطاعم إلى العميل (وليس من الدليفري إلى العميل)
        const restaurantIds = order.orders.map(o => o.restaurant_id);
        const restaurants = await Restaurant.find({ '_id': { $in: restaurantIds } }).select('coordinates');

        if (restaurants.length === 0) {
            return res.status(400).json({ message: "No restaurants found for this order." });
        }

        // حساب أقصى مسافة من المطاعم إلى عنوان العميل
        const maxDistance = calculateMaxDistanceToRestaurants(
            restaurants,
            order.address.coordinates
        );

        // استخدام final_delivery_cost الموجود بالفعل في الطلب
        // إذا لم يكن موجوداً، احسبه بناءً على المسافة من المطاعم
        const deliveryFee = order.final_delivery_cost || calculateDeliveryFee(maxDistance, order.order_type);

        const deliveryDetails = {
            distance: maxDistance,
            estimated_time: calculateEstimatedTime(maxDistance),
            delivery_fee: deliveryFee
        };

        const updatedOrder = await Order.findByIdAndUpdate(orderId, {
            $set: {
                agent: { agent_id: agentId, assigned_at: new Date() },
                status: newStatus, // "Accepted"
                delivery_details: deliveryDetails
            }
        }, { new: true, populate: ['user_id', 'orders.restaurant_id'] });

        sendNotification([updatedOrder.user_id], agentId, `Your order #${orderId.slice(-4)} has been accepted by a delivery agent.`);


        return res.status(200).json({
            message: "Order accepted successfully.",
            order: updatedOrder
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error accepting order." });
    }
};

// Agent updates the status of an order
module.exports.updateOrderStatus = async (req, res) => {
    try {
        const agentId = req.decoded.id;
        const orderId = req.params.id;
        let { status } = req.body; // New status from request body

        // Standardize status
        if (status === "DELIVERED") {
            status = "Delivered";
        }

        const validStatuses = ["On the way", "Delivered", "Completed"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid status update." });
        }

        const order = await Order.findOne({ _id: orderId, "agent.agent_id": agentId })
            .populate('user_id', 'fcm_token')
            .populate('orders.restaurant_id', 'fcm_token');

        if (!order) {
            return res.status(404).json({ message: "You are not assigned to this order." });
        }

        // --- منطق التحقق من تسلسل الحالات ---
        const allowedTransitions = {
            "Accepted": ["On the way"], // Agent has picked up the order and is heading to the customer.
            "On the way": ["Delivered"],
            "Delivered": ["Completed"]
        };

        const currentStatus = order.status;
        if (!allowedTransitions[currentStatus] || !allowedTransitions[currentStatus].includes(status)) {
            return res.status(400).json({
                message: `Cannot change status from "${currentStatus}" to "${status}".`
            });
        }
        // --- نهاية منطق التحقق ---

        // Update the main order status
        order.status = status;

        // إضافة سجل زمني للحالة الجديدة
        order.status_timeline.push({ status: status, timestamp: new Date(), note: `Updated by agent` });

        // Update the status of all sub-orders
        order.orders.forEach(subOrder => {
            if (subOrder.status !== "Canceled") {
                subOrder.status = status;
            }
        });

        // تحديث أوقات الاستلام والتوصيل
        if (status === "Pick up") order.agent.pickup_time = new Date();
        if (status === "Delivered") order.agent.delivery_time = new Date();

        // --- التحسين: توحيد حالة الطلب الرئيسية ---
        if (status === "Delivered") {
            order.order_status = "Delivered";

            // --- New Loyalty Points System ---
            try {
                const { awardLoyaltyPoints } = require("../utils/loyaltyHelpers");
                const loyaltyResult = await awardLoyaltyPoints(order);

                if (loyaltyResult.success && loyaltyResult.pointsEarned > 0) {
                    console.log(`Loyalty: User earned ${loyaltyResult.pointsEarned} points. New rewards: ${loyaltyResult.newRewards?.length || 0}`);
                }
            } catch (loyaltyError) {
                console.error("Loyalty points error:", loyaltyError);
                // Don't fail the order status update if loyalty fails
            }
            // --- End Loyalty Points System ---
        } else if (status === "On the way") {
            order.order_status = "On the way";
        }


        await order.save();

        // إرسال إشعار للمستخدم
        if (order.user_id) {
            sendNotification([order.user_id._id], agentId, `The status of your order #${orderId.slice(-4)} has been updated to: ${status}`);
        }

        return res.status(200).json({
            message: `Order status updated to ${status}.`,
            order
        });

    } catch (error) {
        console.log("Error in updateOrderStatus:", error);
        return res.status(500).json({ message: "Error updating order status.", error: error.message, stack: error.stack });
    }
};

// Update agent's current location
exports.updateAgentLocation = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        const agentId = req.decoded?.id;
        if (!agentId) return res.status(401).json({ message: "Unauthorized" });

        const agent = await Agent.findById(agentId);
        if (!agent) return res.status(404).json({ message: "Agent not found" });

        agent.current_location = {
            type: 'Point',
            coordinates: [longitude, latitude]
        };
        await agent.save();

        // If agent has an active order, update delivery details
        const activeOrder = await Order.findOne({ "agent.agent_id": agentId, status: { $in: ["Accepted", "Pick up", "On the way"] } });

        // --- التحسين: التحقق من الموقع الحقيقي قبل إعادة الحساب ---
        const isRealLocation = latitude !== 0 || longitude !== 0;

        if (activeOrder && isRealLocation) {
            // حساب المسافة من موقع الدليفري الحالي إلى عنوان العميل
            // هذه المسافة للعرض فقط (لإظهار المسافة المتبقية) وليست لحساب التكلفة
            const currentDistanceToCustomer = calculateDistance(
                latitude, longitude,
                activeOrder.address.coordinates.latitude,
                activeOrder.address.coordinates.longitude
            );

            // تحديث المسافة والوقت المقدر بناءً على الموقع الحالي للدليفري
            // ملاحظة: delivery_fee لا يتم تغييرها لأنها محسوبة من المطعم وليس من موقع الدليفري
            activeOrder.delivery_details.distance = currentDistanceToCustomer;
            activeOrder.delivery_details.estimated_time = calculateEstimatedTime(currentDistanceToCustomer);

            // delivery_fee يجب أن تبقى ثابتة كما تم حسابها عند قبول الطلب

            await activeOrder.save();
        }

        return res.json({ success: true, location: agent.current_location });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: error.message });
    }
};
