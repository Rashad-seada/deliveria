const Restaurant = require("../models/Restaurants");
const bcrypt = require("bcrypt")
const { hashSync, genSaltSync } = require("bcrypt");
const jwt = require('jsonwebtoken');
const User = require("../models/Users");
const Agent = require("../models/Agents");
const Admin = require("../models/Admin");
const Order = require("../models/Orders");

module.exports.signUp = async (req, res) => {
    try {
        const body = req.body;

        // ──────────────────────────────────────────────
        // 1. Required fields check
        // ──────────────────────────────────────────────
        const requiredFields = ['first_name', 'last_name', 'phone', 'password'];
        const missingFields = requiredFields.filter(f => !body[f] || !body[f].toString().trim());

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error_code: 'MISSING_FIELDS',
                message: `The following fields are required: ${missingFields.join(', ')}`,
                missing_fields: missingFields,
            });
        }

        const firstName = body.first_name.toString().trim();
        const lastName = body.last_name.toString().trim();
        const phone = body.phone.toString().trim();
        const password = body.password.toString().trim();

        // ──────────────────────────────────────────────
        // 2. Name validation
        // ──────────────────────────────────────────────
        if (firstName.length < 2 || firstName.length > 50) {
            return res.status(400).json({
                success: false,
                error_code: 'INVALID_FIRST_NAME',
                message: 'First name must be between 2 and 50 characters',
                field: 'first_name',
            });
        }

        if (lastName.length < 2 || lastName.length > 50) {
            return res.status(400).json({
                success: false,
                error_code: 'INVALID_LAST_NAME',
                message: 'Last name must be between 2 and 50 characters',
                field: 'last_name',
            });
        }

        // ──────────────────────────────────────────────
        // 3. Phone validation (Egyptian format)
        // ──────────────────────────────────────────────
        // Accepts: 01XXXXXXXXX, 201XXXXXXXXX, +201XXXXXXXXX
        const phoneDigitsOnly = phone.replace(/[^0-9]/g, '');
        const egyptPhoneRegex = /^(0?1[0-9]{9}|201[0-9]{9})$/;

        if (!egyptPhoneRegex.test(phoneDigitsOnly)) {
            return res.status(400).json({
                success: false,
                error_code: 'INVALID_PHONE_FORMAT',
                message: 'Please enter a valid Egyptian phone number (e.g. 01XXXXXXXXX)',
                field: 'phone',
            });
        }

        // ──────────────────────────────────────────────
        // 4. Password validation
        // ──────────────────────────────────────────────
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error_code: 'WEAK_PASSWORD',
                message: 'Password must be at least 6 characters long',
                field: 'password',
            });
        }

        // ──────────────────────────────────────────────
        // 5. Check if phone is already taken (as User)
        // ──────────────────────────────────────────────
        const isPhoneTaken = await User.isPhoneTaken(phone);
        if (isPhoneTaken) {
            return res.status(409).json({
                success: false,
                error_code: 'PHONE_ALREADY_REGISTERED',
                message: 'An account with this phone number already exists. Please log in instead.',
                field: 'phone',
            });
        }

        // ──────────────────────────────────────────────
        // 6. Check if phone belongs to another role (admin/agent/restaurant)
        // ──────────────────────────────────────────────
        const [admin, agent, restaurant] = await Promise.all([
            Admin.findOne({ phone: phone }),
            Agent.findOne({ phone: phone }),
            Restaurant.findOne({ phone: phone }),
        ]);

        if (admin || agent || restaurant) {
            return res.status(409).json({
                success: false,
                error_code: 'PHONE_USED_BY_OTHER_ROLE',
                message: 'This phone number is already associated with another account type. Please use a different number.',
                field: 'phone',
            });
        }

        // ──────────────────────────────────────────────
        // 7. Hash password and create user
        // ──────────────────────────────────────────────
        const salt = genSaltSync(10);
        const hashedPassword = hashSync(password, salt);

        const user = new User({
            first_name: firstName,
            last_name: lastName,
            phone: phone,
            password: hashedPassword,
            email: "N/A",
            token: body.token || null,
            ban: false,
        });

        await user.save();

        return res.status(201).json({
            success: true,
            message: 'Account created successfully',
        });

    } catch (error) {
        console.error('❌ Signup error:', error);

        // Handle Mongoose duplicate key error
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                error_code: 'PHONE_ALREADY_REGISTERED',
                message: 'An account with this phone number already exists.',
                field: 'phone',
            });
        }

        return res.status(500).json({
            success: false,
            error_code: 'SERVER_ERROR',
            message: 'An unexpected error occurred. Please try again later.',
        });
    }
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