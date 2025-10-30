const Restaurant = require("../models/Restaurants");
const bcrypt = require("bcrypt")
const { hashSync, genSaltSync } = require("bcrypt");
const jwt = require('jsonwebtoken');
const User = require("../models/Users");
const Agent = require("../models/Agents");
const Admin = require("../models/Admin");
const Order = require("../models/Orders");
require("dotenv").config();

module.exports.signUp = async (req, res) => {
    const body = req.body;
    const isNewUser = await User.isThisPhoneUse(body.phone)
    if (isNewUser) {
        return res.json({
            success: false,
            message: 'This phone is already in use'
        })
    }

    const admin = await Admin.findOne({ phone: req.body.phone })
    const agent = await Agent.findOne({ phone: req.body.phone })
    const restaurant = await Restaurant.findOne({ phone: req.body.phone })

    if (admin || restaurant || agent) {
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

    let user = new User({
        first_name: body.first_name.trim(),
        last_name: body.last_name.trim(),
        phone: body.phone.trim(),
        password: body.password.trim(),
        email: "N/A",
        ban: false,
    })

    user.save()
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
        const isNewUser = await User.isThisPhoneUse(phone)
        if (!isNewUser) {
            return res.json({
                message: 'Phone or password is invalid'
            })
        }

        User.findOne({ phone: phone })
            .then(async (user) => {
                if (user) {
                    bcrypt.compare(password, user.password, async function (err, result) {
                        if (err) {
                            res.json({
                                error: err
                            })
                        }

                        if (result) {
                            let token = jwt.sign({ phone: user.phone, id: user._id, user_type: "User" }, process.env.JWT_KEY)
                            user.password = undefined
                            return res.status(200).json({
                                message: 'Login Successful!',
                                token: token,
                                info: user
                            })

                        } else {
                            return res.json({
                                message: "Phone or password is invalid"
                            })
                        }
                    })
                } else {
                    res.json({
                        message: 'Phone or password is invalid'
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

module.exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find()
        const usersWithOrders = await Promise.all(
            users.map(async (user) => {
                const orders = await Order.find({ user_id: user._id });
                return {
                    ...user.toObject(),
                    number_of_orders: orders.length
                };
            })
        );

        return res.status(200).json({
            users: usersWithOrders
        });
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}

module.exports.updateProfile = async (req, res) => {
    try {
        const body = req.body
        let update = {
            first_name: body.first_name.trim(),
            last_name: body.last_name.trim(),
            email: body.email
        }

        User.findByIdAndUpdate(req.body.decoded.id, { $set: update }, { new: true }).then(response => {
            return res.status(200).json({
                message: "Profile is updated"
            })
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
        Order.find({ user_id: req.body.decoded.id }).populate({
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

module.exports.changeBan = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        user.ban = !user.ban;
        await user.save();

        return res.status(200).json({
            message: `This user is ${user.ban ? "enabled" : "disabled"} delivery`,
            ban: user.ban,
        });
    } catch (error) {
        return res.json({
            message: "Error"
        })
    }
}

module.exports.searchByPhone = async (req, res) => {
    try {
        User.find({ phone: { $regex: new RegExp(req.body.search, 'i') } }).then(users => {
            return res.json({
                users: users
            })
        })
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}