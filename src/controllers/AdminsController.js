const Restaurant = require("../models/Restaurants");
const bcrypt = require("bcrypt")
const { hashSync, genSaltSync } = require("bcrypt");
const jwt = require('jsonwebtoken');
const Admin = require("../models/Admin");
const Agent = require("../models/Agents");
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
        // parallels queries for efficiency
        const [
            activeUsersCount,
            activeRestaurantsCount,
            activeAgentsCount,
            orderStats,
            last7DaysOrders
        ] = await Promise.all([
            User.countDocuments({ ban: false }),
            Restaurant.countDocuments({ is_show: true }),
            Agent.countDocuments({ ban: false }), // New metric
            Order.aggregate([
                {
                    $match: {
                        status: { $in: [ORDER_STATUS.COMPLETED, ORDER_STATUS.DELIVERED] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: "$final_price" },
                        count: { $sum: 1 }
                    }
                }
            ]),
            getOrdersForLastNDaysAggregate(7) // Optimized aggregation
        ]);

        const totalRevenue = orderStats.length > 0 ? orderStats[0].totalRevenue : 0;
        const totalCompletedOrders = orderStats.length > 0 ? orderStats[0].count : 0;

        // Calculate net revenue (assuming 20%)
        const netRevenue = totalRevenue * 0.20;

        return res.json({
            total_orders: totalCompletedOrders,
            net_revenue: netRevenue,
            active_users: activeUsersCount,
            active_restaurants: activeRestaurantsCount,
            total_amount: totalRevenue,
            orders_today: last7DaysOrders.length > 0 ? last7DaysOrders[last7DaysOrders.length - 1] : 0,
            oders_of_last_week: last7DaysOrders,
            active_agents: activeAgentsCount
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

// Optimized helper function using aggregation for daily stats
async function getOrdersForLastNDaysAggregate(days) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const startDate = new Date();
    startDate.setDate(today.getDate() - (days - 1)); // Go back N-1 days to include today
    startDate.setHours(0, 0, 0, 0);

    const matchStage = {
        $match: {
            createdAt: { $gte: startDate, $lte: today },
            status: { $in: [ORDER_STATUS.COMPLETED, ORDER_STATUS.DELIVERED] }
        }
    };

    const groupStage = {
        $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 }
        }
    };

    const sortStage = { $sort: { _id: 1 } };

    const dailyStats = await Order.aggregate([matchStage, groupStage, sortStage]);

    // Map results to a continuous array of counts, filling missing days with 0
    const result = [];
    for (let i = 0; i < days; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dateString = d.toISOString().split('T')[0];

        const stat = dailyStats.find(s => s._id === dateString);
        result.push(stat ? stat.count : 0);
    }

    return result;
}