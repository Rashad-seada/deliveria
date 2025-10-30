const Restaurant = require("../models/Restaurants");
const axios = require('axios');
const bcrypt = require("bcrypt")
const { hashSync, genSaltSync } = require("bcrypt");
const jwt = require('jsonwebtoken');
const { not_select, checkIsOpen, sendNotification } = require("./global");
const { setTimeout } = require('timers/promises');
const Item = require("../models/Items");
const Cart = require("../models/Carts");
const Agent = require("../models/Agents");
const User = require("../models/Users");
const Admin = require("../models/Admin");
const Order = require("../models/Orders");
const Address = require("../models/Address");
const mongoose = require("mongoose");
require("dotenv").config();

function extractCoordsFromFinalUrl(finalUrl) {
    const patterns = [
        // Pattern 1: /search/latitude,longitude (FIXED)
        /\/search\/([-\d.]+),\s*([-\d.]+)/,

        // Pattern 2: /search/latitude,+longitude (with plus sign)
        /\/search\/([-\d.]+),\s*\+([-\d.]+)/,

        // Pattern 3: @latitude,longitude
        /@([-\d.]+),([-\d.]+)/,

        // Pattern 4: q=latitude,longitude
        /[?&]q=([-\d.]+),([-\d.]+)/,

        // Your URL contains: ...!8m2!3d30.004547499999997!4d31.1508206?utm_source...
        /!8m2!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/
    ];

    for (const pattern of patterns) {
        const match = finalUrl.match(pattern);
        console.log(match)
        if (match) {
            return {
                latitude: parseFloat(match[1]),
                longitude: parseFloat(match[2])
            };
        }
    }
    return null;
}

