const mongoose = require('mongoose');
require('dotenv').config();
const Order = require('../models/Orders'); // Adjust path as needed

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/deliveria";

const OLD_STATUS = 'Packed / Ready for Pickup';
const NEW_STATUS = 'Ready for Delivery';

const migrateStatuses = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Find orders where the main status is the old one
        const mainOrders = await Order.find({ order_status: OLD_STATUS });
        console.log(`Found ${mainOrders.length} orders with main status '${OLD_STATUS}'`);

        // 2. Find orders where any sub-order status is the old one
        const subOrdersQuery = { "orders.status": OLD_STATUS };
        const ordersWithSub = await Order.find(subOrdersQuery);
        console.log(`Found ${ordersWithSub.length} orders with sub-orders having '${OLD_STATUS}'`);

        // Combine unique IDs
        const allOrderIds = new Set([
            ...mainOrders.map(o => o._id.toString()),
            ...ordersWithSub.map(o => o._id.toString())
        ]);

        console.log(`Total unique orders to process: ${allOrderIds.size}`);

        for (const orderId of allOrderIds) {
            const order = await Order.findById(orderId);
            let modified = false;

            // Update main status if needed
            if (order.order_status === OLD_STATUS) {
                order.order_status = NEW_STATUS;
                order.status = NEW_STATUS; // Legacy field
                modified = true;
                console.log(`- Order ${order.order_id}: Updated main status`);
            }

            // Update sub-orders
            if (order.orders && Array.isArray(order.orders)) {
                order.orders.forEach((sub, index) => {
                    if (sub.status === OLD_STATUS) {
                        sub.status = NEW_STATUS;
                        modified = true;
                        console.log(`  - Sub-order ${index}: Updated status`);
                    }
                });
            }

            // Update timeline
            if (order.status_timeline && Array.isArray(order.status_timeline)) {
                order.status_timeline.forEach(event => {
                    if (event.status === OLD_STATUS) {
                        event.status = NEW_STATUS;
                        // Not marking modified just for timeline usually, but good to keep consistent
                        modified = true;
                    }
                });
            }

            if (modified) {
                await order.save();
                console.log(`Saved changes for order ${order.order_id}`);
            }
        }

        console.log('Migration completed.');
        process.exit(0);

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrateStatuses();
