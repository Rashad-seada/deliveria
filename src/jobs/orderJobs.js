const cron = require('node-cron');
const Order = require('../models/Orders');
const Admin = require('../models/Admin');
const { sendNotification } = require('../controllers/global');
const { notifyOrderDelay, notifyRestaurantDelay } = require('../utils/notificationManager');

// This job runs every minute to check the status of pending orders.
const startOrderProcessingJob = () => {
  console.log('[OrderJobs] Cron job registered. Will run every minute.');

  cron.schedule('* * * * *', async () => {
    const now = new Date();
    // Production Thresholds (in minutes)
    const NOTIFY_CUSTOMER_THRESHOLD_MINUTES = 15;
    const NOTIFY_RESTAURANT_THRESHOLD_MINUTES = 10;
    const CANCEL_THRESHOLD_MINUTES = 25;

    console.log('========================================');
    console.log(`[OrderJobs] Running check at: ${now.toISOString()}`);

    try {
      // Fetch admins once
      const admins = await Admin.find().select('_id');
      const adminIds = admins.map(admin => admin._id);

      // Optimization: Only fetch orders that are old enough to potentially need notification or cancellation
      // and match the relevant statuses.
      const notifyThresholdDate = new Date(now.getTime() - NOTIFY_CUSTOMER_THRESHOLD_MINUTES * 60000);
      const cancelThresholdDate = new Date(now.getTime() - CANCEL_THRESHOLD_MINUTES * 60000);

      const pendingOrders = await Order.find({
        order_status: { $in: ['Waiting for Approval', 'Approved / Preparing'] },
        createdAt: { $lte: notifyThresholdDate }
      });

      console.log(`[OrderJobs] Found ${pendingOrders.length} order(s) to process.`);

      if (pendingOrders.length === 0) {
        console.log('[OrderJobs] No orders need action. Exiting.');
        console.log('========================================');
        return;
      }

      for (const order of pendingOrders) {
        console.log(`\n[OrderJobs] Processing Order #${order.order_id} (ID: ${order._id})`);
        console.log(`[OrderJobs]   - Status: ${order.order_status}, CreatedAt: ${order.createdAt}`);

        const orderTime = new Date(order.createdAt);
        const minutesPassed = (now - orderTime) / (1000 * 60);
        console.log(`[OrderJobs]   - Minutes passed: ${minutesPassed.toFixed(2)}`);

        let allSubOrdersCanceled = false;

        for (let i = 0; i < order.orders.length; i++) {
          const subOrder = order.orders[i];
          console.log(`[OrderJobs]   - Sub-order [${i}] status: ${subOrder.status}`);

          // Check 'Waiting for Approval', 'Approved / Preparing'
          if (['Waiting for Approval', 'Approved / Preparing'].includes(subOrder.status)) {

            // PRIORITY 1: Cancel if over cancellation threshold
            if (minutesPassed > CANCEL_THRESHOLD_MINUTES) {
              console.log(`[OrderJobs]     -> ACTION: Canceling sub-order ${i} (${minutesPassed.toFixed(2)}m > ${CANCEL_THRESHOLD_MINUTES}m)`);
              subOrder.status = 'Canceled';
              subOrder.cancel_me = true;

              // Notify customer
              if (order.user_id) {
                await notifyOrderDelay(order._id, minutesPassed);
              }
            }
            // PRIORITY 2: Notify restaurant if over restaurant threshold
            else if (minutesPassed > NOTIFY_RESTAURANT_THRESHOLD_MINUTES && !subOrder.delay_notification_sent) {
              console.log(`[OrderJobs]     -> ACTION: Notifying restaurant (${minutesPassed.toFixed(2)}m > ${NOTIFY_RESTAURANT_THRESHOLD_MINUTES}m)`);

              await notifyRestaurantDelay(order._id, subOrder.restaurant_id, minutesPassed);
              subOrder.delay_notification_sent = true;
            }
            // PRIORITY 3: Notify customer if over customer threshold
            else if (minutesPassed > NOTIFY_CUSTOMER_THRESHOLD_MINUTES && order.delay_notifications?.first_delay_notified_at === undefined) {
              console.log(`[OrderJobs]     -> ACTION: Notifying customer (${minutesPassed.toFixed(2)}m > ${NOTIFY_CUSTOMER_THRESHOLD_MINUTES}m)`);

              if (order.user_id) {
                await notifyOrderDelay(order._id, minutesPassed);
              }

              if (!order.delay_notifications) {
                order.delay_notifications = {};
              }
              order.delay_notifications.first_delay_notified_at = new Date();
            } else {
              console.log(`[OrderJobs]     -> No action for sub-order ${i} (Wait or already notified).`);
            }
          }

          // Re-check status after potential update
          if (subOrder.status === 'Canceled') {
            allSubOrdersCanceled = true;
          }
        }

        // If all sub-orders are canceled, cancel the main order
        if (allSubOrdersCanceled && order.order_status !== 'Canceled') {
          order.order_status = 'Canceled';
          order.canceled_by = 'System';
          order.canceled_at = new Date();
          order.status_timeline.push({
            status: 'Canceled',
            timestamp: new Date(),
            note: 'Auto-canceled by system (timeout)'
          });
          console.log(`[OrderJobs]   -> ACTION: Main order #${order.order_id} marked as Canceled.`);
        }

        // Fix for missing order_type on legacy orders
        if (!order.order_type) {
          order.order_type = order.orders.length > 1 ? 'Multi' : 'Single';
          console.log(`[OrderJobs]   - Auto-fixed missing order_type to: ${order.order_type}`);
        }

        // Recalculate totals if any change occurred (e.g. partial cancellation)
        const activeSubOrders = order.orders.filter(so => so.status !== 'Canceled');
        const newPriceWithoutDelivery = activeSubOrders.reduce((sum, so) => sum + (so.price_of_restaurant || 0), 0);
        
        // Update price if it differs (meaning something was canceled)
        if (order.final_price_without_delivery_cost !== newPriceWithoutDelivery) {
             console.log(`[OrderJobs]   -> ACTION: Updating price from ${order.final_price_without_delivery_cost} to ${newPriceWithoutDelivery} (due to partial cancellation)`);
             order.final_price_without_delivery_cost = newPriceWithoutDelivery;
             order.final_price = order.final_price_without_delivery_cost + (order.final_delivery_cost || 0);
        }

        await order.save();
        console.log(`[OrderJobs]   - Saved Order #${order.order_id}`);
      }
    } catch (error) {
      console.error('[OrderJobs] ERROR:', error);
    }
    console.log('========================================');
  });
};


module.exports = { startOrderProcessingJob };
