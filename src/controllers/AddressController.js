const Address = require("../models/Address");
const User = require("../models/Users");

module.exports.createAddress = async (req, res) => {
    const body = req.body;

    let address = new Address({
        user_id: req.body.decoded.id,
        address_title: body.address_title.trim(),
        phone: body.phone.trim(),
        details: body.details.trim(),
        coordinates: {
            latitude: body.latitude || 0,
            longitude: body.longitude || 0
        }
    })

    address.save()
        .then(async (response) => {
            if (body.default) {
                await User.findByIdAndUpdate(req.body.decoded.id, { $set: { address_id: address._id } })
            }
            return res.status(200).json({
                success: true,
                message: "Address is created"
            })
        })
}

module.exports.getAddress = async (req, res) => {
    try {
        const addresses = await Address.find({ user_id: req.body.decoded.id })

const user = await User.findById(req.body.decoded.id)

        const addressesWithIsDefault = addresses.map(address => {
            const is_default = user.address_id.toString() === address._id.toString()

            return {
                ...address.toObject(),
                is_default
            };
        });

return res.status(200).json({
                success: true,
                address: addressesWithIsDefault
            })
    } catch (error) {
        return res.json({
            message: "Error"
        })
    }
}

module.exports.deleteAddress = async (req, res) => {
    try {
        Address.findOneAndDelete({ _id: req.params.id, user_id: req.body.decoded.id }).then(async (response) => {
            const user = await User.findById(req.body.decoded.id)
            if (response) {
                if ((user && user.address_id) || user.address_id !== null) {
if(user.address_id){
                    if (user.address_id.toString() === req.params.id) {
                        user.address_id = undefined

                        await user.save()
                    }
                }
}
                return res.status(200).json({
                    success: true,
                    message: "Address is deleted"
                })
            } else {
                return res.status(200).json({
                    success: true,
                    message: "Id is not user or address is not found"
                })
            }
        })
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}

module.exports.setDefaultAddress = async (req, res) => {
    try {
        User.findByIdAndUpdate(req.body.decoded.id, { $set: { address_id: req.params.id } }).then(async (response) => {
            return res.status(200).json({
                success: true,
                message: "Address is default"
            })
        })
    } catch (error) {
        return res.json({
            message: "Error"
        })
    }
}