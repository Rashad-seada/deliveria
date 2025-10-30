const Order = require("../models/Orders");
const Agent = require("../models/Agents");
const { sendNotification } = require("./global");

const calculateEstimatedTime = (distance) => {
    // متوسط السرعة 30 كم/ساعة
    const averageSpeed = 30;
    // تحويل المسافة إلى دقائق
    return Math.ceil((distance / averageSpeed) * 60);
};

const calculateDeliveryFee = (distance) => {
    // رسوم أساسية
    const baseFee = 10;
    // رسوم لكل كيلومتر
    const perKmFee = 2;
    return baseFee + (distance * perKmFee);
};

// تعيين مندوب للطلب
exports.assignAgentToOrder = async (orderId) => {
    try {
        const order = await Order.findById(orderId);
        if (!order) throw new Error('Order not found');

        // البحث عن أقرب مندوب متاح
        const availableAgents = await Agent.find({ 
            status: 'AVAILABLE',
            // يمكن إضافة شروط أخرى مثل المنطقة
        });

        if (availableAgents.length === 0) {
            throw new Error('No available agents');
        }

        // اختيار أقرب مندوب (يمكن تحسين هذه الخوارزمية)
        const agent = availableAgents[0];
        
        // تحديث حالة الطلب
        order.agent = {
            agent_id: agent._id,
            assigned_at: new Date()
        };
        order.status_timeline.push({
            status: 'CONFIRMED',
            timestamp: new Date(),
            note: `Assigned to agent ${agent.name}`
        });
        
        // تحديث حالة المندوب
        agent.status = 'BUSY';
        agent.active_order = order._id;
        
        await Promise.all([order.save(), agent.save()]);
        
        // إرسال إشعار للمندوب
        await sendNotification(agent.fcm_token, {
            title: 'طلب جديد',
            body: 'لديك طلب جديد للتوصيل'
        });

        return { success: true, agent };
    } catch (error) {
        console.error('Error assigning agent:', error);
        throw error;
    }
};

// تحديث حالة الطلب
exports.updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, note } = req.body;
        
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // تحديث حالة الطلب
        order.order_status = status;
        order.status_timeline.push({
            status,
            timestamp: new Date(),
            note
        });

        // معالجة خاصة لبعض الحالات
        switch (status) {
            case 'PICKED_UP':
                order.agent.pickup_time = new Date();
                break;
            case 'DELIVERED':
                order.agent.delivery_time = new Date();
                // تحديث إحصائيات المندوب
                const agent = await Agent.findById(order.agent.agent_id);
                if (agent) {
                    agent.statistics.total_orders += 1;
                    agent.statistics.total_distance += order.delivery_details.distance;
                    agent.status = 'AVAILABLE';
                    agent.active_order = null;
                    await agent.save();
                }
                break;
        }

        await order.save();

        // إرسال إشعار للعميل
        const user = await User.findById(order.user_id);
        if (user && user.fcm_token) {
            await sendNotification(user.fcm_token, {
                title: 'تحديث حالة الطلب',
                body: \`تم تحديث حالة طلبك إلى \${status}\`
            });
        }

        return res.json({
            success: true,
            order
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// تحديث موقع المندوب
exports.updateAgentLocation = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        const agentId = req.body.decoded.id;

        const agent = await Agent.findById(agentId);
        if (!agent) {
            return res.status(404).json({ message: 'Agent not found' });
        }

        agent.current_location = {
            type: 'Point',
            coordinates: [longitude, latitude]
        };

        await agent.save();

        // إذا كان المندوب لديه طلب نشط، قم بتحديث تقدم التوصيل
        if (agent.active_order) {
            const order = await Order.findById(agent.active_order);
            if (order) {
                // يمكن إضافة منطق لتحديث وقت الوصول المتوقع
            }
        }

        return res.json({
            success: true,
            location: agent.current_location
        });
    } catch (error) {
        console.error('Error updating agent location:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};