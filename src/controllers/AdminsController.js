const Restaurant = require("../models/Restaurants");
const bcrypt = require("bcrypt")
const { hashSync, genSaltSync } = require("bcrypt");
const jwt = require('jsonwebtoken');
const Admin = require("../models/Admin");
const Agent = require("../models/Agents");
const User = require("../models/Users");
const User = require("../models/Users");
const Order = require("../models/Orders");
const { ORDER_STATUS } = require("../models/Orders");

module.exports.createAdmin = async (req, res) => {
    const body = req.body;
    const isNewAdmin = await Admin.isThisUserName(body.phone)
    if (isNewAdmin) {
        return res.json({
            success: false,
            message: 'This user name is already in use'
        })
    }

    const agent = await Agent.findOne({ phone: req.body.phone })
    const user = await User.findOne({ phone: req.body.phone })
    const restaurant = await Restaurant.findOne({ phone: req.body.phone })

    if (agent || restaurant || user) {
        return res.json({
            message: 'Please change this phone number'
        })
    }

    const salt = genSaltSync(10);

    try {
        body.password = hashSync(body.password, salt);
    } catch (error) {
        return res.json({
            success: false,
            message: "password error"
        })
    }

    let admin = new Admin({
        password: body.password.trim(),
        phone: body.phone.trim()
    })

    admin.save()
        .then(async (response) => {
            return res.status(200).json({
                success: true,
                message: "Signup is successfully"
            })
        })
}

module.exports.login = async (req, res, next) => {
    try {
        var phone = req.body.phone
        var password = req.body.password
        const isNewUser = await Admin.isThisUserName(phone)
        if (!isNewUser) {
            return res.json({
                message: 'User name or password is invalid'
            })
        }

        Admin.findOne({ phone: phone })
            .then(async (admin) => {
                if (admin) {
                    bcrypt.compare(password, admin.password, async function (err, result) {
                        if (err) {
                            res.json({
                                error: err
                            })
                        }

                        if (result) {
                            let token = jwt.sign({ phone: admin.phone, id: admin._id, user_type: "Admin" }, process.env.JWT_KEY)
                            console.log(token)
                            admin.password = undefined
                            return res.status(200).json({
                                message: 'Login Successful!',
                                token: token,
                                info: admin
                            })

                        } else {
                            return res.json({
                                message: "User name or password is invalid"
                            })
                        }
                    })
                } else {
                    res.json({
                        message: 'User name or password is invalid'
                    })
                }
            })
    } catch (error) {
        console.log(error)
        res.json({
            message: "Error"
        })
    }
}

module.exports.getDataOfApp = async (req, res, next) => {
    try {
        // Execute all independent queries in parallel
        const [users, restaurants, completedOrders] = await Promise.all([
            User.find({ ban: false }),
            Restaurant.find({ is_show: true }),
            Order.find({
                status: { $ne: ORDER_STATUS.CANCELED }
            })
        ]);

        // Calculate total amount
        const totalAmount = completedOrders.reduce((sum, order) => sum + order.final_price, 0);

        // Get orders for the last 7 days including today
        const last7DaysOrders = await getOrdersForLastNDays(7);

        return res.json({
            total_orders: completedOrders.length,
            net_revenue: totalAmount * .2, // Consider calculating this based on your business logic
            active_users: users.length,
            active_restaurants: restaurants.length,
            total_amount: totalAmount,
            orders_today: last7DaysOrders[0].length,
            oders_of_last_week: last7DaysOrders.map(dayOrders => dayOrders.length)
        });

    } catch (error) {
        console.error("Error retrieving app data:", error);
        return res.status(500).json({
            message: "Error retrieving application data",
            error: error.message
        });
    }
};

module.exports.getAllOrders = async (req, res, next) => {
    try {
        const orders = await Order.find({
            status: { $ne: ORDER_STATUS.CANCELED }
        })

        return res.json({
            orders: orders
        });
    } catch (error) {
        console.error("Error retrieving app data:", error);
        return res.status(500).json({
            message: "Error retrieving application data",
            error: error.message
        });
    }
};

// Helper function to get orders for the last N days
async function getOrdersForLastNDays(days) {
    const dayPromises = [];

    for (let i = 0; i < days; i++) {
        const startOfDay = new Date();
        startOfDay.setDate(startOfDay.getDate() - i);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setDate(endOfDay.getDate() - i);
        endOfDay.setHours(23, 59, 59, 999);

        dayPromises.push(
            Order.find({
                $or: [
                    { status: ORDER_STATUS.COMPLETED },
                    { status: ORDER_STATUS.DELIVERED }
                ],
                createdAt: {
                    $gte: startOfDay,
                    $lte: endOfDay
                }
            })
        );
    }

    return Promise.all(dayPromises);
}