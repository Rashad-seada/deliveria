require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../models/Orders');

const STATUS_MAPPING = {
    // Variations of "Waiting for Approval"
    'Pending Approval': 'Waiting for Approval',
    'Pending': 'Waiting for Approval',
    'waiting for approval': 'Waiting for Approval',
    'Waiting For Approval': 'Waiting for Approval',

    // Variations of "Approved / Preparing"
    'Preparing': 'Approved / Preparing',
    'Approved': 'Approved / Preparing',
    'approved / preparing': 'Approved / Preparing',

    // Variations of "Packed / Ready for Pickup" or "Ready for Delivery"
    // Since RestaurantsController sets "Ready for Delivery" when ready, 
    // and "Packed / Ready for Pickup" exists in Enum, we need to decide.
    // The modern flow seems to use "Ready for Delivery" for clarity for agents.
    'Packed': 'Packed / Ready for Pickup',
    'Ready': 'Ready for Delivery',

    // Variations of "On the way"
    'On the Way': 'On the way',
    'on the way': 'On the way',

    // Variations of "Delivered"
    'delivered': 'Delivered',

    // Variations of "Canceled"
    'Cancelled': 'Canceled',
    'canceled': 'Canceled'
};

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URL);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const migrateStatuses = async () => {
    await connectDB();

    try {
        const orders = await Order.find({});
        console.log(`Checking ${orders.length} orders for status migration...`);

        let updatedCount = 0;

        for (const order of orders) {
            let orderModified = false;

            // 1. Migrate Main Order Status
            if (STATUS_MAPPING[order.status]) {
                console.log(`Order ${order.order_id}: Migrating main status '${order.status}' -> '${STATUS_MAPPING[order.status]}'`);
                order.status = STATUS_MAPPING[order.status];
                orderModified = true;
            }

            // 2. Migrate order_status (if different)
            if (STATUS_MAPPING[order.order_status]) {
                console.log(`Order ${order.order_id}: Migrating order_status '${order.order_status}' -> '${STATUS_MAPPING[order.order_status]}'`);
                order.order_status = STATUS_MAPPING[order.order_status];
                orderModified = true;
            }

            // 3. Migrate Sub-Orders Status
            if (order.orders && order.orders.length > 0) {
                order.orders.forEach(subOrder => {
                    if (STATUS_MAPPING[subOrder.status]) {
                        console.log(`Order ${order.order_id} (SubOrder): Migrating sub-status '${subOrder.status}' -> '${STATUS_MAPPING[subOrder.status]}'`);
                        subOrder.status = STATUS_MAPPING[subOrder.status];
                        orderModified = true;
                    }
                });
            }

            if (orderModified) {
                // Bypass validation to ensure migration saves even if other unrelated legacy data is invalid
                await Order.findByIdAndUpdate(order._id, {
                    $set: {
                        status: order.status,
                        order_status: order.order_status,
                        orders: order.orders
                    }
                });
                updatedCount++;
            }
        }

        console.log('------------------------------------------------');
        console.log(`Migration Completed. Updated ${updatedCount} orders.`);
        process.exit();

    } catch (error) {
        console.error("Migration Error:", error);
        process.exit(1);
    }
};

migrateStatuses();
