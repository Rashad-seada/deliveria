const Admin = require("../models/Admin");
const Agent = require("../models/Agents");
const Notification = require("../models/Notifications");
const Restaurant = require("../models/Restaurants");
const User = require("../models/Users");
const { sendNotification } = require("./global");

module.exports.createNotification = async (req, res, next) => {
    try {
        await sendNotification(req.body.ids, req.body.decoded.id, req.body.message.trim());

        return res.status(200).json({ message: "Done send notification" });
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: "Error retrieving restaurants",
            error: error.message
        });
    }
};

module.exports.getNotification = async (req, res, next) => {
    try {
        const userId = req.body.decoded.id;
        const notifications = await Notification.find({ user_id: userId }).sort({ _id: -1 });

        // Use Promise.all for parallel processing of async operations
        const notificationsWithDataOfSender = await Promise.all(
            notifications.map(async (notification) => {
                let sender_name = "Deliveria";

                // Try to find sender in different collections
                const [user, restaurant, admin, agent] = await Promise.allSettled([
                    User.findById(notification.sender_id),
                    Restaurant.findById(notification.sender_id),
                    Admin.findById(notification.sender_id),
                    Agent.findById(notification.sender_id)
                ]);

                // Check which promise resolved successfully and get the name
                if (user.status === 'fulfilled' && user.value) {
                    sender_name = `${user.value.first_name} ${user.value.last_name}`;
                } else if (restaurant.status === 'fulfilled' && restaurant.value) {
                    sender_name = restaurant.value.name;
                } else if (admin.status === 'fulfilled' && admin.value) {
                    sender_name = "Deliveria";
                } else if (agent.status === 'fulfilled' && agent.value) {
                    sender_name = "Deliveria";
                }

                return {
                    ...notification.toObject(),
                    sender_name
                };
            })
        );

        return res.status(200).json({ response: notificationsWithDataOfSender });
    } catch (error) {
        console.error("Error retrieving notifications:", error);
        return res.status(500).json({
            message: "Error retrieving notifications",
            error: error.message
        });
    }
};