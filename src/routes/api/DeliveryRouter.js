const express = require('express');
const router = express.Router();
const { checkToken } = require("../../auth/token_validation");
const deliveryController = require('../../controllers/DeliveryController');

// مسارات تحديث حالة الطلب
router.put('/orders/:orderId/status', checkToken, deliveryController.updateOrderStatus);

// مسارات تحديث موقع المندوب
router.post('/agent/location', checkToken, deliveryController.updateAgentLocation);

// مسارات تقييم الخدمة
router.post('/orders/:orderId/rate', checkToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { restaurant_rating, delivery_rating } = req.body;
        
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // تحديث تقييم الطلب
        order.rating = {
            restaurant_rating,
            delivery_rating
        };

        // تحديث متوسط تقييم المندوب
        if (delivery_rating && order.agent.agent_id) {
            const agent = await Agent.findById(order.agent.agent_id);
            if (agent) {
                const totalRatings = agent.statistics.total_orders;
                const newAverage = (
                    (agent.statistics.average_rating * totalRatings) + 
                    delivery_rating.score
                ) / (totalRatings + 1);
                
                agent.statistics.average_rating = newAverage;
                await agent.save();
            }
        }

        await order.save();

        return res.json({
            success: true,
            message: 'Rating updated successfully'
        });
    } catch (error) {
        console.error('Error updating rating:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;