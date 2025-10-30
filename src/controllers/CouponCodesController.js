const Cart = require("../models/Carts");
const CouponCode = require("../models/CouponCodes");
const Restaurant = require("../models/Restaurants");

module.exports.createCouponCode = async (req, res) => {
    try {
        const isNewCode = await CouponCode.isThisCodeIsUsed(req.body.code)
        if (isNewCode) {
            return res.json({
                message: 'This code is already in use'
            })
        }

        if (req.body.restaurant !== "Full") {
            const restaurant = await Restaurant.findById(req.body.restaurant.trim())

            if (!restaurant) {
                return res.status(200).json({
                    message: `Restaurant is not found`,
                });
            }
        }

        let couponCode = new CouponCode({
            restaurant: req.body.restaurant.trim(),
            code: req.body.code.trim(),
            discount: req.body.discount,
            expired_date: req.body.expired_date.trim(),
            enable: true,
            number_enable: req.body.number_enable,
        })

        couponCode.save()
            .then(response => {
                return res.status(200).json({
                    message: "Code is created"
                })
            })
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}

module.exports.checkCouponCode = async (req, res) => {
    try {
        const couponCode = await CouponCode.findOne({ code: req.params.code, enable: true })

        if (!couponCode) {
            return res.status(200).json({
                message: `Coupon "${req.params.code}" you entered doesn't exist`
            })
        }

        const currentDate = new Date();
        const expiredDate = new Date(couponCode.expired_date);

        if (currentDate > expiredDate) {
            return res.status(200).json({
                success: false,
                message: `Coupon code "${req.params.code}" has expired`
            });
        }

        let restaurant;

        if (couponCode.restaurant !== "Full") {
            restaurant = await Restaurant.findById(couponCode.restaurant)

            if (!restaurant) {
                return res.status(200).json({
                    message: `Restaurant is not found`,
                });
            }
        }

        const carts = await Cart.find({ user_id: req.body.decoded.id, coupon_code_id: couponCode._id })

        if (carts.length === couponCode.number_enable) {
            return res.status(200).json({
                message: `You used this code full`
            })
        }

        await Cart.findOneAndUpdate({ user_id: req.body.decoded.id }, { $set: { coupon_code_id: couponCode._id } })
        return res.status(200).json({
            message: `Coupon "${req.params.code}" exist and you got ${couponCode.discount}% ${couponCode.restaurant === "Full" ? "off" : `for ${restaurant.name}`}`
        })
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}

module.exports.getCouponCode = async (req, res) => {
    try {
        const couponCodes = await CouponCode.find()

        return res.status(200).json({
            coupon_codes: couponCodes
        })
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}

module.exports.changeEnable = async (req, res, next) => {
    try {
        const couponCode = await CouponCode.findById(req.params.id);
        couponCode.enable = !couponCode.enable;
        await couponCode.save();

        return res.status(200).json({
            message: `This coupon code is ${couponCode.enable ? "enabled" : "disabled"} delivery`,
            enable: couponCode.enable,
        });
    } catch (error) {
        return res.json({
            message: "Error"
        })
    }
}