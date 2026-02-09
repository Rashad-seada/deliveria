/**
 * Statistics & Reporting Controller
 * Generates reports and statistics for restaurant owners and administrators
 */

const Order = require("../models/Orders");
const Restaurant = require("../models/Restaurants");
const Item = require("../models/Items");
const User = require("../models/Users");
const { ORDER_STATUS } = require("../models/Orders");

/**
 * Gets overall dashboard statistics
 */
module.exports.getDashboardStatistics = async (req, res) => {
    try {
        const { restaurantId, startDate, endDate } = req.query;

        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        let query = { ...dateFilter };
        if (restaurantId) {
            query["orders.restaurant_id"] = restaurantId;
        }

        const orders = await Order.find(query);
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, order) => sum + (order.final_price || 0), 0);

        const deliveredOrders = orders.filter(o => o.order_status === ORDER_STATUS.DELIVERED).length;
        const canceledOrders = orders.filter(o => o.order_status === ORDER_STATUS.CANCELED).length;
        const pendingOrders = orders.filter(o => [ORDER_STATUS.WAITING_FOR_APPROVAL, ORDER_STATUS.APPROVED_PREPARING, ORDER_STATUS.PACKED_READY_FOR_PICKUP, ORDER_STATUS.ON_THE_WAY].includes(o.order_status)).length;

        // New customers (first-time orders)
        const newCustomers = orders.reduce((acc, order) => {
            if (!acc.includes(order.user_id?.toString())) {
                acc.push(order.user_id?.toString());
            }
            return acc;
        }, []).length;

        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        const successRate = totalOrders > 0 ? ((deliveredOrders / totalOrders) * 100).toFixed(2) : 0;

        return res.json({
            period: { start: startDate, end: endDate },
            statistics: {
                total_orders: totalOrders,
                total_revenue: Math.round(totalRevenue * 100) / 100,
                delivered_orders: deliveredOrders,
                canceled_orders: canceledOrders,
                pending_orders: pendingOrders,
                new_customers: newCustomers,
                average_order_value: Math.round(avgOrderValue * 100) / 100,
                success_rate: `${successRate}%`
            }
        });
    } catch (error) {
        console.error("Error getting dashboard statistics:", error);
        return res.status(500).json({ message: "Error getting dashboard statistics", error: error.message });
    }
};

/**
 * Gets revenue report
 */
module.exports.getRevenueReport = async (req, res) => {
    try {
        const { restaurantId, startDate, endDate, groupBy = 'daily' } = req.query;

        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        let query = { ...dateFilter, order_status: ORDER_STATUS.DELIVERED };
        if (restaurantId) {
            query["orders.restaurant_id"] = restaurantId;
        }

        const orders = await Order.find(query).sort({ createdAt: 1 });

        // Group by period
        const revenue = {};
        orders.forEach(order => {
            let key;
            const date = new Date(order.createdAt);

            switch (groupBy) {
                case 'daily':
                    key = date.toISOString().split('T')[0];
                    break;
                case 'weekly':
                    const week = Math.ceil(date.getDate() / 7);
                    key = `${date.getFullYear()}-W${week}`;
                    break;
                case 'monthly':
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    break;
                default:
                    key = date.toISOString().split('T')[0];
            }

            if (!revenue[key]) {
                revenue[key] = { date: key, revenue: 0, orders: 0 };
            }
            revenue[key].revenue += order.final_price || 0;
            revenue[key].orders += 1;
        });

        const revenueData = Object.values(revenue).map(item => ({
            ...item,
            revenue: Math.round(item.revenue * 100) / 100
        }));

        return res.json({
            period: { start: startDate, end: endDate },
            grouped_by: groupBy,
            total_revenue: revenueData.reduce((sum, item) => sum + item.revenue, 0),
            data: revenueData
        });
    } catch (error) {
        console.error("Error getting revenue report:", error);
        return res.status(500).json({ message: "Error getting revenue report", error: error.message });
    }
};

/**
 * Gets top selling products report
 */
module.exports.getTopSellingProducts = async (req, res) => {
    try {
        const { restaurantId, limit = 10, startDate, endDate } = req.query;

        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        let query = { ...dateFilter };
        if (restaurantId) {
            query["orders.restaurant_id"] = restaurantId;
        }

        const orders = await Order.find(query);

        // Count item occurrences
        const itemCounts = {};
        orders.forEach(order => {
            order.orders.forEach(subOrder => {
                subOrder.items.forEach(item => {
                    const itemId = item.item_details.item_id;
                    const itemName = item.item_details.name;

                    if (!itemCounts[itemId]) {
                        itemCounts[itemId] = {
                            item_id: itemId,
                            name: itemName,
                            quantity: 0,
                            revenue: 0
                        };
                    }
                    itemCounts[itemId].quantity += item.size_details.quantity || 1;
                    itemCounts[itemId].revenue += item.total_price || 0;
                });
            });
        });

        // Convert to array and sort by quantity
        const topItems = Object.values(itemCounts)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, parseInt(limit));

        return res.json({
            count: topItems.length,
            items: topItems.map(item => ({
                ...item,
                revenue: Math.round(item.revenue * 100) / 100
            }))
        });
    } catch (error) {
        console.error("Error getting top selling products:", error);
        return res.status(500).json({ message: "Error getting top selling products", error: error.message });
    }
};

/**
 * Gets order status distribution
 */
