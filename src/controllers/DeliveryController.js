
const Order = require("../models/Orders");
const Agent = require("../models/Agents");
const User = require("../models/Users");
const Restaurant = require("../models/Restaurants");
const Admin = require("../models/Admin");
const { sendNotification } = require("./global");
const { setTimeout } = require('timers/promises');

// ####################################################################################################################
// #################################################### Helper Functions ################################################
// ####################################################################################################################

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const calculateEstimatedTime = (distance) => Math.ceil((distance / 30) * 60); // Assuming average speed of 30 km/h
const calculateDeliveryFee = (distance, orderType) => {
    const baseDistance = 3; // 3 كم
    if (orderType === "Single") {
        const baseFee = 15; // 15 جنيه
        const extraKmCharge = 4; // 4 جنيه لكل كم إضافي
        if (distance <= baseDistance) return baseFee;
        return baseFee + Math.ceil(distance - baseDistance) * extraKmCharge;
    } else { // Multi
        const baseFee = 25; // 25 جنيه
        const extraKmCharge = 5; // 5 جنيه لكل كم إضافي
        if (distance <= baseDistance) return baseFee;
        return baseFee + Math.ceil(distance - baseDistance) * extraKmCharge;
    }
};

function startOrderTimers(order) {
    setTimeout(1500000).then(async () => { // 25 minutes
        try {
            const currentOrder = await Order.findById(order._id);
            if (currentOrder && !["Canceled", "Completed", "Delivered"].includes(currentOrder.status)) {
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
        const orders = await Order.find({
            delivery_type: "Agent",
            "agent.agent_id": null, // Correctly check if an agent is assigned
            status: { $in: ["Pending Approval", "Preparing", "Ready for Delivery"] }
        }).populate({
            path: 'user_id',
            select: 'first_name last_name'
        }).populate({
            path: 'orders.restaurant_id',
            select: 'logo name phone'
        });

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
        const orders = await Order.find({
            "agent.agent_id": req.decoded.id, // Correctly find orders by agent ID
            status: { $nin: ["Canceled", "Completed"] } // إظهار الطلبات التي تم تسليمها أيضاً
        }).populate({
            path: 'user_id',
            select: 'first_name last_name'
        }).populate({
            path: 'orders.restaurant_id',
            select: 'logo name phone'
        });
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

        const ongoingOrders = await Order.countDocuments({
            "agent.agent_id": agentId,
            status: { $nin: ["Completed", "Canceled", "Delivered"] }
        });

        if (ongoingOrders >= 3) {
            return res.status(400).json({ message: "You can only have a maximum of 3 ongoing orders." });
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: "Order not found." });
        }

        if (order.agent && order.agent.agent_id) {
            return res.status(400).json({ message: "This order has already been accepted by another agent." });
        }

        if (!["Pending Approval", "Preparing", "Ready for Delivery"].includes(order.status)) {
            return res.status(400).json({ message: "This order is no longer available for acceptance." });
        }

        // The agent is accepting the order. The status should become "Accepted".
        // The restaurant will later change it to "Ready for pickup".
        const newStatus = "Accepted";
        
        const agent = await Agent.findById(agentId);
        if (!agent) {
            return res.status(404).json({ message: "Agent profile not found." });
        }

        // حساب المسافة والوقت المقدر فور قبول الطلب
        const distance = calculateDistance(
            agent.current_location.coordinates[1], // agent latitude
            agent.current_location.coordinates[0], // agent longitude
            order.address.coordinates.latitude,
            order.address.coordinates.longitude
        );

        const deliveryDetails = {
            distance: distance,
            estimated_time: calculateEstimatedTime(distance),
            delivery_fee: calculateDeliveryFee(distance, order.order_type) // استخدام النوع هنا
        };

        const updatedOrder = await Order.findByIdAndUpdate(orderId, {
            $set: { 
                agent: { agent_id: agentId, assigned_at: new Date() }, 
                status: newStatus, // "Accepted"
                delivery_details: deliveryDetails 
            }
        }, { new: true, populate: ['user_id', 'orders.restaurant_id'] });

        startOrderTimers(updatedOrder);
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
 
        const validStatuses = ["On the way", "Delivered", "Completed", "Accepted", "Pick up"];
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
            "Accepted": ["Pick up", "On the way", "Delivered"], // السماح بالانتقال مباشرة إلى "Delivered"
            "Pick up": ["On the way"],
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

            // --- إضافة نظام النقاط ---
            const user = await User.findById(order.user_id._id);
            if (user) {
                user.points = (user.points || 0) + 1;

                if (user.points >= 5) {
                    const admins = await Admin.find().select('_id');
                    const adminIds = admins.map(admin => admin._id);
                    const notificationMessage = `User ${user.first_name} ${user.last_name} (Phone: ${user.phone}) has reached 5 points.`;
                    sendNotification(adminIds, user._id, notificationMessage);
                    user.points = 0; // Reset points
                }
                await user.save();
            }
            // --- نهاية نظام النقاط ---
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
        console.log(error);
        return res.status(500).json({ message: "Error updating order status." });
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
            // إعادة حساب المسافة بناءً على الموقع الجديد
            const distance = calculateDistance(
                latitude, longitude,
                activeOrder.address.coordinates.latitude,
                activeOrder.address.coordinates.longitude
            );

            // تحديث تفاصيل التوصيل في الطلب
            activeOrder.delivery_details.distance = distance;
            activeOrder.delivery_details.estimated_time = calculateEstimatedTime(distance);
            
            // إذا لم تكن هناك تكلفة توصيل محسوبة مسبقاً، قم بحسابها الآن
            if (!activeOrder.delivery_details.delivery_fee) {
                activeOrder.delivery_details.delivery_fee = calculateDeliveryFee(distance, activeOrder.order_type);
            }

            await activeOrder.save();
        }

        return res.json({ success: true, location: agent.current_location });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: error.message });
    }
};
