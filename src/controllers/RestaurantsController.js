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
const { startOrderTimers } = require("./DeliveryController");
const { setTimeout } = require('timers/promises');
const mongoose = require("mongoose");
const Order = require("../models/Orders");
const Item = require("../models/Items");

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

        // Validate commission_percentage
        let commissionPercentage = parseFloat(body.commission_percentage) || 0;
        if (commissionPercentage < 0) commissionPercentage = 0;
        if (commissionPercentage > 100) commissionPercentage = 100;

        // Validate preparation_time
        let preparationTime = parseInt(body.preparation_time) || 15;
        if (preparationTime < 0) preparationTime = 15;

        // Validate delivery_time
        let deliveryTime = parseInt(body.delivery_time) || 30;
        if (deliveryTime < 0) deliveryTime = 30;

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
            estimated_time: body.estimated_time || 30,
            commission_percentage: commissionPercentage,
            preparation_time: preparationTime,
            delivery_time: deliveryTime
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
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const restaurantId = req.params.id;
        const isOwner = req.decoded.user_type === "Restaurant" && req.decoded.id === restaurantId;
        const isAdmin = req.decoded.user_type === "Admin";

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ success: false, message: "Forbidden: You do not have permission to update this restaurant." });
        }

        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) {
            return res.status(404).json({ success: false, message: "Restaurant not found" });
        }

        const updateData = {};

        // Fields editable by both Admin and Owner
        if (req.body.name?.trim()) updateData.name = req.body.name.trim();
        if (req.body.about_us?.trim()) updateData.about_us = req.body.about_us.trim();
        if (req.body.open_hour?.trim()) updateData.open_hour = req.body.open_hour.trim();
        if (req.body.close_hour?.trim()) updateData.close_hour = req.body.close_hour.trim();

        // Handle coordinates update (both can update)
        if (req.body.latitude !== undefined && req.body.longitude !== undefined) {
            const lat = parseFloat(req.body.latitude);
            const lng = parseFloat(req.body.longitude);
            if (!isNaN(lat) && !isNaN(lng)) {
                updateData.coordinates = { latitude: lat, longitude: lng };
            }
        }

        // Handle location_map URL update
        if (req.body.location_map?.trim()) {
            updateData.location_map = req.body.location_map.trim();
            // Try to extract coordinates from Google Maps URL
            try {
                const response = await axios.get(req.body.location_map.trim(), { maxRedirects: 10 });
                const finalUrl = response.request.res.responseUrl;
                const coords = extractCoordsFromFinalUrl(finalUrl);
                if (coords) {
                    updateData.coordinates = { latitude: coords.latitude, longitude: coords.longitude };
                }
            } catch (err) {
                console.log("Could not extract coordinates from URL:", err.message);
            }
        }

        // Handle phone update (admin only to prevent abuse)
        if (isAdmin && req.body.phone?.trim()) {
            const newPhone = req.body.phone.trim();
            // Check if new phone is already in use by another restaurant
            const existingRestaurant = await Restaurant.findOne({ phone: newPhone, _id: { $ne: restaurantId } });
            if (existingRestaurant) {
                return res.status(409).json({ success: false, message: "Phone number already in use by another restaurant" });
            }
            updateData.phone = newPhone;
            updateData.user_name = newPhone; // Keep user_name in sync
        }

        // Handle categories update
        if (req.body.super_category) {
            try {
                const superCats = typeof req.body.super_category === 'string'
                    ? JSON.parse(req.body.super_category)
                    : req.body.super_category;
                if (Array.isArray(superCats) && superCats.length > 0) {
                    updateData.super_category = superCats;
                }
            } catch (e) {
                console.log("Error parsing super_category:", e.message);
            }
        }

        if (req.body.sub_category) {
            try {
                const subCats = typeof req.body.sub_category === 'string'
                    ? JSON.parse(req.body.sub_category)
                    : req.body.sub_category;
                if (Array.isArray(subCats) && subCats.length > 0) {
                    updateData.sub_category = subCats;
                }
            } catch (e) {
                console.log("Error parsing sub_category:", e.message);
            }
        }

        // Admin-only fields
        if (isAdmin) {
            if (req.body.commission_percentage !== undefined) {
                let commission = parseFloat(req.body.commission_percentage);
                if (!isNaN(commission)) {
                    if (commission < 0) commission = 0;
                    if (commission > 100) commission = 100;
                    updateData.commission_percentage = commission;
                }
            }
            if (req.body.preparation_time !== undefined) {
                let prepTime = parseInt(req.body.preparation_time);
                if (!isNaN(prepTime) && prepTime > 0) {
                    updateData.preparation_time = prepTime;
                }
            }
            if (req.body.delivery_time !== undefined) {
                let delTime = parseInt(req.body.delivery_time);
                if (!isNaN(delTime) && delTime > 0) {
                    updateData.delivery_time = delTime;
                }
            }
            if (req.body.delivery_cost !== undefined) {
                const cost = parseFloat(req.body.delivery_cost);
                if (!isNaN(cost) && cost >= 0) {
                    updateData.delivery_cost = cost;
                }
            }
            if (req.body.estimated_time !== undefined) {
                const estTime = parseInt(req.body.estimated_time);
                if (!isNaN(estTime) && estTime > 0) {
                    updateData.estimated_time = estTime;
                }
            }
            // Admin can toggle visibility
            if (req.body.is_show !== undefined) {
                updateData.is_show = req.body.is_show === true || req.body.is_show === 'true';
            }
            if (req.body.is_show_in_home !== undefined) {
                updateData.is_show_in_home = req.body.is_show_in_home === true || req.body.is_show_in_home === 'true';
            }
            if (req.body.have_delivery !== undefined) {
                updateData.have_delivery = req.body.have_delivery === true || req.body.have_delivery === 'true';
            }
        }

        // Handle image uploads
        if (req.files?.logo?.[0]?.path) updateData.logo = req.files.logo[0].path;
        if (req.files?.photo?.[0]?.path) updateData.photo = req.files.photo[0].path;

        // Check if there's anything to update
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ success: false, message: "No valid fields to update" });
        }

        const updatedRestaurant = await Restaurant.findByIdAndUpdate(
            restaurantId,
            { $set: updateData },
            { new: true }
        ).select('-password');

        return res.status(200).json({
            success: true,
            message: "Restaurant updated successfully",
            data: updatedRestaurant
        });

    } catch (error) {
        console.error("updateRestaurant error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
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

        // Guest Mode Support: Use address only if user is logged in
        if (req.decoded && (latitude === "0" || longitude === "0")) {
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

        const restaurants = await Restaurant.find({ is_show: true, is_show_in_home: true, parent_restaurant_id: null })
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

        // Guest Mode Support
        if (req.decoded && (latitude === "0" || longitude === "0")) {
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

        const restaurants = await Restaurant.find({ is_show: true, parent_restaurant_id: null })
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

        // Guest Mode Support: Removed mandatory auth check
        // if (!req.decoded) { return res.status(401).json({ message: "Unauthorized" }); }

        const userLat = parseFloat(latitude);
        const userLon = parseFloat(longitude);

        if (isNaN(userLat) || isNaN(userLon)) {
            return res.status(400).json({ message: "Invalid coordinates" });
        }

        const restaurants = await Restaurant.find({
            is_show: true,
            parent_restaurant_id: null,
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

        // Guest Mode Support: Removed mandatory auth check
        // if (!req.decoded) { return res.status(401).json({ message: "Unauthorized" }); }

        const userLat = parseFloat(latitude);
        const userLon = parseFloat(longitude);

        if (isNaN(userLat) || isNaN(userLon)) {
            return res.status(400).json({ message: "Invalid coordinates" });
        }

        const query = {
            is_show: true,
            parent_restaurant_id: null,
            super_category: super_category
        };

        if (sub_category && sub_category !== 'null' && sub_category !== 'all' && sub_category !== 'undefined') {
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

// حذف مطعم (Soft Delete - Admin Only)
module.exports.deleteRestaurant = async (req, res) => {
    try {
        if (!req.decoded) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        // Only admin can delete restaurants
        if (req.decoded.user_type !== "Admin") {
            return res.status(403).json({ success: false, message: "Admin access required" });
        }

        const restaurant = await Restaurant.findById(req.params.id);
        if (!restaurant) {
            return res.status(404).json({ success: false, message: "Restaurant not found" });
        }

        // Soft delete - set status to Inactive and hide
        await Restaurant.findByIdAndUpdate(req.params.id, {
            $set: {
                status: "Inactive",
                is_show: false,
                is_show_in_home: false
            }
        });

        return res.status(200).json({
            success: true,
            message: "Restaurant deactivated successfully"
        });
    } catch (error) {
        console.error("deleteRestaurant error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

// Upload restaurant photo
module.exports.uploadPhoto = async (req, res) => {
    try {
        if (!req.decoded) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const restaurantId = req.params.id;
        const isOwner = req.decoded.user_type === "Restaurant" && req.decoded.id === restaurantId;
        const isAdmin = req.decoded.user_type === "Admin";

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ success: false, message: "Forbidden: You do not have permission to update this restaurant." });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: "Photo file is required" });
        }

        const restaurant = await Restaurant.findByIdAndUpdate(
            restaurantId,
            { $set: { photo: req.file.path } },
            { new: true }
        ).select('-password');

        if (!restaurant) {
            return res.status(404).json({ success: false, message: "Restaurant not found" });
        }

        return res.status(200).json({
            success: true,
            message: "Photo updated successfully",
            data: { photo: restaurant.photo }
        });
    } catch (error) {
        console.error("uploadPhoto error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

// Upload restaurant logo
module.exports.uploadLogo = async (req, res) => {
    try {
        if (!req.decoded) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const restaurantId = req.params.id;
        const isOwner = req.decoded.user_type === "Restaurant" && req.decoded.id === restaurantId;
        const isAdmin = req.decoded.user_type === "Admin";

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ success: false, message: "Forbidden: You do not have permission to update this restaurant." });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: "Logo file is required" });
        }

        const restaurant = await Restaurant.findByIdAndUpdate(
            restaurantId,
            { $set: { logo: req.file.path } },
            { new: true }
        ).select('-password');

        if (!restaurant) {
            return res.status(404).json({ success: false, message: "Restaurant not found" });
        }

        return res.status(200).json({
            success: true,
            message: "Logo updated successfully",
            data: { logo: restaurant.logo }
        });
    } catch (error) {
        console.error("uploadLogo error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
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

        // Fetch all orders for this restaurant (Parent ID).
        // Since branches dont log in, we query by parent restaurant_id.
        // We populate branch info so the owner sees it.
        const orders = await Order.find({ "orders.restaurant_id": restaurantId })
            .populate('user_id', 'first_name last_name')
            .populate('orders.branch_id', 'branch_name name')
            .populate('orders.restaurant_id', 'name logo')
            .sort({ createdAt: -1 });

        const restaurantOrders = orders.map(order => {
            const subOrder = order.orders.find(so => so.restaurant_id.equals(restaurantId));
            if (subOrder) return { ...order.toObject(), orders: [subOrder] };
            return null;
        }).filter(order => order !== null);

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

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        const subOrder = order.orders.id(subOrderId);
        if (!subOrder || !subOrder.restaurant_id.equals(restaurantId)) {
            return res.status(404).json({ message: "Sub-order not found for this restaurant" });
        }

        if (subOrder.status !== "Preparing") {
            return res.status(400).json({ message: `Cannot mark order as ready, status is already "${subOrder.status}"` });
        }

        // Update the specific sub-order status
        subOrder.status = "Ready for Delivery";

        // Check if all other sub-orders are also ready
        const allSubOrdersReady = order.orders.every(so => so.status === "Ready for Delivery" || so.status === "Canceled");

        if (allSubOrdersReady) {
            // If all are ready, update the main order status
            order.status = "Ready for Delivery";
            order.order_status = "Ready for Delivery";

            // Notify the user that the entire order is ready for pickup
            sendNotification([order.user_id], restaurantId, `Your order #${order.order_id} is fully ready for pickup.`);

            // Start the timer to notify admins if the order is not accepted by an agent soon
            startOrderTimers(order);
        } else {
            // If not all sub-orders are ready, just send a notification for the part that is ready
            sendNotification([order.user_id], restaurantId, `A part of your order #${order.order_id} is ready for pickup.`);
        }

        const savedOrder = await order.save();

        return res.status(200).json({ message: "Order status updated.", order: savedOrder });

    } catch (error) {
        console.error("readyOrderAgent error:", error);
        return res.status(500).json({ message: "Server error" });
    }
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

// أفضل المبيعات - Best Seller Items for a specific restaurant
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

/**
 * GET /restaurants/best_sellers/:latitude/:longitude
 * Get top 10 best-selling restaurants based on completed order count
 * 
 * Query Parameters:
 *   - limit (optional): Number of restaurants to return, default 10
 * 
 * Response:
 * {
 *   "success": true,
 *   "restaurants": [
 *     {
 *       "_id": "abc123",
 *       "name": "Restaurant Name",
 *       "logo": "uploads/logo.jpg",
 *       "photo": "uploads/photo.jpg",
 *       "rate": 4.5,
 *       "rating": 4.5,
 *       "is_open": true,
 *       "distance": 2.5,
 *       "total_orders": 150,
 *       "rank": 1
 *     }
 *   ]
 * }
 */
module.exports.getBestSellerRestaurants = async (req, res) => {
    try {
        // Guest Mode Support: Removed mandatory auth check
        // if (!req.decoded) { return res.status(401).json({ message: "Unauthorized" }); }

        const { latitude, longitude } = req.params;
        const limit = parseInt(req.query.limit) || 10;

        const userLat = parseFloat(latitude);
        const userLon = parseFloat(longitude);

        if (isNaN(userLat) || isNaN(userLon)) {
            return res.status(400).json({
                success: false,
                message: "Invalid coordinates. latitude and longitude are required."
            });
        }

        // Aggregation pipeline to find restaurants with most completed orders
        const bestSellers = await Order.aggregate([
            // Step 1: Match only completed/delivered orders
            {
                $match: {
                    status: { $in: ["Completed", "Delivered"] }
                }
            },
            // Step 2: Unwind the orders array to get individual restaurant orders
            { $unwind: "$orders" },
            // Step 3: Filter out canceled sub-orders
            {
                $match: {
                    "orders.status": { $nin: ["Canceled"] }
                }
            },
            // Step 4: Group by restaurant_id and count orders
            {
                $group: {
                    _id: "$orders.restaurant_id",
                    total_orders: { $sum: 1 },
                    total_revenue: { $sum: "$orders.price_of_restaurant" }
                }
            },
            // Step 5: Sort by total orders descending
            { $sort: { total_orders: -1 } },
            // Step 6: Limit to top N
            { $limit: limit * 2 }, // Get more to filter by distance later
            // Step 7: Lookup restaurant details
            {
                $lookup: {
                    from: "restaurants",
                    localField: "_id",
                    foreignField: "_id",
                    as: "restaurant"
                }
            },
            // Step 8: Unwind restaurant
            { $unwind: "$restaurant" },
            // Step 9: Filter only visible restaurants
            {
                $match: {
                    "restaurant.is_show": true,
                    "restaurant.parent_restaurant_id": null
                }
            },
            // Step 10: Project final shape
            {
                $project: {
                    _id: "$restaurant._id",
                    name: "$restaurant.name",
                    logo: "$restaurant.logo",
                    photo: "$restaurant.photo",
                    rate: "$restaurant.rate",
                    rating: "$restaurant.rate",
                    open_hour: "$restaurant.open_hour",
                    close_hour: "$restaurant.close_hour",
                    coordinates: "$restaurant.coordinates",
                    delivery_cost: "$restaurant.delivery_cost",
                    estimated_time: "$restaurant.estimated_time",
                    have_delivery: "$restaurant.have_delivery",
                    about_us: "$restaurant.about_us",
                    total_orders: 1,
                    total_revenue: 1
                }
            }
        ]);

        // Filter by distance, add is_open status, and add rank
        let rank = 0;
        const result = bestSellers
            .map(r => {
                if (!r.coordinates || !r.coordinates.latitude || !r.coordinates.longitude) {
                    return null;
                }
                const distance = calculateDistance(userLat, userLon, r.coordinates.latitude, r.coordinates.longitude);
                if (distance > 10) return null; // Filter out restaurants beyond 10km

                return {
                    ...r,
                    is_open: checkIsOpen(r.open_hour, r.close_hour),
                    distance: Math.round(distance * 10) / 10, // Round to 1 decimal
                    is_nearby: true
                };
            })
            .filter(r => r !== null)
            .slice(0, limit) // Limit after distance filtering
            .map(r => {
                rank++;
                return { ...r, rank };
            });

        return res.status(200).json({
            success: true,
            count: result.length,
            restaurants: result
        });

    } catch (error) {
        console.error("getBestSellerRestaurants error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

// =====================================================
// OFFERS ENDPOINTS - العروض والخصومات
// =====================================================

/**
 * Helper function to check if an item has active offers
 * An item has an active offer if: offer > 0 && offer < 100 for any of its sizes
 */
const itemHasActiveOffer = (item) => {
    if (!item.sizes || !Array.isArray(item.sizes)) return false;
    return item.sizes.some(size => size.offer > 0 && size.offer < 100);
};

/**
 * GET /restaurants/with_offers
 * Get list of restaurants that have at least one item with an active offer
 */
module.exports.getRestaurantsWithOffers = async (req, res) => {
    try {
        // Guest Mode Support: Removed mandatory auth check
        // if (!req.decoded) { return res.status(401).json({ message: "Unauthorized" }); }

        const { latitude, longitude } = req.params;
        const limit = parseInt(req.query.limit) || 10;

        const userLat = parseFloat(latitude);
        const userLon = parseFloat(longitude);

        if (isNaN(userLat) || isNaN(userLon)) {
            return res.status(400).json({ message: "Invalid coordinates. lat and long are required." });
        }

        // Aggregation pipeline to find restaurants with active offers
        const restaurantsWithOffers = await Item.aggregate([
            // Step 1: Match items that have active offers and are enabled
            {
                $match: {
                    enable: { $ne: false },
                    "sizes.offer": { $gt: 0, $lt: 100 }
                }
            },
            // Step 2: Unwind sizes to calculate max discount
            { $unwind: "$sizes" },
            // Step 3: Filter only sizes with active offers
            {
                $match: {
                    "sizes.offer": { $gt: 0, $lt: 100 }
                }
            },
            // Step 4: Group by restaurant to get offers count and max discount
            {
                $group: {
                    _id: "$restaurant_id",
                    offers_count: { $sum: 1 },
                    max_discount: { $max: "$sizes.offer" }
                }
            },
            // Step 5: Lookup restaurant details
            {
                $lookup: {
                    from: "restaurants",
                    localField: "_id",
                    foreignField: "_id",
                    as: "restaurant"
                }
            },
            // Step 6: Unwind restaurant (should be single document)
            { $unwind: "$restaurant" },
            // Step 7: Filter out closed/hidden restaurants
            {
                $match: {
                    "restaurant.is_show": true,
                    "restaurant.parent_restaurant_id": null
                }
            },
            // Step 8: Sort by offers_count descending
            { $sort: { offers_count: -1 } },
            // Step 9: Limit results
            { $limit: limit },
            // Step 10: Project final shape
            {
                $project: {
                    _id: "$restaurant._id",
                    name: "$restaurant.name",
                    logo: "$restaurant.logo",
                    photo: "$restaurant.photo",
                    rate: "$restaurant.rate",
                    rating: "$restaurant.rate", // Explicitly mapping for frontend compatibility
                    open_hour: "$restaurant.open_hour",
                    close_hour: "$restaurant.close_hour",
                    coordinates: "$restaurant.coordinates",
                    delivery_cost: "$restaurant.delivery_cost",
                    estimated_time: "$restaurant.estimated_time",
                    have_delivery: "$restaurant.have_delivery",
                    has_offers: { $literal: true },
                    offers_count: 1,
                    max_discount: 1
                }
            }
        ]);

        // Filter by distance and add is_open status
        const result = restaurantsWithOffers
            .map(r => {
                if (!r.coordinates || !r.coordinates.latitude || !r.coordinates.longitude) {
                    return null;
                }
                const distance = calculateDistance(userLat, userLon, r.coordinates.latitude, r.coordinates.longitude);
                return {
                    ...r,
                    is_open: checkIsOpen(r.open_hour, r.close_hour),
                    is_nearby: distance <= 10,
                    distance: distance
                };
            })
            .filter(r => r !== null && r.is_nearby);

        return res.status(200).json({
            success: true,
            restaurants: result
        });

    } catch (error) {
        console.error("getRestaurantsWithOffers error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

/**
 * GET /restaurants/:id/offers
 * Get all items with active offers for a specific restaurant
 */
module.exports.getRestaurantOffers = async (req, res) => {
    try {
        // Guest Mode Support: Removed mandatory auth check
        // if (!req.decoded) { return res.status(401).json({ message: "Unauthorized" }); }

        const restaurantId = req.params.id;

        // Validate restaurant ID
        if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
            return res.status(400).json({ success: false, message: "Invalid restaurant ID" });
        }

        // Get restaurant info
        const restaurant = await Restaurant.findById(restaurantId)
            .select('_id name');

        if (!restaurant) {
            return res.status(404).json({ success: false, message: "Restaurant not found" });
        }

        // Find all enabled items with active offers for this restaurant
        const items = await Item.find({
            restaurant_id: restaurantId,
            enable: { $ne: false }
        });

        // Filter to only items that have at least one size with active offer
        const itemsWithOffers = items.filter(item => itemHasActiveOffer(item));

        // For each item, filter sizes to only show those with offers (optional - keeping all sizes for context)
        const enrichedItems = itemsWithOffers.map(item => {
            const itemObj = item.toObject();
            // Add a flag to indicate which sizes have offers
            itemObj.sizes = itemObj.sizes.map(size => ({
                ...size,
                has_offer: size.offer > 0 && size.offer < 100
            }));
            return itemObj;
        });

        return res.status(200).json({
            success: true,
            restaurant: {
                _id: restaurant._id,
                name: restaurant.name,
                has_offers: itemsWithOffers.length > 0
            },
            items: enrichedItems
        });

    } catch (error) {
        console.error("getRestaurantOffers error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

/**
 * GET /restaurants/:id (Helper function to check if restaurant has offers)
 * This can be used to add has_offers to existing restaurant detail endpoints
 */
module.exports.checkRestaurantHasOffers = async (restaurantId) => {
    try {
        const itemWithOffer = await Item.findOne({
            restaurant_id: restaurantId,
            enable: { $ne: false },
            "sizes.offer": { $gt: 0, $lt: 100 }
        });
        return !!itemWithOffer;
    } catch (error) {
        console.error("checkRestaurantHasOffers error:", error);
        return false;
    }
};

/**
 * GET /restaurants/details/:id
 * Get restaurant details with has_offers field included
 */
module.exports.getRestaurantDetails = async (req, res) => {
    try {
        // Guest Mode Support: Removed mandatory auth check


        const restaurantId = req.params.id;

        // Validate restaurant ID
        if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
            return res.status(400).json({ success: false, message: "Invalid restaurant ID" });
        }

        const restaurant = await Restaurant.findById(restaurantId)
            .populate({ path: 'super_category', select: 'name_en name_ar logo' })
            .populate({ path: 'sub_category', select: 'name_en name_ar' })
            .select(not_select.join(' '));

        if (!restaurant) {
            return res.status(404).json({ success: false, message: "Restaurant not found" });
        }

        // Check if restaurant has any items with offers
        const hasOffers = await module.exports.checkRestaurantHasOffers(restaurantId);

        // Get offers count and max discount if has offers
        let offersInfo = { offers_count: 0, max_discount: 0 };
        if (hasOffers) {
            const offerStats = await Item.aggregate([
                {
                    $match: {
                        restaurant_id: new mongoose.Types.ObjectId(restaurantId),
                        enable: { $ne: false },
                        "sizes.offer": { $gt: 0, $lt: 100 }
                    }
                },
                { $unwind: "$sizes" },
                {
                    $match: {
                        "sizes.offer": { $gt: 0, $lt: 100 }
                    }
                },
                {
                    $group: {
                        _id: null,
                        offers_count: { $sum: 1 },
                        max_discount: { $max: "$sizes.offer" }
                    }
                }
            ]);

            if (offerStats.length > 0) {
                offersInfo = {
                    offers_count: offerStats[0].offers_count,
                    max_discount: offerStats[0].max_discount
                };
            }
        }

        const result = {
            ...restaurant.toObject(),
            is_open: checkIsOpen(restaurant.open_hour, restaurant.close_hour),
            has_offers: hasOffers,
            offers_count: offersInfo.offers_count,
            max_discount: offersInfo.max_discount
        };

        return res.status(200).json({
            success: true,
            restaurant: result
        });

    } catch (error) {
        console.error("getRestaurantDetails error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};