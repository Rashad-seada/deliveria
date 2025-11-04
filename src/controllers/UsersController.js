const Restaurant = require("../models/Restaurants");
const bcrypt = require("bcrypt")
const { hashSync, genSaltSync } = require("bcrypt");
const jwt = require('jsonwebtoken');
const User = require("../models/Users");
const Agent = require("../models/Agents");
const Admin = require("../models/Admin");
const Order = require("../models/Orders");

module.exports.signUp = async (req, res) => {
    const body = req.body;
    const isNewUser = await User.isPhoneTaken(body.phone)
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
        token:body.token || null,
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
        const { phone, password } = req.body;
        
        if (!phone || !password) {
            return res.status(400).json({
                success: false,
                message: 'Phone and password are required'
            });
        }

        const user = await User.findOne({ phone: phone });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials' // رسالة أكثر أماناً
            });
        }

        // التحقق من حالة الحظر
        if (user.ban) {
            return res.status(403).json({
                success: false,
                message: 'Your account is temporarily suspended'
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials" // رسالة أكثر أماناً
            });
        }

        // إنشاء التوكن مع البيانات الصحيحة
        let token = jwt.sign({ 
            id: user._id.toString(), // تحويل ObjectId إلى string
            phone: user.phone, 
            user_type: "User" 
        }, process.env.JWT_KEY, { expiresIn: '24h' });

        // إرجاع البيانات بدون الباسوورد
        const userInfo = {
            _id: user._id,
            first_name: user.first_name,
            last_name: user.last_name,
            phone: user.phone,
            email: user.email,
            token: user.token,
            ban: user.ban,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };

        return res.status(200).json({
            success: true,
            message: 'Login Successful!',
            token: token,
            info: userInfo
        });

    } catch (error) {
        console.log('Login error:', error);
        return res.status(500).json({
            success: false,
            message: "Server error during login"
        });
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
        const body = req.body;
        let update = {
            first_name: body.first_name.trim(),
            last_name: body.last_name.trim(),
            email: body.email
        }

        // استخدام req.decoded بدلاً من req.body.decoded
        User.findByIdAndUpdate(req.decoded.id, { $set: update }, { new: true }).then(response => {
            return res.status(200).json({
                success: true,
                message: "Profile updated successfully"
            })
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: "Error updating profile"
        })
    }
}

module.exports.myOrder = async (req, res) => {
    try {
        // استخدام req.decoded بدلاً من req.body.decoded
        const orders = await Order.find({ user_id: req.decoded.id }).populate({
            path: 'orders.restaurant_id',
            select: 'logo name phone'
        });
        
        return res.status(200).json({
            success: true,
            orders: orders
        });
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: "Error fetching orders"
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