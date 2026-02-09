const mongoose = require('mongoose');
const Order = require('../models/Orders');
const { ORDER_STATUS } = require('../models/Orders');
require('dotenv').config();

const fixInconsistentOrders = async () => {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log('Connected to DB');

        const inconsistentOrders = await Order.find({
            order_status: ORDER_STATUS.CANCELED,
            status: { $ne: ORDER_STATUS.CANCELED }
        });

        console.log(`Found ${inconsistentOrders.length} inconsistent orders.`);

        for (const order of inconsistentOrders) {
            console.log(`Fixing Order #${order.order_id} (ID: ${order._id})`);
            console.log(`  - Old Status: ${order.status}`);

            order.status = ORDER_STATUS.CANCELED;

            // Ensure canceled_by and canceled_at are set if missing
            if (!order.canceled_by) order.canceled_by = 'System (Fix Script)';
            if (!order.canceled_at) order.canceled_at = new Date();

            await order.save();
            console.log(`  - New Status: ${order.status}`);
        }

        console.log('All inconsistent orders fixed.');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

fixInconsistentOrders();