module.exports.getOrderStatusDistribution = async (req, res) => {
    try {
        const { restaurantId, startDate, endDate } = req.query;

        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        let query = { ...dateFilter };
        if (restaurantId) {
            query["orders.restaurant_id"] = restaurantId;
        }

        const orders = await Order.find(query);

        const distribution = {
            [ORDER_STATUS.WAITING_FOR_APPROVAL]: 0,
            [ORDER_STATUS.APPROVED_PREPARING]: 0,
            [ORDER_STATUS.PACKED_READY_FOR_PICKUP]: 0,
            [ORDER_STATUS.ON_THE_WAY]: 0,
            [ORDER_STATUS.DELIVERED]: 0,
            [ORDER_STATUS.CANCELED]: 0
        };

        orders.forEach(order => {
            distribution[order.order_status] = (distribution[order.order_status] || 0) + 1;
        });

        return res.json({
            total_orders: orders.length,
            distribution
        });
    } catch (error) {
        console.error("Error getting order status distribution:", error);
        return res.status(500).json({ message: "Error getting order status distribution", error: error.message });
    }
};

/**
 * Gets customer analysis
 */
module.exports.getCustomerAnalysis = async (req, res) => {
    try {
        const { restaurantId, startDate, endDate } = req.query;

        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        let query = { ...dateFilter };
        if (restaurantId) {
            query["orders.restaurant_id"] = restaurantId;
        }

        const orders = await Order.find(query).populate('user_id', 'first_name last_name email phone');

        // Get unique customers
        const customerMap = new Map();
        orders.forEach(order => {
            if (order.user_id) {
                const customerId = order.user_id._id.toString();
                if (!customerMap.has(customerId)) {
                    customerMap.set(customerId, {
                        customer_id: customerId,
                        name: `${order.user_id.first_name} ${order.user_id.last_name}`,
                        email: order.user_id.email,
                        phone: order.user_id.phone,
                        total_orders: 0,
                        total_spent: 0,
                        last_order: null
                    });
                }
                const customer = customerMap.get(customerId);
                customer.total_orders += 1;
                customer.total_spent += order.final_price || 0;
                customer.last_order = order.createdAt;
            }
        });

        const customers = Array.from(customerMap.values())
            .sort((a, b) => b.total_spent - a.total_spent)
            .map(customer => ({
                ...customer,
                total_spent: Math.round(customer.total_spent * 100) / 100,
                average_order_value: Math.round((customer.total_spent / customer.total_orders) * 100) / 100
            }));

        return res.json({
            total_unique_customers: customers.length,
            customers
        });
    } catch (error) {
        console.error("Error getting customer analysis:", error);
        return res.status(500).json({ message: "Error getting customer analysis", error: error.message });
    }
};

/**
 * Gets delivery performance report
 */
module.exports.getDeliveryPerformance = async (req, res) => {
    try {
        const { restaurantId, startDate, endDate } = req.query;

        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        let query = { ...dateFilter, order_status: ORDER_STATUS.DELIVERED };
        if (restaurantId) {
            query["orders.restaurant_id"] = restaurantId;
        }

        const orders = await Order.find(query);

        let totalDeliveryTime = 0;
        let deliveryCount = 0;
        const deliveryTimes = [];

        orders.forEach(order => {
            if (order.agent?.pickup_time && order.agent?.delivery_time) {
                const time = (order.agent.delivery_time - order.agent.pickup_time) / (1000 * 60); // in minutes
                totalDeliveryTime += time;
                deliveryCount += 1;
                deliveryTimes.push(time);
            }
        });

        const avgDeliveryTime = deliveryCount > 0 ? totalDeliveryTime / deliveryCount : 0;
        const medianDeliveryTime = deliveryTimes.length > 0
            ? deliveryTimes.sort((a, b) => a - b)[Math.floor(deliveryTimes.length / 2)]
            : 0;

        return res.json({
            total_deliveries: orders.length,
            average_delivery_time_minutes: Math.round(avgDeliveryTime),
            median_delivery_time_minutes: Math.round(medianDeliveryTime),
            on_time_deliveries: orders.filter(o => avgDeliveryTime && o.delivery_details?.estimated_time >= avgDeliveryTime).length
        });
    } catch (error) {
        console.error("Error getting delivery performance:", error);
        return res.status(500).json({ message: "Error getting delivery performance", error: error.message });
    }
};

/**
 * Exports report to CSV format
 */
module.exports.exportReport = async (req, res) => {
    try {
        const { reportType, restaurantId, startDate, endDate } = req.query;

        // Get report data based on type
        let reportData = [];
        let headers = [];

        switch (reportType) {
            case 'orders':
                let query = { order_status: ORDER_STATUS.DELIVERED };
                if (restaurantId) query["orders.restaurant_id"] = restaurantId;
                if (startDate && endDate) {
                    query.createdAt = {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    };
                }

                const orders = await Order.find(query)
                    .populate('user_id', 'first_name last_name')
                    .populate('orders.restaurant_id', 'name');

                headers = ['Order ID', 'Date', 'Customer', 'Restaurant', 'Amount', 'Status'];
                reportData = orders.map(order => [
                    order.order_id,
                    order.createdAt.toISOString().split('T')[0],
                    order.user_id ? `${order.user_id.first_name} ${order.user_id.last_name}` : 'N/A',
                    order.orders[0]?.restaurant_id?.name || 'N/A',
                    order.final_price,
                    order.order_status
                ]);
                break;

            default:
                return res.status(400).json({ message: "Invalid report type" });
        }

        // Create CSV
        let csv = headers.join(',') + '\n';
        reportData.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="report_${new Date().getTime()}.csv"`);
        res.send(csv);

    } catch (error) {
        console.error("Error exporting report:", error);
        return res.status(500).json({ message: "Error exporting report", error: error.message });
    }
};
