const Restaurant = require("../models/Restaurants");
const bcrypt = require("bcrypt")
const { hashSync, genSaltSync } = require("bcrypt");
const jwt = require('jsonwebtoken');
const Agent = require("../models/Agents");
const Order = require("../models/Orders");
const { setTimeout } = require('timers/promises');
const Admin = require("../models/Admin");
const User = require("../models/Users");
const { sendNotification } = require("./global");
require("dotenv").config();

module.exports.createAgent = async (req, res) => {
    const body = req.body;
    const isNewAgent = await Agent.isThisUserName(body.phone)
    if (isNewAgent) {
        return res.json({
            success: false,
            message: 'This user name is already in use'
        })
    }

    const admin = await Admin.findOne({ phone: req.body.phone })
    const user = await User.findOne({ phone: req.body.phone })
    const restaurant = await Restaurant.findOne({ phone: req.body.phone })

    if (admin || restaurant || user) {
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

    let agent = new Agent({
        name: body.name.trim(),
        phone: body.phone.trim(),
        password: body.password.trim(),
        user_name: "NA",
        ban: false
    })

    agent.save()
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
        const isNewUser = await Agent.isThisUserName(phone)
        if (!isNewUser) {
            return res.json({
                message: 'User name or password is invalid'
            })
        }

        Agent.findOne({ phone: phone })
            .then(async (agent) => {
                if (agent) {
                    bcrypt.compare(password, agent.password, async function (err, result) {
                        if (err) {
                            res.json({
                                error: err
                            })
                        }

                        if (result) {
                            let token = jwt.sign({ phone: agent.phone, id: agent._id, user_type: "Agent" }, process.env.JWT_KEY)
                            console.log(token)
                            agent.password = undefined
                            return res.status(200).json({
                                message: 'Login Successful!',
                                token: token,
                                info: agent
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

module.exports.getAgents = async (req, res, next) => {
    try {
        const agents = await Agent.find()

        const agentsWithOrders = await Promise.all(
            agents.map(async (agent) => {
                const orders = await Order.find({ delivery_id: agent._id }).populate({
                    path: 'user_id',
                    select: 'first_name last_name'
                }).populate({
                    path: 'orders.restaurant_id',
                    select: 'logo name phone'
                });

                return {
                    ...agent.toObject(),
                    orders,
                };
            })
        );

        return res.json({
            agents: agentsWithOrders
        })
    } catch (error) {
        console.log(error)
        res.json({
            message: "Error"
        })
    }
}

module.exports.getOrderOfAgent = async (req, res, next) => {
    try {
        const orders = await Order.find({ delivery_id: req.params.id }).populate({
            path: 'user_id',
            select: 'first_name last_name'
        }).populate({
            path: 'orders.restaurant_id',
            select: 'logo name phone'
        });

        return res.json({
            orders: orders
        })
    } catch (error) {
        console.log(error)
        res.json({
            message: "Error"
        })
    }
}

module.exports.changeBanAgent = async (req, res) => {
    try {
        const agent = await Agent.findById(req.params.id);
        agent.ban = !agent.ban;
        await agent.save();

        return res.status(200).json({
            message: `This agent is ${agent.ban ? "banned" : "unbanned"}`,
            ban: agent.ban,
        });
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}

module.exports.getOrdersNotAccept = async (req, res) => {
    try {
        Order.find({
            delivery_type: "Agent",
            delivery_id: null,
            $or: [
                { status: "Preparing" },
                { status: "Ready for pickup" }
            ],
        }).populate({
            path: 'user_id',
            select: 'first_name last_name'
        }).populate({
            path: 'orders.restaurant_id',
            select: 'logo name phone'
        }).then(orders => {
            return res.status(200).json({
                orders: orders
            });
        })
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}

module.exports.myOrder = async (req, res) => {
    try {
        Order.find({ delivery_type: "Agent", delivery_id: req.body.decoded.id, status: { $ne: "Canceled" } }).populate({
            path: 'user_id',
            select: 'first_name last_name'
        }).populate({
            path: 'orders.restaurant_id',
            select: 'logo name phone'
        }).then(orders => {
            return res.status(200).json({
                orders: orders
            });
        })
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}

module.exports.acceptOrder = async (req, res) => {
    try {
        const allOrders = await Order.find({
            delivery_id: req.body.decoded.id,
            status: { $nin: ["Completed", "Canceled", "Delivered"] }
        })

        if (allOrders.length === 3) {
            return res.status(200).json({
                message: "You have 3 order only"
            });
        }

        const acceptOrder = await Order.findById(req.params.id)

        if (acceptOrder.status !== "Ready for pickup" && acceptOrder.status !== "Preparing") {
            return res.status(200).json({
                message: "This order is accepted before"
            });
        }

        if (acceptOrder.status === "Preparing") {
            await Order.findByIdAndUpdate(req.params.id, { $set: { delivery_id: req.body.decoded.id, status: "Accepted" } }, { new: true }).then(order => {
                startOrderTimers(order)
                return res.status(200).json({
                    message: "Done Order is accept"
                });
            })
        } else if (acceptOrder.status === "Ready for pickup") {
            await Order.findByIdAndUpdate(req.params.id, { $set: { delivery_id: req.body.decoded.id, status: "Pick up" } }, { new: true }).then(order => {
                startOrderTimers(order)
                return res.status(200).json({
                    message: "Done Order is accept"
                });
            })
        }
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}

function startOrderTimers(order) {
    setTimeout(1500000).then(async () => {
        try {
            const currentOrder = await Order.findById(order._id);
            const admins = await Admin.find()

            let adminsId = []

            for (let i = 0; i < admins.length; i++) {
                adminsId.push(admins[i]._id)
            }

            if (currentOrder.status !== "Canceled" || currentOrder.status !== "Completed" || currentOrder.status !== "Delivered") {
                sendNotification(adminsId, currentOrder.user_id, `Order #${order._id.toString().slice(-4)} wait from 25 min by agent`)
            }
        } catch (error) {
            console.error('Error in order timer:', error);
        }
    });
}

module.exports.changeStatusOfOrder = async (req, res) => {
    try {
        const statusOrder = await Order.findOne({ _id: req.params.id, delivery_id: req.body.decoded.id })

        let newState = req.body.status;

        if (newState === "DELIVERED") {
            newState = "Completed"
        }

        if (!statusOrder) {
            return res.status(200).json({
                message: "You have not this order"
            });
        }

        statusOrder.orders.forEach(async (orderItem, index) => {
            if (orderItem.status !== "Canecled") {
                await Order.findByIdAndUpdate(
                    statusOrder._id,
                    {
                        $set: {
                            [`orders.${index}.status`]: newState,
                        }
                    }
                );
            }
        })

        await Order.findByIdAndUpdate(req.params.id, { $set: { status: newState } }).then(async (order) => {
            await sendNotification([order.user_id], req.body.decoded.id, `This order is ${newState}`)
            return res.status(200).json({
                message: `This order is ${newState}`
            });
        })
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}
