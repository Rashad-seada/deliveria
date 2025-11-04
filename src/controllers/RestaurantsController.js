// RestaurantsController.js - الكود الكامل المصحح

const Restaurant = require("../models/Restaurants");
const Agent = require("../models/Agents");
const User = require("../models/Users");
const Admin = require("../models/Admin");
const Address = require("../models/Address");
const axios = require('axios');
const bcrypt = require("bcrypt");
const { hashSync, genSaltSync } = require("bcrypt");
const jwt = require('jsonwebtoken');
const { not_select, checkIsOpen, sendNotification } = require("./global");
const { setTimeout } = require('timers/promises');
const mongoose = require("mongoose");
const Order = require("../models/Orders");

// دالة استخراج الإحداثيات من أي رابط Google Maps
function extractCoordsFromFinalUrl(finalUrl) {
    const patterns = [
        /[?&]q=([-\d.]+),([-\d.]+)/,
        /@([-\d.]+),([-\d.]+)/,
        /\/search\/([-\d.]+),([-\d.]+)/,
        /!3d([-\d.]+)!4d([-\d.]+)/,
        /\/search\/([-\d.]+)\+([-\d.]+)/,
    ];

    for (const pattern of patterns) {
        const match = finalUrl.match(pattern);
        if (match) {
            return {
                latitude: parseFloat(match[1]),
                longitude: parseFloat(match[2])
            };
        }
    }
    return null;
}

