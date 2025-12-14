const cron = require('node-cron');
const Order = require('../models/Orders');
const Admin = require('../models/Admin');
const { sendNotification } = require('../controllers/global');

// This job runs every minute to check the status of pending orders.
const startOrderProcessingJob = () => {
  console.log('[OrderJobs] Cron job registered. Will run every minute.');

  cron.schedule('* * * * *', async () => {
    const now = new Date();
    console.log('========================================');
    console.log(`[OrderJobs] Running check at: ${now.toISOString()}`);

    try {
      // Fetch admins once outside the loop
      const admins = await Admin.find().select('_id');
      const adminIds = admins.map(admin => admin._id);
      console.log(`[OrderJobs] Found ${adminIds.length} admin(s) for notifications.`);

      // Find orders that are still "Pending Approval" and could be late or need cancellation
      const pendingOrders = await Order.find({ status: 'Pending Approval' });
      console.log(`[OrderJobs] Found ${pendingOrders.length} order(s) with status "Pending Approval".`);

      if (pendingOrders.length === 0) {
        console.log('[OrderJobs] No pending orders to process. Exiting.');
        console.log('========================================');
        return;
      }

      for (const order of pendingOrders) {
        console.log(`\n[OrderJobs] Processing Order #${order.order_id} (ID: ${order._id})`);
        console.log(`[OrderJobs]   - Order createdAt: ${order.createdAt}`);
        console.log(`[OrderJobs]   - Order status: ${order.status}`);
        console.log(`[OrderJobs]   - Sub-orders count: ${order.orders.length}`);

        const orderTime = new Date(order.createdAt);
        const minutesPassed = (now - orderTime) / (1000 * 60);
        console.log(`[OrderJobs]   - Minutes passed since creation: ${minutesPassed.toFixed(2)}`);

        // Process each sub-order within the main order
        let allSubOrdersCanceled = true;

        for (let i = 0; i < order.orders.length; i++) {
          const subOrder = order.orders[i];
          console.log(`[OrderJobs]   - Sub-order [${i}] restaurant: ${subOrder.restaurant_id}, status: ${subOrder.status}`);

          if (subOrder.status === 'Pending Approval') {
            // Condition 1: Auto-cancel sub-order after 1 minute (was 20 for production)
            if (minutesPassed > 1) {
              console.log(`[OrderJobs]     -> ACTION: Canceling sub-order (${minutesPassed.toFixed(2)} min > 1 min)`);
              subOrder.status = 'Canceled';
              // Notify user about the specific sub-order cancellation
              sendNotification([order.user_id], null, `A part of your order #${order.order_id} was canceled due to no response from the restaurant.`);
            }
            // Condition 2: Notify admins after 10 minutes (but before cancellation)
            else if (minutesPassed > 10 && !subOrder.notification_sent) {
              console.log(`[OrderJobs]     -> ACTION: Notifying admins (${minutesPassed.toFixed(2)} min > 10 min, notification_sent: ${subOrder.notification_sent})`);
              sendNotification(adminIds, order.user_id, `Order #${order.order_id} from restaurant ${subOrder.restaurant_id} has been pending for over 10 minutes.`);
              subOrder.notification_sent = true;
            } else {
              console.log(`[OrderJobs]     -> NO ACTION: Not yet 10 min or already notified (notification_sent: ${subOrder.notification_sent})`);
            }
          } else {
            console.log(`[OrderJobs]     -> SKIP: Sub-order status is not "Pending Approval"`);
          }

          if (subOrder.status !== 'Canceled') {
            allSubOrdersCanceled = false;
          }
        }

        console.log(`[OrderJobs]   - All sub-orders canceled? ${allSubOrdersCanceled}`);

        // If all sub-orders are canceled, cancel the main order
        if (allSubOrdersCanceled && order.status !== 'Canceled') {
          order.status = 'Canceled';
          console.log(`[OrderJobs]   -> ACTION: Main order #${order.order_id} marked as Canceled.`);
        }

        // Save changes to the order
        console.log(`[OrderJobs]   - Saving order changes...`);
        await order.save();
        console.log(`[OrderJobs]   - Order saved successfully.`);
      }
    } catch (error) {
      console.error('[OrderJobs] ERROR processing pending orders:', error);
    }
    console.log('========================================');
  });
};


module.exports = { startOrderProcessingJob };
