const bcrypt = require("bcrypt");
const { hashSync, genSaltSync } = require("bcrypt");
const jwt = require('jsonwebtoken');
const Agent = require("../models/Agents");
const Order = require("../models/Orders");
const Admin = require("../models/Admin");
const User = require("../models/Users");
const Restaurant = require("../models/Restaurants");
const { ORDER_STATUS } = require("../models/Orders");

// Create a new agent
module.exports.createAgent = async (req, res) => {
    try {
        const { name, phone, password } = req.body;

        // Check if phone number is already in use by another agent, admin, user, or restaurant
        const isAgent = await Agent.findOne({ phone });
        const isAdmin = await Admin.findOne({ phone });
        const isUser = await User.findOne({ phone });
        const isRestaurant = await Restaurant.findOne({ phone });

        if (isAgent || isAdmin || isUser || isRestaurant) {
            return res.status(400).json({
                success: false,
                message: 'This phone number is already in use. Please use a different one.'
            });
        }

        // Hash the password
        const salt = genSaltSync(10);
        const hashedPassword = hashSync(password, salt);

        // Create and save the new agent
        const agent = new Agent({
            name: name.trim(),
            phone: phone.trim(),
            password: hashedPassword,
            user_name: phone.trim(), // استخدام رقم الهاتف كاسم مستخدم فريد
            ban: false
        });

        await agent.save();

        return res.status(201).json({
            success: true,
            message: "Agent created successfully.",
            agentId: agent._id
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while creating the agent."
        });
    }
};

// Agent login
module.exports.login = async (req, res) => {
    try {
        const { phone, password } = req.body;

        const agent = await Agent.findOne({ phone });

        if (!agent) {
            return res.status(401).json({ message: 'Invalid phone number or password.' });
        }

        if (agent.ban) {
            return res.status(403).json({ message: 'This account has been banned.' });
        }

        const isMatch = await bcrypt.compare(password, agent.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid phone number or password.' });
        }

        const token = jwt.sign({ phone: agent.phone, id: agent._id, user_type: "Agent" }, process.env.JWT_KEY, { expiresIn: '1h' });

        agent.password = undefined; // Do not send password back

        return res.status(200).json({
            message: 'Login successful!',
            token,
            info: agent
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "An error occurred during login." });
    }
};

// Get all agents (for admin purposes)
module.exports.getAgents = async (req, res) => {
    try {
        const agents = await Agent.find().select('-password'); // Exclude passwords

        const agentsWithOrders = await Promise.all(
            agents.map(async (agent) => {
                // Fix: Use 'agent.agent_id' instead of 'delivery_id'
                // Filter for ACTIVE orders only (what they are carrying/delivering right now)
                const activeOrders = await Order.find({
                    "agent.agent_id": agent._id,
                    "order_status": {
                        $in: [ORDER_STATUS.ON_THE_WAY, ORDER_STATUS.READY_FOR_DELIVERY, ORDER_STATUS.APPROVED_PREPARING]
                    }
                })
                    .select('order_status final_price order_id') // Optimize: only needed fields
                    .lean();

                return {
                    ...agent.toObject(),
                    active_orders_count: activeOrders.length,
                    active_orders: activeOrders, // Optional: return the actual active orders list
                    // Removed 'orders' (history) to prevent payload bloat. 
                    // Use /agents/:id/orders?status=history for full history.
                };
            })
        );

        return res.json({ agents: agentsWithOrders });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error fetching agents." });
    }
};

// Get orders for a specific agent (for admin or agent him- or herself)
module.exports.getOrdersByAgentId = async (req, res) => {
    try {
        const agentId = req.params.id;
        const { status } = req.query; // 'active' or 'history'

        let query = { "agent.agent_id": agentId };

        if (status === 'active') {
            // "Delivering this moment": Orders that are assigned but not yet delivered or canceled
            // Typically: 'On the Way', 'Packed / Ready for Pickup', 'Approved / Preparing'
            query.order_status = {
                $in: [ORDER_STATUS.ON_THE_WAY, ORDER_STATUS.READY_FOR_DELIVERY, ORDER_STATUS.APPROVED_PREPARING]
            };
        } else if (status === 'history') {
            query.order_status = {
                $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELED]
            };
        }

        const orders = await Order.find(query)
            .populate('user_id', 'first_name last_name phone')
            .populate('orders.restaurant_id', 'logo name phone coordinates address')
            .sort({ createdAt: -1 }); // Newest first

        return res.json({ orders });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error fetching orders for this agent." });
    }
};

// Toggle ban status for an agent (for admin purposes)
module.exports.toggleAgentBan = async (req, res) => {
    try {
        const agent = await Agent.findById(req.params.id);
        if (!agent) {
            return res.status(404).json({ message: "Agent not found." });
        }

        agent.ban = !agent.ban;
        await agent.save();

        return res.status(200).json({
            message: `Agent has been ${agent.ban ? "banned" : "unbanned"}.`,
            banStatus: agent.ban,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error updating agent's ban status." });
    }
};