// حساب المسافة
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// إنشاء مطعم
module.exports.createRestaurant = async (req, res) => {
    try {
        if (!req.decoded) return res.status(401).json({ message: "Unauthorized" });
        if (req.decoded.user_type !== "Admin") return res.status(403).json({ message: "Admin access required" });

        const phone = req.body.phone?.trim();
        if (!phone) return res.status(400).json({ message: "Phone is required" });

        const isNewRestaurant = await Restaurant.isThisUserNameUsed(phone);
        if (isNewRestaurant) return res.status(409).json({ message: "Phone already in use" });

        const agent = await Agent.findOne({ phone });
        const user = await User.findOne({ phone });
        const admin = await Admin.findOne({ phone });
        if (agent || user || admin) return res.status(409).json({ message: "Phone already registered" });

        const body = req.body;
        if (!req.files?.logo?.[0]?.path || !req.files?.photo?.[0]?.path) {
            return res.status(400).json({ message: "Both logo and photo are required" });
        }

        if (!body.location_map?.trim()) {
            return res.status(400).json({ message: "Location map URL is required" });
        }

        let coords;
        try {
            const response = await axios.get(body.location_map.trim(), { maxRedirects: 10 });
            const finalUrl = response.request.res.responseUrl;
            coords = extractCoordsFromFinalUrl(finalUrl);
        } catch (error) {
            console.error("Error fetching map URL:", error);
            return res.status(400).json({ message: "Invalid Google Maps URL" });
        }

        if (!coords) return res.status(400).json({ message: "Invalid Google Maps URL" });

        const password = body.password?.trim();
        if (!password) return res.status(400).json({ message: "Password is required" });
        const hashedPassword = hashSync(password, genSaltSync(10));

        const restaurant = new Restaurant({
            photo: req.files.photo[0].path,
            logo: req.files.logo[0].path,
            super_category: body.super_category,
            sub_category: body.sub_category,
            phone,
            name: body.name?.trim() || "Unnamed Restaurant",
            user_name: phone, // استخدام رقم الهاتف كاسم مستخدم فريد
            password: hashedPassword,
            about_us: body.about_us?.trim() || "",
            rate_number: 0,
            user_rated: 0,
            rate: 0,
            reviews: [],
            delivery_cost: body.delivery_cost || 0,
            location_map: body.location_map.trim(),
            coordinates: { latitude: coords.latitude, longitude: coords.longitude },
            open_hour: body.open_hour?.trim() || "00:00",
            close_hour: body.close_hour?.trim() || "23:59",
            have_delivery: body.have_delivery || false,
            is_show: true,
            is_show_in_home: true,
            estimated_time: body.estimated_time || 30
        });

        await restaurant.save();
        return res.status(201).json({ message: "Restaurant created successfully", restaurant: { id: restaurant._id, name: restaurant.name } });

    } catch (error) {
        console.error("createRestaurant error:", error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};

// تحديث مطعم
module.exports.updateRestaurant = async (req, res) => {
    try {
        // --- التحسين: التحقق من الصلاحيات ---
        if (!req.decoded) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const restaurantId = req.params.id;
        const isOwner = req.decoded.user_type === "Restaurant" && req.decoded.id === restaurantId;
        const isAdmin = req.decoded.user_type === "Admin";

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: "Forbidden: You do not have permission to update this restaurant." });
        }

        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });

        const updateData = {
            name: req.body.name?.trim() || restaurant.name,
            about_us: req.body.about_us?.trim() || restaurant.about_us,
            open_hour: req.body.open_hour?.trim() || restaurant.open_hour,
            close_hour: req.body.close_hour?.trim() || restaurant.close_hour,
        };

        if (req.files?.logo?.[0]?.path) updateData.logo = req.files.logo[0].path;
        if (req.files?.photo?.[0]?.path) updateData.photo = req.files.photo[0].path;

        const updatedRestaurant = await Restaurant.findByIdAndUpdate(restaurantId, { $set: updateData }, { new: true });
        return res.status(200).json({ message: "Restaurant updated successfully", restaurant: updatedRestaurant });

    } catch (error) {
        console.error("updateRestaurant error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// تسجيل الدخول
module.exports.login = async (req, res) => {
    try {
        const { phone, password } = req.body;
        if (!phone || !password) return res.status(400).json({ message: "Phone and password required" });

        const restaurant = await Restaurant.findOne({ phone });
        if (!restaurant) return res.status(401).json({ message: "Invalid credentials" });

        const isMatch = await bcrypt.compare(password, restaurant.password);
        if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

        const token = jwt.sign(
            { id: restaurant._id, phone: restaurant.phone, user_type: "Restaurant" },
            process.env.JWT_KEY,
            { expiresIn: '7d' }
        );

        restaurant.password = undefined;
        return res.status(200).json({ message: "Login successful", token, restaurant });

    } catch (error) {
        console.error("login error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// جلب جميع المطاعم
module.exports.getAllRestaurants = async (req, res) => {
    try {
        const restaurants = await Restaurant.find()
            .select(not_select.join(' '))
            .populate({ path: 'super_category', select: 'name_en name_ar logo' })
            .populate({ path: 'sub_category', select: 'name_en name_ar' });

        const result = restaurants.map(r => ({
            ...r.toObject(),
            is_open: checkIsOpen(r.open_hour, r.close_hour)
        }));

        return res.status(200).json({ response: result });
    } catch (error) {
        return res.status(500).json({ message: "Error", error: error.message });
    }
};

// الصفحة الرئيسية
module.exports.getHomeRestaurants = async (req, res) => {
    try {
        let { latitude, longitude } = req.params;
        
        if (!req.decoded) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        if (latitude === "0" || longitude === "0") {
            if (req.decoded.user_type === "User") {
                const user = await User.findById(req.decoded.id);
                if (user?.address_id) {
                    const address = await Address.findById(user.address_id);
                    if (address && address.coordinates) {
                        latitude = address.coordinates.latitude.toString();
                        longitude = address.coordinates.longitude.toString();
                    }
                }
            }
        }
        
        if (latitude === "0" || longitude === "0") {
            return res.status(400).json({ message: "Location required" });
        }

        const userLat = parseFloat(latitude);
        const userLon = parseFloat(longitude);
        
        if (isNaN(userLat) || isNaN(userLon)) {
            return res.status(400).json({ message: "Invalid coordinates" });
        }

        const restaurants = await Restaurant.find({ is_show: true, is_show_in_home: true })
            .populate({ path: 'super_category', select: 'name_en name_ar logo' })
            .populate({ path: 'sub_category', select: 'name_en name_ar' })
            .select(not_select.join(' '));

        const result = restaurants
            .map(r => {
                if (!r.coordinates || !r.coordinates.latitude || !r.coordinates.longitude) {
                    return null;
                }
                const distance = calculateDistance(userLat, userLon, r.coordinates.latitude, r.coordinates.longitude);
                return { 
                    ...r.toObject(), 
                    is_open: checkIsOpen(r.open_hour, r.close_hour), 
                    is_nearby: distance <= 10,
                    distance: distance
                };
            })
            .filter(r => r !== null && r.is_nearby);

        return res.status(200).json({ response: result });
    } catch (error) {
        console.error("getHomeRestaurants error:", error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};

// أعلى تقييم (Admin)
module.exports.getRestaurantsByRateAdmin = async (req, res) => {
    try {
        const restaurants = await Restaurant.find({ is_show: true })
            .populate({ path: 'super_category', select: 'name_en name_ar logo' })
            .populate({ path: 'sub_category', select: 'name_en name_ar' })
            .sort({ rate: -1 })
            .select(not_select.join(' '));

        const result = restaurants.map(r => ({
            ...r.toObject(),
            is_open: checkIsOpen(r.open_hour, r.close_hour)
        }));

        return res.status(200).json({ response: result });
    } catch (error) {
        return res.status(500).json({ message: "Error", error: error.message });
    }
};

// أعلى تقييم (User)
module.exports.getRestaurantsByRate = async (req, res) => {
    try {
        let { latitude, longitude } = req.params;
        
        if (!req.decoded) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        if (latitude === "0" || longitude === "0") {
            if (req.decoded.user_type === "User") {
                const user = await User.findById(req.decoded.id);
                if (user?.address_id) {
                    const address = await Address.findById(user.address_id);
                    if (address && address.coordinates) {
                        latitude = address.coordinates.latitude.toString();
                        longitude = address.coordinates.longitude.toString();
                    }
                }
            }
        }
        
        if (latitude === "0" || longitude === "0") {
            return res.status(400).json({ message: "Location required" });
        }

        const userLat = parseFloat(latitude);
        const userLon = parseFloat(longitude);
        
        if (isNaN(userLat) || isNaN(userLon)) {
            return res.status(400).json({ message: "Invalid coordinates" });
        }

        const restaurants = await Restaurant.find({ is_show: true })
            .populate({ path: 'super_category', select: 'name_en name_ar logo' })
            .populate({ path: 'sub_category', select: 'name_en name_ar' })
            .sort({ rate: -1 })
            .select(not_select.join(' '));

        const result = restaurants
            .map(r => {
                if (!r.coordinates || !r.coordinates.latitude || !r.coordinates.longitude) {
                    return null;
                }
                const distance = calculateDistance(userLat, userLon, r.coordinates.latitude, r.coordinates.longitude);
                return { 
                    ...r.toObject(), 
                    is_open: checkIsOpen(r.open_hour, r.close_hour), 
                    is_nearby: distance <= 10,
                    distance: distance
                };
            })
            .filter(r => r !== null && r.is_nearby);

        return res.status(200).json({ response: result });
    } catch (error) {
        console.error("getRestaurantsByRate error:", error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};

// البحث (User)
module.exports.searchRestaurant = async (req, res) => {
    try {
        const { latitude, longitude } = req.params;
        const { search_text } = req.body;

        if (!search_text) {
            return res.status(400).json({ message: "Search text is required" });
        }

        if (!req.decoded) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const userLat = parseFloat(latitude);
        const userLon = parseFloat(longitude);
        
        if (isNaN(userLat) || isNaN(userLon)) {
            return res.status(400).json({ message: "Invalid coordinates" });
        }

        const restaurants = await Restaurant.find({ 
            is_show: true,
            $or: [
                { name: { $regex: search_text, $options: 'i' } },
                { about_us: { $regex: search_text, $options: 'i' } }
            ]
        })
        .populate({ path: 'super_category', select: 'name_en name_ar logo' })
        .populate({ path: 'sub_category', select: 'name_en name_ar' })
        .select(not_select.join(' '));

        const result = restaurants
            .map(r => {
                if (!r.coordinates || !r.coordinates.latitude || !r.coordinates.longitude) {
                    return null;
                }
                const distance = calculateDistance(userLat, userLon, r.coordinates.latitude, r.coordinates.longitude);
                return { 
                    ...r.toObject(), 
                    is_open: checkIsOpen(r.open_hour, r.close_hour), 
                    is_nearby: distance <= 10,
                    distance: distance
                };
            })
            .filter(r => r !== null && r.is_nearby);

        return res.status(200).json({ response: result });
    } catch (error) {
        console.error("searchRestaurant error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// البحث (Admin)
module.exports.searchRestaurantAdmin = async (req, res) => {
    try {
        const { search_text } = req.body;

        if (!search_text) {
            return res.status(400).json({ message: "Search text is required" });
        }

        if (!req.decoded) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const restaurants = await Restaurant.find({
            $or: [
                { name: { $regex: search_text, $options: 'i' } },
                { phone: { $regex: search_text, $options: 'i' } },
                { about_us: { $regex: search_text, $options: 'i' } }
            ]
        })
        .populate({ path: 'super_category', select: 'name_en name_ar logo' })
        .populate({ path: 'sub_category', select: 'name_en name_ar' })
        .select(not_select.join(' '));

        const result = restaurants.map(r => ({
            ...r.toObject(),
            is_open: checkIsOpen(r.open_hour, r.close_hour)
        }));

        return res.status(200).json({ response: result });
    } catch (error) {
        console.error("searchRestaurantAdmin error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// حسب الفئة (User)
module.exports.getRestaurantsByCategory = async (req, res) => {
    try {
        const { super_category, sub_category, latitude, longitude } = req.params;
        
        if (!req.decoded) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const userLat = parseFloat(latitude);
        const userLon = parseFloat(longitude);
        
        if (isNaN(userLat) || isNaN(userLon)) {
            return res.status(400).json({ message: "Invalid coordinates" });
        }

        const query = { 
            is_show: true,
            super_category: super_category
        };

        if (sub_category && sub_category !== 'null') {
            query.sub_category = sub_category;
        }

        const restaurants = await Restaurant.find(query)
            .populate({ path: 'super_category', select: 'name_en name_ar logo' })
            .populate({ path: 'sub_category', select: 'name_en name_ar' })
            .select(not_select.join(' '));

        const result = restaurants
            .map(r => {
                if (!r.coordinates || !r.coordinates.latitude || !r.coordinates.longitude) {
                    return null;
                }
                const distance = calculateDistance(userLat, userLon, r.coordinates.latitude, r.coordinates.longitude);
                return { 
                    ...r.toObject(), 
                    is_open: checkIsOpen(r.open_hour, r.close_hour), 
                    is_nearby: distance <= 10,
                    distance: distance
                };
            })
            .filter(r => r !== null && r.is_nearby);

        return res.status(200).json({ response: result });
    } catch (error) {
        console.error("getRestaurantsByCategory error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// حسب الفئة (Admin)
module.exports.getRestaurantsByCategoryAdmin = async (req, res) => {
    try {
        const { super_category, sub_category } = req.params;
        
        if (!req.decoded) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const query = { 
            super_category: super_category
        };

        if (sub_category && sub_category !== 'null') {
            query.sub_category = sub_category;
        }

        const restaurants = await Restaurant.find(query)
            .populate({ path: 'super_category', select: 'name_en name_ar logo' })
            .populate({ path: 'sub_category', select: 'name_en name_ar' })
            .select(not_select.join(' '));

        const result = restaurants.map(r => ({
            ...r.toObject(),
            is_open: checkIsOpen(r.open_hour, r.close_hour)
        }));

        return res.status(200).json({ response: result });
    } catch (error) {
        console.error("getRestaurantsByCategoryAdmin error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// تغيير حالة الظهور
module.exports.changeShowRestaurant = async (req, res) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id);
        if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });

        restaurant.is_show = !restaurant.is_show;
        await restaurant.save();

        return res.status(200).json({ 
            message: `Restaurant ${restaurant.is_show ? 'shown' : 'hidden'} successfully` 
        });
    } catch (error) {
        console.error("changeShowRestaurant error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// تغيير الظهور في الصفحة الرئيسية
module.exports.changeShowInHomeRestaurant = async (req, res) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id);
        if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });

        restaurant.is_show_in_home = !restaurant.is_show_in_home;
        await restaurant.save();

        return res.status(200).json({ 
            message: `Restaurant ${restaurant.is_show_in_home ? 'shown in home' : 'hidden from home'} successfully` 
        });
    } catch (error) {
        console.error("changeShowInHomeRestaurant error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// تغيير حالة التوصيل
module.exports.changeHaveDelivery = async (req, res) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id);
        if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });

        restaurant.have_delivery = !restaurant.have_delivery;
        await restaurant.save();

        return res.status(200).json({ 
            message: `Delivery ${restaurant.have_delivery ? 'enabled' : 'disabled'} successfully` 
        });
    } catch (error) {
        console.error("changeHaveDelivery error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// حذف مطعم
module.exports.deleteRestaurant = async (req, res) => {
    try {
        const restaurant = await Restaurant.findByIdAndDelete(req.params.id);
        if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });

        return res.status(200).json({ message: "Restaurant deleted successfully" });
    } catch (error) {
        console.error("deleteRestaurant error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// إضافة تقييم
module.exports.addReview = async (req, res) => {
    try {
        const { restaurant_id, rate, review } = req.body;
        
        if (!restaurant_id || !rate) {
            return res.status(400).json({ message: "Restaurant ID and rate are required" });
        }

        if (!req.decoded) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const restaurant = await Restaurant.findById(restaurant_id);
        if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });

        const newReview = {
            user_id: req.decoded.id,
            user_type: req.decoded.user_type,
            rate: parseInt(rate),
            review: review || "",
            date: new Date()
        };

        restaurant.reviews.push(newReview);
        
        // تحديث متوسط التقييم
        const totalRate = restaurant.reviews.reduce((sum, rev) => sum + rev.rate, 0);
        restaurant.rate = totalRate / restaurant.reviews.length;
        restaurant.user_rated = restaurant.reviews.length;

        await restaurant.save();

        return res.status(200).json({ 
            message: "Review added successfully",
            new_rate: restaurant.rate
        });
    } catch (error) {
        console.error("addReview error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// طلبات المطعم
module.exports.myOrder = async (req, res) => {
    try {
        if (!req.decoded || req.decoded.user_type !== "Restaurant") {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const restaurantId = req.decoded.id;

        // جلب جميع الطلبات التي تحتوي على طلب فرعي لهذا المطعم
        const orders = await Order.find({ "orders.restaurant_id": restaurantId })
            .populate('user_id', 'first_name last_name')
            .sort({ createdAt: -1 });

        // فلترة الطلبات لتناسب المطعم
        const restaurantOrders = orders.map(order => {
            const subOrder = order.orders.find(so => so.restaurant_id.equals(restaurantId));
            return { ...order.toObject(), orders: [subOrder] }; // إرجاع الطلب مع الطلب الفرعي الخاص بالمطعم فقط
        }).filter(order => order.orders[0]); // التأكد من وجود الطلب الفرعي

        return res.status(200).json({ orders: restaurantOrders });

    } catch (error) {
        console.error("myOrder error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// قبول الطلب
module.exports.acceptOrder = async (req, res) => {
    try {
        if (!req.decoded || req.decoded.user_type !== "Restaurant") {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const restaurantId = req.decoded.id;
        const { orderId, subOrderId } = req.params;

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ message: "Order not found" });

        const subOrder = order.orders.id(subOrderId);
        if (!subOrder || !subOrder.restaurant_id.equals(restaurantId)) {
            return res.status(404).json({ message: "Sub-order not found for this restaurant" });
        }

        if (subOrder.status !== "Pending Approval") {
            return res.status(400).json({ message: `Cannot accept order, status is already "${subOrder.status}"` });
        }

        // تحديث حالة الطلب الفرعي إلى "جاري التجهيز"
        subOrder.status = "Preparing";
        order.status = "Preparing"; // تحديث الحالة الرئيسية أيضاً
        order.order_status = "Preparing";

        await order.save();

        // إرسال إشعار للمستخدم
        sendNotification([order.user_id], restaurantId, `Your order #${order.order_id} is now being prepared.`);

        return res.status(200).json({ message: "Order accepted and is now being prepared.", order });

    } catch (error) {
        console.error("acceptOrder error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// جاهز للاستلام
module.exports.readyOrderAgent = async (req, res) => {
    try {
        if (!req.decoded || req.decoded.user_type !== "Restaurant") {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const restaurantId = req.decoded.id;
        const { orderId, subOrderId } = req.params;

        const order = await Order.findOneAndUpdate(
            { "_id": orderId, "orders._id": subOrderId, "orders.restaurant_id": restaurantId },
            { "$set": { "orders.$.status": "Ready for Delivery", "status": "Ready for Delivery", "order_status": "Ready for Delivery" } },
            { new: true }
        );

        if (!order) return res.status(404).json({ message: "Order not found or not in 'Preparing' state" });

        sendNotification([order.user_id], restaurantId, `Your order #${order.order_id} is ready for pickup.`);

        return res.status(200).json({ message: "Order is ready for pickup.", order });
    } catch (error) {
        console.error("readyOrderAgent error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// دالة مؤقتة لمنع تعطل التطبيق بسبب مسار غير مستخدم
module.exports.preparingOrderAgent = async (req, res) => {
    // هذا المسار غير مستخدم حالياً. يمكنك إما إزالته من ملف المسارات أو تنفيذ المنطق المطلوب هنا.
    return res.status(501).json({ message: "Not Implemented" });
};

// دالة مؤقتة لمنع تعطل التطبيق
module.exports.changeStatusOfOrder = async (req, res) => {
    // هذا المسار غير مستخدم حالياً. يمكنك إما إزالته من ملف المسارات أو تنفيذ المنطق المطلوب هنا.
    return res.status(501).json({ message: "Not Implemented" });
};

// لوحة التحكم
module.exports.getDataOfRestaurant = async (req, res) => {
    try {
        if (!req.decoded) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const restaurant = await Restaurant.findById(req.decoded.id)
            .select(not_select.join(' '));

        if (!restaurant) {
            return res.status(404).json({ message: "Restaurant not found" });
        }

        // هنا يمكن إضافة إحصائيات إضافية
        const dashboardData = {
            restaurant: restaurant,
            total_orders: 0, // تحتاج إلى حساب الطلبات
            total_revenue: 0, // تحتاج إلى حساب الإيرادات
            average_rating: restaurant.rate,
            is_open: checkIsOpen(restaurant.open_hour, restaurant.close_hour)
        };

        return res.status(200).json({ response: dashboardData });
    } catch (error) {
        console.error("getDataOfRestaurant error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// أفضل المبيعات
module.exports.getBestSellerItems = async (req, res) => {
    try {
        if (!req.decoded) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // هنا سيتم جلب العناصر الأكثر مبيعاً
        // تحتاج إلى نموذج العناصر والطلبات
        return res.status(200).json({ response: [] });
    } catch (error) {
        console.error("getBestSellerItems error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};