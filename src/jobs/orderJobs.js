const cron = require('node-cron');
const Order = require('../models/Orders');
const Admin = require('../models/Admin');
const { sendNotification } = require('../controllers/global');

// This job runs every minute to check the status of pending orders.
const startOrderProcessingJob = () => {
  console.log('[OrderJobs] Cron job registered. Will run every minute.');

  cron.schedule('* * * * *', async () => {
    const now = new Date();
    // Testing Thresholds (in minutes)
    const NOTIFY_THRESHOLD_MINUTES = 1;
    const CANCEL_THRESHOLD_MINUTES = 2;

    console.log('========================================');
    console.log(`[OrderJobs] Running check at: ${now.toISOString()}`);

    try {
      // Fetch admins once
      const admins = await Admin.find().select('_id');
      const adminIds = admins.map(admin => admin._id);

      // Optimization: Only fetch orders that are old enough to potentially need notification or cancellation
      // and match the relevant statuses.
      const thresholdDate = new Date(now.getTime() - NOTIFY_THRESHOLD_MINUTES * 60000);

      const pendingOrders = await Order.find({
        status: { $in: ['Pending Approval', 'Accepted'] },
        createdAt: { $lte: thresholdDate }
      });

      console.log(`[OrderJobs] Found ${pendingOrders.length} order(s) to process.`);
      console.log(`[OrderJobs] Criteria: Status=['Pending Approval', 'Accepted'], CreatedAt <= ${thresholdDate.toISOString()}`);

      if (pendingOrders.length === 0) {
        console.log('[OrderJobs] No orders need action. Exiting.');
        console.log('========================================');
        return;
      }

      for (const order of pendingOrders) {
        console.log(`\n[OrderJobs] Processing Order #${order.order_id} (ID: ${order._id})`);
        console.log(`[OrderJobs]   - Status: ${order.status}, CreatedAt: ${order.createdAt}`);

        const orderTime = new Date(order.createdAt);
        const minutesPassed = (now - orderTime) / (1000 * 60);
        console.log(`[OrderJobs]   - Minutes passed: ${minutesPassed.toFixed(2)}`);

        let allSubOrdersCanceled = true;

        for (let i = 0; i < order.orders.length; i++) {
          const subOrder = order.orders[i];
          // Check both 'Pending Approval' and 'Accepted' for sub-orders
          if (['Pending Approval', 'Accepted'].includes(subOrder.status)) {

            // PRIORITY 1: Cancel if over cancellation threshold
            if (minutesPassed > CANCEL_THRESHOLD_MINUTES) {
              console.log(`[OrderJobs]     -> ACTION: Canceling sub-order ${i} (${minutesPassed.toFixed(2)}m > ${CANCEL_THRESHOLD_MINUTES}m)`);
              subOrder.status = 'Canceled';

              const msg = `Part of order #${order.order_id} canceled (no response).`;
              sendNotification([order.user_id], null, msg);

              // Also add to timeline if possible, but schema structure is on main order usually
            }
            // PRIORITY 2: Notify if over notification threshold (and not yet canceled)
            else if (minutesPassed > NOTIFY_THRESHOLD_MINUTES && !subOrder.notification_sent) {
              console.log(`[OrderJobs]     -> ACTION: Notifying admins (${minutesPassed.toFixed(2)}m > ${NOTIFY_THRESHOLD_MINUTES}m)`);

              const msg = `Order #${order.order_id} from restaurant ${subOrder.restaurant_id} pending > ${NOTIFY_THRESHOLD_MINUTES}m.`;
              sendNotification(adminIds, order.user_id, msg);

              subOrder.notification_sent = true;
            } else {
              console.log(`[OrderJobs]     -> No action for sub-order ${i} (Wait or already notified).`);
            }
          }

          // Re-check status after potential update
          if (subOrder.status !== 'Canceled') {
            allSubOrdersCanceled = false;
          }
        }

        // If all sub-orders are canceled, cancel the main order
        if (allSubOrdersCanceled && order.status !== 'Canceled') {
          order.status = 'Canceled';
          order.order_status = 'Canceled'; // Update enum field as well
          order.status_timeline.push({
            status: 'Canceled',
            timestamp: new Date(),
            note: 'Auto-canceled by system (timeout)'
          });
          console.log(`[OrderJobs]   -> ACTION: Main order #${order.order_id} marked as Canceled.`);
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
