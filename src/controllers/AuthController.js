const Restaurant = require("../models/Restaurants");
const bcrypt = require("bcrypt")
const { hashSync, genSaltSync } = require("bcrypt");
const jwt = require('jsonwebtoken');
const User = require("../models/Users");
const Agent = require("../models/Agents");
const Admin = require("../models/Admin");
const { registertoken } = require("./global");

module.exports.login = async (req, res, next) => {
    try {
        const { phone, password } = req.body;

        // Validate required fields
        if (!phone || !password) {
            return res.status(400).json({
                message: 'Phone and password are required'
            });
        }

        let entity, tokenPayload, responseKey;

        // Try to find as User first
        const user = await User.findOne({ phone: phone });
        if (user) {
            const isMatch = await bcrypt.compare(password, user.password);
            if (isMatch) {
                entity = user;
                tokenPayload = {
                    phone: user.phone,
                    id: user._id,
                    user_type: "User"
                };
                responseKey = 'user';
            }
        }

        // If not found as User, try as Restaurant
        if (!entity) {
            const restaurant = await Restaurant.findOne({ phone: phone });
            if (restaurant) {
                const isMatch = await bcrypt.compare(password, restaurant.password);
                if (isMatch) {
                    entity = restaurant;
                    tokenPayload = {
                        phone: restaurant.phone,
                        id: restaurant._id,
                        user_type: "Restaurant"
                    };
                    responseKey = 'restaurant';
                }
            }
        }

        if (!entity) {
            const agent = await Agent.findOne({ phone: phone });
            if (agent) {
                const isMatch = await bcrypt.compare(password, agent.password);
                if (isMatch) {
                    entity = agent;
                    tokenPayload = {
                        phone: agent.phone,
                        id: agent._id,
                        user_type: "Agent"
                    };
                    responseKey = 'agent';
                }
            }
        }

        if (!entity) {
            const admin = await Admin.findOne({ phone: phone });
            if (admin) {
                const isMatch = await bcrypt.compare(password, admin.password);
                if (isMatch) {
                    entity = admin;
                    tokenPayload = {
                        phone: admin.phone,
                        id: admin._id,
                        user_type: "Admin"
                    };
                    responseKey = 'admin';
                }
            }
        }

        // If no entity found or password didn't match
        if (!entity) {
            return res.status(401).json({
                message: 'Invalid phone or password'
            });
        }

        // Create token
        const token = jwt.sign(tokenPayload, process.env.JWT_KEY);
        entity.password = undefined;

        await registertoken(entity._id, req.body.FBtoken)
        // Return success response
        return res.status(200).json({
            message: 'Login Successful!',
            token: token,
            [responseKey]: entity,
            userType: responseKey // 'user' or 'restaurant'
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            message: 'An error occurred during login'
        });
    }
};

module.exports.getData = async (req, res, next) => {
    try {
        const { id, user_type } = req.decoded

        let entity, responseKey;

        if (!user_type) {
            return res.status(400).json({
                message: 'User is not found'
            });
        }

        if (user_type === "User") {
            entity = await User.findById(id)
            responseKey = "user"
        }

        if (user_type === "Agent") {
            entity = await Agent.findById(id)
            responseKey = "agent"
        }

        if (user_type === "Admin") {
            entity = await Admin.findById(id)
            responseKey = "admin"
        }

        if (user_type === "Restaurant") {
            entity = await Restaurant.findById(id)
            responseKey = "restaurant"
        }

        return res.status(200).json({
            [responseKey]: entity
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            message: 'An error occurred during login'
        });
    }
};