module.exports.createRestaurant = async (req, res) => {
    try {
        if (req.body.decoded.user_type !== "Admin") {
            return res.json({
                message: 'This account is not admin'
            })
        }
        const isNewRestaurant = await Restaurant.isThisUserNameUsed(req.body.phone)
        if (isNewRestaurant) {
            return res.json({
                message: 'This phone is already in use'
            })
        }

        const agent = await Agent.findOne({ phone: req.body.phone })
        const user = await User.findOne({ phone: req.body.phone })
        const admin = await Admin.findOne({ phone: req.body.phone })

        if (agent || admin || user) {
            return res.json({
                message: 'Please change this phone number'
            })
        }

        const body = req.body;

        const logoFile = req.files.logo[0].path;
        const photoFile = req.files.photo[0].path;

        const response = await axios.get(body.loacation_map.trim(), { maxRedirects: 10 });
        const finalUrl = response.request.res.responseUrl;

        console.log('Final URL:', finalUrl);

        const coords = extractCoordsFromFinalUrl(finalUrl);

        try {
            const salt = genSaltSync(10);
            body.password = hashSync(body.password, salt);
        } catch (error) {
            return res.json({
                success: false,
                message: "password error"
            })
        }

        let restaurant = new Restaurant({
            photo: photoFile,
            logo: logoFile,
            super_category: JSON.parse(body.super_category),
            sub_category: JSON.parse(body.sub_category),
            phone: body.phone.trim(),
            name: body.name.trim(),
            user_name: "NA",
            password: body.password.trim(),
            about_us: body.about_us.trim(),
            rate_number: 0,
            user_rated: 0,
            rate: 0,
            reviews: [],
            delivery_cost: 0,
            loacation_map: body.loacation_map.trim(),
            coordinates: {
                latitude: coords.latitude,
                longitude: coords.longitude
            },
            open_hour: body.open_hour,
            close_hour: body.close_hour,
            have_delivery: false,
            is_show: true,
            is_show_in_home: true,
            estimated_time: body.estimated_time
        })


        restaurant.save()
            .then(response => {
                return res.status(200).json({
                    message: "Restaurant is created"
                })
            })
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}

module.exports.updateRestaurant = async (req, res) => {
    try {
        const body = req.body;

        const restaurant = await Restaurant.findById(req.params.id)
        if (!restaurant) {
            return res.json({ message: 'Restaurant not found' });
        }

        if (req.files.logo) {
            const logoFile = req.files.logo[0].path;
            if (logoFile) {
                restaurant.logo = logoFile
            }
        }

        if (req.files.photo) {
            const photoFile = req.files.photo[0].path;
            if (photoFile) {
                restaurant.photo = photoFile
            }
        }

        let update = {
            photo: restaurant.photo,
            logo: restaurant.logo,
            name: body.name.trim(),
            about_us: body.about_us.trim(),
            open_hour: body.open_hour,
            close_hour: body.close_hour,
        }

        Restaurant.findByIdAndUpdate(req.params.id, { $set: update }, { new: true }).then(response => {
            return res.status(200).json({
                message: "Restaurant is updated"
            })
        })
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}

module.exports.login = async (req, res, next) => {
    try {
        var phone = req.body.phone
        var password = req.body.password
        const isNewUser = await Restaurant.isThisUserNameUsed(phone)
        if (!isNewUser) {
            return res.json({
                message: 'User name or password is invalid'
            })
        }

        Restaurant.findOne({ phone: phone })
            .then(async (restaurant) => {
                if (restaurant) {
                    bcrypt.compare(password, restaurant.password, async function (err, result) {
                        if (err) {
                            res.json({
                                error: err
                            })
                        }

                        if (result) {
                            let token = jwt.sign({ phone: restaurant.phone, id: restaurant._id, user_type: "Restaurant" }, process.env.JWT_KEY)
                            restaurant.password = undefined
                            return res.status(200).json({
                                message: 'Login Successful!',
                                token: token,
                                restaurant: restaurant
                            })
                        } else {
                            return res.json({
                                message: "User name or password is invalid"
                            })
                        }
                    })
                } else {
                    return res.json({
                        message: 'User name or password is invalid'
                    })
                }
            })
    } catch (error) {
        return res.json({
            message: "Error"
        })
    }
}

module.exports.getAllRestaurants = async (req, res, next) => {
    try {
        const restaurants = await Restaurant.find().select(not_select.join(' ')).populate({
            path: 'super_category',
            select: 'name_en name_ar logo'
        }).populate({
            path: 'sub_category',
            select: 'name_en name_ar'
        });

        const restaurantsWithStatus = restaurants.map(restaurant => {
            const is_open = checkIsOpen(restaurant.open_hour, restaurant.close_hour);

            return {
                ...restaurant.toObject(),
                is_open
            };
        });

        return res.status(200).json({ response: restaurantsWithStatus });
    } catch (error) {
        return res.status(500).json({
            message: "Error retrieving restaurants",
            error: error.message
        });
    }
};

module.exports.getHomeRestaurants = async (req, res, next) => {
    try {
        let { latitude, longitude } = req.params; // Get coordinates from query params
        if (latitude === "0" || longitude === "0") {
            console.log(latitude)
            if (req.body.decoded.user_type === "User") {
                const user = await User.findById(req.body.decoded.id)

                if (user.address_id) {
                    const address = await Address.findById(user.address_id)

                    latitude = address.coordinates.latitude
                    longitude = address.coordinates.longitude
                }
            }
        }

        if (latitude === "0" || longitude === "0") {
            return res.status(400).json({ message: "Location is required" });
        }

        const userLat = parseFloat(latitude);
        const userLon = parseFloat(longitude);

        const restaurants = await Restaurant.find({ is_show: true }).populate({
            path: 'super_category',
            select: 'name_en name_ar logo'
        }).populate({
            path: 'sub_category',
            select: 'name_en name_ar'
        }).select(not_select.join(' '));

        const restaurantsWithStatus = restaurants.map(restaurant => {
            const distance = calculateDistance(
                userLat,
                userLon,
                restaurant.coordinates.latitude, // latitude
                restaurant.coordinates.longitude  // longitude
            );
            const is_open = checkIsOpen(restaurant.open_hour, restaurant.close_hour);

            return {
                ...restaurant.toObject(),
                is_open,
                is_nearby: distance <= 10  // within 10 km
            };
        }).filter(restaurant => restaurant.is_nearby);

        return res.status(200).json({ response: restaurantsWithStatus });
    } catch (error) {
        return res.json({
            message: "Error"
        })
    }
}

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    // Radius of the Earth in kilometers
    const R = 6371;

    // Convert degrees to radians
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in kilometers
};

module.exports.getRestaurantsByRate = async (req, res, next) => {
    try {
        let { latitude, longitude } = req.params; // Get coordinates from query params
        if (latitude === "0" || longitude === "0") {
            if (req.body.decoded.user_type === "User") {
                const user = await User.findById(req.body.decoded.id)

                if (user.address_id) {
                    const address = await Address.findById(user.address_id)

                    latitude = address.coordinates.latitude
                    longitude = address.coordinates.longitude
                }
            }
        }

        if (latitude === "0" || longitude === "0") {
            return res.status(400).json({ message: "Location is required" });
        }

        const userLat = parseFloat(latitude);
        const userLon = parseFloat(longitude);

        // First get all restaurants
        const restaurants = await Restaurant.find({ is_show: true }).populate({
            path: 'super_category',
            select: 'name_en name_ar logo'
        }).populate({
            path: 'sub_category',
            select: 'name_en name_ar'
        }).sort({ rate: -1 }).select(not_select.join(' '));

        // Filter restaurants within 10 km radius and add status
        const nearbyRestaurants = restaurants.map(restaurant => {
            const distance = calculateDistance(
                userLat,
                userLon,
                restaurant.coordinates.latitude, // latitude
                restaurant.coordinates.longitude  // longitude
            );

            const is_open = checkIsOpen(restaurant.open_hour, restaurant.close_hour);

            return {
                ...restaurant.toObject(),
                is_open,
                is_nearby: distance <= 10  // within 10 km
            };
        }).filter(restaurant => restaurant.is_nearby); // Only return nearby restaurants

        return res.status(200).json({
            response: nearbyRestaurants
        });
    } catch (error) {
        console.error("Error in getRestaurantsByRate:", error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

module.exports.searchRestaurant = async (req, res, next) => {
    try {
        let { latitude, longitude } = req.params; // Get coordinates from query params
        if (latitude === "0" || longitude === "0") {
            if (req.body.decoded.user_type === "User") {
                const user = await User.findById(req.body.decoded.id)

                if (user.address_id) {
                    const address = await Address.findById(user.address_id)

                    latitude = address.coordinates.latitude
                    longitude = address.coordinates.longitude
                }
            }
        }

        if (latitude === "0" || longitude === "0") {
            return res.status(400).json({ message: "Location is required" });
        }

        const userLat = parseFloat(latitude);
        const userLon = parseFloat(longitude);

        const restaurants = await Restaurant.find({ is_show: true, name: { $regex: new RegExp(req.body.search, 'i') } }).populate({
            path: 'super_category',
            select: 'name_en name_ar logo'
        }).populate({
            path: 'sub_category',
            select: 'name_en name_ar'
        }).select(not_select.join(' '));

        // Filter restaurants within 10 km radius and add status
        const nearbyRestaurants = restaurants.map(restaurant => {
            const distance = calculateDistance(
                userLat,
                userLon,
                restaurant.coordinates.latitude,
                restaurant.coordinates.longitude
            );

            const is_open = checkIsOpen(restaurant.open_hour, restaurant.close_hour);

            return {
                ...restaurant.toObject(),
                is_open,
                is_nearby: distance <= 10  // within 10 km
            };
        }).filter(restaurant => restaurant.is_nearby); // Only return nearby restaurants

        return res.status(200).json({
            response: nearbyRestaurants
        });
    } catch (error) {
        console.error("Error in getRestaurantsByRate:", error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

module.exports.searchRestaurantAdmin = async (req, res, next) => {
    try {
        const restaurants = await Restaurant.find({ name: { $regex: new RegExp(req.body.search, 'i') } }).populate({
            path: 'super_category',
            select: 'name_en name_ar logo'
        }).populate({
            path: 'sub_category',
            select: 'name_en name_ar'
        }).select(not_select.join(' '));

        // Filter restaurants within 10 km radius and add status
        const nearbyRestaurants = restaurants.map(restaurant => {
            const is_open = checkIsOpen(restaurant.open_hour, restaurant.close_hour);

            return {
                ...restaurant.toObject(),
                is_open,
            };
        })

        return res.status(200).json({
            response: nearbyRestaurants
        });
    } catch (error) {
        console.error("Error in getRestaurantsByRate:", error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

module.exports.getRestaurantsByRateAdmin = async (req, res, next) => {
    try {
        const restaurants = await Restaurant.find().populate({
            path: 'super_category',
            select: 'name_en name_ar logo'
        }).populate({
            path: 'sub_category',
            select: 'name_en name_ar'
        }).sort({ rate: -1 }).select(not_select.join(' '));

        // Filter restaurants within 10 km radius and add status
        const nearbyRestaurants = restaurants.map(restaurant => {
            const is_open = checkIsOpen(restaurant.open_hour, restaurant.close_hour);

            return {
                ...restaurant.toObject(),
                is_open,
            };
        })

        return res.status(200).json({
            response: nearbyRestaurants
        });
    } catch (error) {
        console.error("Error in getRestaurantsByRate:", error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

module.exports.getRestaurantsByCategory = async (req, res, next) => {
    try {
        let { latitude, longitude } = req.params; // Get coordinates from query params
        if (latitude === "0" || longitude === "0") {
            if (req.body.decoded.user_type === "User") {
                const user = await User.findById(req.body.decoded.id)

                if (user.address_id) {
                    const address = await Address.findById(user.address_id)

                    latitude = address.coordinates.latitude
                    longitude = address.coordinates.longitude
                }
            }
        }

        if (latitude === "0" || longitude === "0") {
            return res.status(400).json({ message: "Out of range" });
        }

        const userLat = parseFloat(latitude);
        const userLon = parseFloat(longitude);

        let category

        if (req.params.sub_category === "all") {
            category = {
                super_category: req.params.super_category,
                is_show: true
            }
        } else {
            category = {
                is_show: true,
                sub_category: req.params.sub_category,
                super_category: req.params.super_category
            }
        }

        const restaurants = await Restaurant.find(category).populate({
            path: 'super_category',
            select: 'name_en name_ar logo'
        }).populate({
            path: 'sub_category',
            select: 'name_en name_ar'
        }).select(not_select.join(' '));

        const restaurantsWithStatus = restaurants.map(restaurant => {
            const distance = calculateDistance(
                userLat,
                userLon,
                restaurant.coordinates.latitude, // latitude
                restaurant.coordinates.longitude  // longitude
            );
            const is_open = checkIsOpen(restaurant.open_hour, restaurant.close_hour);

            return {
                ...restaurant.toObject(),
                is_open,
                is_nearby: distance <= 10
            };
        }).filter(restaurant => restaurant.is_nearby);

        return res.status(200).json({ response: restaurantsWithStatus });
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}

module.exports.getRestaurantsByCategoryAdmin = async (req, res, next) => {
    try {
        let category

        if (req.params.sub_category === "all") {
            category = {
                super_category: req.params.super_category
            }
        } else {
            category = {
                sub_category: req.params.sub_category,
                super_category: req.params.super_category
            }
        }

        const restaurants = await Restaurant.find(category).populate({
            path: 'super_category',
            select: 'name_en name_ar logo'
        }).populate({
            path: 'sub_category',
            select: 'name_en name_ar'
        }).select(not_select.join(' '));

        const restaurantsWithStatus = restaurants.map(restaurant => {
            const is_open = checkIsOpen(restaurant.open_hour, restaurant.close_hour);

            return {
                ...restaurant.toObject(),
                is_open,
            };
        })

        return res.status(200).json({ response: restaurantsWithStatus });
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}

module.exports.changeShowRestaurant = async (req, res, next) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id);
        if (!restaurant) {
            return res.status(200).json({
                message: `Restaurant is not found`,
            });
        }
        restaurant.is_show = !restaurant.is_show;
        await restaurant.save();

        return res.status(200).json({
            message: `This restaurant is ${restaurant.is_show ? "enabled" : "disabled"}`,
            is_show: restaurant.is_show,
        });
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}

module.exports.changeShowInHomeRestaurant = async (req, res, next) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id);
        if (!restaurant) {
            return res.status(200).json({
                message: `Restaurant is not found`,
            });
        }
        restaurant.is_show_in_home = !restaurant.is_show_in_home;
        await restaurant.save();

        return res.status(200).json({
            message: `This restaurant is ${restaurant.is_show_in_home ? "enabled" : "disabled"} in home`,
            is_show_in_home: restaurant.is_show_in_home,
        });
    } catch (error) {
        return res.json({
            message: "Error"
        })
    }
}

module.exports.changeHaveDelivery = async (req, res, next) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id);
        restaurant.have_delivery = !restaurant.have_delivery;
        await restaurant.save();

        return res.status(200).json({
            message: `This restaurant is ${restaurant.have_delivery ? "enabled" : "disabled"} delivery`,
            have_delivery: restaurant.have_delivery,
        });
    } catch (error) {
        return res.json({
            message: "Error"
        })
    }
}

module.exports.deleteRestaurant = async (req, res, next) => {
    try {
        await Restaurant.findByIdAndDelete(req.params.id).then(async (restaurant) => {
            if (!restaurant) {
                return res.status(200).json({
                    message: `Restaurant is not found`,
                });
            }
            await Item.deleteMany({ restaurant_id: restaurant._id }).then(async (item) => {
                await Cart.updateMany(
                    { "carts.restaurant_id": restaurant._id },
                    { $pull: { carts: { restaurant_id: restaurant._id } } }
                ).then(async (cart) => {
                    return res.status(200).json({
                        message: "This restaurant is deleted",
                    });
                });
            })
        });

    } catch (error) {
        return res.json({
            message: "Error"
        })
    }
}

module.exports.addReview = async (req, res, next) => {
    try {
        const body = req.body
        const restaurant = await Restaurant.findById(body.restaurant_id)
        if (!restaurant) {
            return res.status(200).json({
                message: `Restaurant is not found`,
            });
        }
        restaurant.rate_number += body.rate_number
        restaurant.user_rated += 1
        restaurant.rate = restaurant.rate_number / restaurant.user_rated
        restaurant.reviews.push({
            user_id: req.body.decoded.id,
            message: body.message,
            rate: body.rate_number
        })

        await restaurant.save()

        await sendNotification([restaurant._id], req.body.decoded.id, `New review is added`)
        return res.json({
            success: true,
            message: 'Your review is added'
        });
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}

module.exports.myOrder = async (req, res) => {
    try {
        const myOrders = await Order.find({ delivery_type: "Restaurant", delivery_id: req.body.decoded.id, status: { $ne: "Canceled" } }).populate({
            path: 'user_id',
            select: 'first_name last_name'
        })

        const agentOrder = await Order.find({ delivery_type: "Agent", 'orders.restaurant_id': req.body.decoded.id, status: { $ne: "Canceled" } }).populate({
            path: 'user_id',
            select: 'first_name last_name'
        })

        const agentOrders = agentOrder.map(order => {
            const orderObj = order.toObject();
            return {
                ...orderObj,
                orders: orderObj.orders.filter(
                    ord => ord.restaurant_id.toString() === req.body.decoded.id.toString()
                )
            };
        }).filter(order => order.orders.length > 0);

        const allOrders = [...myOrders, ...agentOrders]
        allOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return res.status(200).json({
            orders: allOrders
        });
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}

module.exports.acceptOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const deliveryId = req.body.decoded.id;

        // Find the order first to check its status
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                message: "Order not found"
            });
        }

        if (order.status !== "New") {
            return res.status(400).json({
                message: "This order has already been accepted or processed"
            });
        }

        // Update both the main status and all orders.status fields
        await Order.findByIdAndUpdate(
            orderId,
            {
                $set: {
                    delivery_id: deliveryId,
                    status: "Preparing",
                    "orders.$[].status": "Preparing" // Update status for all items in orders array
                }
            },
            { new: true } // Return the updated document
        );

        return res.status(200).json({
            message: "Order accepted successfully"
        });

    } catch (error) {
        console.error("Error accepting order:", error);
        return res.status(500).json({
            message: "Error accepting order",
            error: error.message
        });
    }
};

module.exports.preparingOrderAgent = async (req, res) => {
    try {
        const orderId = req.params.id;
        const restaurantId = req.body.decoded.id; // Or get from auth token

        // Find the order
        const order = await Order.findOne({
            _id: orderId,
            "orders.restaurant_id": restaurantId
        });

        if (!order) {
            return res.status(404).json({
                message: "Order not found or doesn't contain your restaurant's items"
            });
        }

        if (order.status !== "New") {
            return res.status(400).json({
                message: "This order has already been accepted or processed"
            });
        }

        // Update only the specific restaurant's order status
        const updatedOrder = await Order.findOneAndUpdate(
            {
                _id: orderId,
                "orders.restaurant_id": restaurantId
            },
            {
                $set: {
                    "orders.$.status": "Preparing"
                }
            },
            { new: true }
        );

        const allOrdersPreparing = updatedOrder.orders.every(order => order.status === "Preparing");

        if (allOrdersPreparing) {
            const finalUpdatedOrder = await Order.findByIdAndUpdate(
                orderId,
                {
                    $set: {
                        status: "Preparing"
                    }
                },
                { new: true }
            );

            return res.status(200).json({
                message: "Order accepted successfully and all restaurants are preparing"
            });
        } else {
            return res.status(200).json({
                message: "Your restaurant's order accepted successfully. Waiting for other restaurants.",
            });
        }
    } catch (error) {
        console.error("Error accepting order:", error);
        return res.status(500).json({
            message: "Error accepting order",
            error: error.message
        });
    }
};

module.exports.readyOrderAgent = async (req, res) => {
    try {
        const orderId = req.params.id;
        const restaurantId = req.body.decoded.id; // Or get from auth token

        // Find the order
        const order = await Order.findOne({
            _id: orderId,
            "orders.restaurant_id": restaurantId
        });

        if (!order) {
            return res.status(404).json({
                message: "Order not found or doesn't contain your restaurant's items"
            });
        }

        if (order.status !== "Preparing") {
            return res.status(400).json({
                message: "This order has already been accepted or processed"
            });
        }

        // Update only the specific restaurant's order status
        const updatedOrder = await Order.findOneAndUpdate(
            {
                _id: orderId,
                "orders.restaurant_id": restaurantId
            },
            {
                $set: {
                    "orders.$.status": "Ready for pickup"
                }
            },
            { new: true }
        );

        const allOrdersReadyForPickup = updatedOrder.orders.every(order => order.status === "Ready for pickup");

        if (allOrdersReadyForPickup) {
            const finalUpdatedOrder = await Order.findByIdAndUpdate(
                orderId,
                {
                    $set: {
                        status: "Ready for pickup"
                    }
                },
                { new: true }
            );
            startOrderTimers(finalUpdatedOrder)

            if(finalUpdatedOrder.delivery_id){
                sendNotification([finalUpdatedOrder.delivery_id], finalUpdatedOrder.user_id, `طلبك جاهز الأن في المطاعم`)
            }else{
                const agents = await Agent.find({ban: false})
                let ids = []
                for(let i = 0; i < agents.length; i++){
                    ids.push(agents[i]._id)
                }
                sendNotification(ids, finalUpdatedOrder.user_id, `ربما هناك طلبات في انتظاركم, راجعوا الطلبات الجديدة`)
            }
            
            return res.status(200).json({
                message: "Order accepted successfully and all restaurants are Ready for pickup"
            });
        } else {
            return res.status(200).json({
                message: "Your restaurant's order ready for pickup successfully. Waiting for other restaurants.",
            });
        }
    } catch (error) {
        console.error("Error accepting order:", error);
        return res.status(500).json({
            message: "Error accepting order",
            error: error.message
        });
    }
};

function startOrderTimers(order) {
    setTimeout(60000).then(async () => {
        try {
            const currentOrder = await Order.findById(order._id);
            const admins = await Admin.find()

            let adminsId = []

            for (let i = 0; i < admins.length; i++) {
                adminsId.push(admins[i]._id)
            }

            if (currentOrder.status === "Ready for pickup") {
                sendNotification(adminsId, currentOrder.user_id, `Order #${currentOrder._id.toString().slice(-4)} ready for pickup from 10 min`)
            }
        } catch (error) {
            console.error('Error in order timer:', error);
        }
    });
}

module.exports.changeStatusOfOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const deliveryId = req.body.decoded.id;

        // Find the order first to check its status
        const order = await Order.findById({ _id: orderId, delivery_id: deliveryId });

        if (!order) {
            return res.status(404).json({
                message: "Order not found"
            });
        }
        await Order.findByIdAndUpdate(
            orderId,
            {
                $set: {
                    delivery_id: deliveryId,
                    status: req.body.status,
                    "orders.$[].status": req.body.status // Update status for all items in orders array
                }
            },
            { new: true } // Return the updated document
        );

        return res.status(200).json({
            message: `This order is ${req.body.status}`
        });

    } catch (error) {
        console.error("Error accepting order:", error);
        return res.status(500).json({
            message: "Error accepting order",
            error: error.message
        });
    }
}

module.exports.getDataOfRestaurant = async (req, res, next) => {
    try {
        const id = req.body.decoded.id
        const restaurnat = await Restaurant.findById(id)
        let totalAmount = 0;
        const orders = await Order.find({
            status: { $ne: "Canceled" },
            orders: {
                $elemMatch: {
                    restaurant_id: id
                }
            }
        })
        const total = orders.map(order => {
            totalAmount += order.final_price;
        });

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        const ordersToday = await Order.find({
            orders: {
                $elemMatch: {
                    restaurant_id: id
                }
            },
            createdAt: {
                $gte: startOfToday,
                $lte: endOfToday
            },
        });

        const startOfDay1 = new Date();
        startOfDay1.setDate(startOfDay1.getDate() - 1);
        startOfDay1.setHours(0, 0, 0, 0);

        const endOfDay1 = new Date();
        endOfDay1.setDate(endOfDay1.getDate() - 1);
        endOfDay1.setHours(23, 59, 59, 999);

        const ordersDay1 = await Order.find({
            createdAt: {
                $gte: startOfDay1,
                $lte: endOfDay1
            },
            orders: {
                $elemMatch: {
                    restaurant_id: id
                }
            }
        });

        const startOfDay2 = new Date();
        startOfDay2.setDate(startOfDay2.getDate() - 2);
        startOfDay2.setHours(0, 0, 0, 0);

        const endOfDay2 = new Date();
        endOfDay2.setDate(endOfDay2.getDate() - 2);
        endOfDay2.setHours(23, 59, 59, 999);

        const ordersDay2 = await Order.find({
            createdAt: {
                $gte: startOfDay2,
                $lte: endOfDay2
            },
            orders: {
                $elemMatch: {
                    restaurant_id: id
                }
            }
        });

        const startOfDay3 = new Date();
        startOfDay3.setDate(startOfDay3.getDate() - 3);
        startOfDay3.setHours(0, 0, 0, 0);

        const endOfDay3 = new Date();
        endOfDay3.setDate(endOfDay3.getDate() - 3);
        endOfDay3.setHours(23, 59, 59, 999);

        const ordersDay3 = await Order.find({
            createdAt: {
                $gte: startOfDay3,
                $lte: endOfDay3
            },
            orders: {
                $elemMatch: {
                    restaurant_id: id
                }
            }
        });

        const startOfDay4 = new Date();
        startOfDay4.setDate(startOfDay4.getDate() - 4);
        startOfDay4.setHours(0, 0, 0, 0);

        const endOfDay4 = new Date();
        endOfDay4.setDate(endOfDay4.getDate() - 4);
        endOfDay4.setHours(23, 59, 59, 999);

        const ordersDay4 = await Order.find({
            createdAt: {
                $gte: startOfDay4,
                $lte: endOfDay4
            },
            orders: {
                $elemMatch: {
                    restaurant_id: id
                }
            }
        });

        const startOfDay5 = new Date();
        startOfDay5.setDate(startOfDay5.getDate() - 5);
        startOfDay5.setHours(0, 0, 0, 0);

        const endOfDay5 = new Date();
        endOfDay5.setDate(endOfDay5.getDate() - 5);
        endOfDay5.setHours(23, 59, 59, 999);

        const ordersDay5 = await Order.find({
            createdAt: {
                $gte: startOfDay5,
                $lte: endOfDay5
            },
            orders: {
                $elemMatch: {
                    restaurant_id: id
                }
            }
        });

        const startOfDay6 = new Date();
        startOfDay6.setDate(startOfDay6.getDate() - 6);
        startOfDay6.setHours(0, 0, 0, 0);

        const endOfDay6 = new Date();
        endOfDay6.setDate(endOfDay6.getDate() - 6);
        endOfDay6.setHours(23, 59, 59, 999);

        const ordersDay6 = await Order.find({
            createdAt: {
                $gte: startOfDay6,
                $lte: endOfDay6
            },
            orders: {
                $elemMatch: {
                    restaurant_id: id
                }
            }
        });

        const startOfDay7 = new Date();
        startOfDay7.setDate(startOfDay7.getDate() - 7);
        startOfDay7.setHours(0, 0, 0, 0);

        const endOfDay7 = new Date();
        endOfDay7.setDate(endOfDay7.getDate() - 7);
        endOfDay7.setHours(23, 59, 59, 999);

        const ordersDay7 = await Order.find({
            createdAt: {
                $gte: startOfDay7,
                $lte: endOfDay7
            },
            orders: {
                $elemMatch: {
                    restaurant_id: id
                }
            }
        });
        return res.json({
            total_orders: orders.length,
            net_revenue: totalAmount * 10 / 100,
            customer_feedback: restaurnat.rate,
            oders_of_last_week: [
                ordersToday.length,
                ordersDay1.length,
                ordersDay2.length,
                ordersDay3.length,
                ordersDay4.length,
                ordersDay5.length,
                ordersDay6.length,
                ordersDay7.length
            ]
        })
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}

module.exports.getBestSellerItems = async (req, res, next) => {
    try {
        const bestSellers = await Order.aggregate([
      // Step 1: Match orders that include this restaurant
      {
        $match: {
          "orders.restaurant_id": new mongoose.Types.ObjectId(req.params.id),
        },
      },
      // Step 2: Unwind orders array
      { $unwind: "$orders" },
      // Step 3: Keep only the restaurant we care about
      {
        $match: {
          "orders.restaurant_id": new mongoose.Types.ObjectId(req.params.id),
        },
      },
      // Step 4: Unwind the items inside that restaurant
      { $unwind: "$orders.items" },
      // Step 5: Group by item_id and sum quantities
      {
        $group: {
          _id: "$orders.items.item_details.item_id",
          name: { $first: "$orders.items.item_details.name" },
          photo: { $first: "$orders.items.item_details.photo" },
          description: { $first: "$orders.items.item_details.description" },
          totalQuantity: { $sum: "$orders.items.size_details.quantity" },
          totalRevenue: { $sum: "$orders.items.size_details.price_Of_quantity" },
        },
      },
      // Step 6: Sort by most sold
      { $sort: { totalQuantity: -1 } },
      // Step 7: Limit top N
      { $limit: 10 },
    ]);

    return res.json({ bestSellers });

    } catch (error) {
        console.error("Error fetching best sellers:", error);
        return {
            success: false,
            error: error.message,
            best_sellers: []
        };
    }
};