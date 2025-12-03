const cron = require('node-cron');
const Order = require('../models/Orders');
const Admin = require('../models/Admin');
const { sendNotification } = require('../controllers/global');

// This job runs every minute to check the status of pending orders.
const startOrderProcessingJob = () => {
  cron.schedule('* * * * *', async () => {
    console.log('Running a check for pending orders...');
    const now = new Date();

    try {
      // Find orders that are still "New" and could be late or need cancellation
      const pendingOrders = await Order.find({ status: 'New' });

      for (const order of pendingOrders) {
        // Process each sub-order within the main order
        let allSubOrdersCanceled = true;

        for (const subOrder of order.orders) {
          if (subOrder.status === 'New') {
            const orderTime = new Date(subOrder.created_at);
            const minutesPassed = (now - orderTime) / (1000 * 60);

            // Condition 1: Auto-cancel sub-order after 20 minutes
            if (minutesPassed > 20) {
              subOrder.status = 'Canceled';
              console.log(`Sub-order for restaurant ${subOrder.restaurant_id} in order #${order.order_id} was auto-canceled.`);
              // Notify user about the specific sub-order cancellation
              sendNotification([order.user_id], null, `A part of your order #${order.order_id} was canceled due to no response from the restaurant.`);
            }
            // Condition 2: Notify admins after 10 minutes (but before cancellation)
            else if (minutesPassed > 10) {
              // To avoid spamming, we should add a flag to see if notification was already sent
              // For simplicity here, we just send it. In a real app, add a `notification_sent` flag.
              const admins = await Admin.find().select('_id');
              const adminIds = admins.map(admin => admin._id);
              console.log(`Notifying admins about pending order #${order.order_id}`);
              sendNotification(adminIds, order.user_id, `Order #${order.order_id} from restaurant ${subOrder.restaurant_id} has been pending for over 10 minutes.`);
            }
          }

          if (subOrder.status !== 'Canceled') {
            allSubOrdersCanceled = false;
          }
        }

        // If all sub-orders are canceled, cancel the main order
        if (allSubOrdersCanceled && order.status !== 'Canceled') {
          order.status = 'Canceled';
          console.log(`Main order #${order.order_id} was canceled as all its parts were canceled.`);
        }

        // Save changes to the order
        await order.save();
      }
    } catch (error) {
      console.error('Error processing pending orders:', error);
    }
  });
};


module.exports = { startOrderProcessingJob };
