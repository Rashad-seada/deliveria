const Address = require("../models/Address");
const User = require("../models/Users");

module.exports.createAddress = async (req, res) => {
  try {
    const body = req.body || {};

    // ✅ تحقق من الحقول المطلوبة
    if (!body.address_title || !body.phone || !body.details) {
      return res.status(400).json({
        success: false,
        message: "address_title, phone, and details are required fields"
      });
    }

    const address = new Address({
      user_id: req.decoded.id,
      address_title: body.address_title ? body.address_title.trim() : "",
      phone: body.phone ? body.phone.trim() : "",
      details: body.details ? body.details.trim() : "",
      coordinates: {
        latitude: body.latitude ?? 0,
        longitude: body.longitude ?? 0
      }
    });

    await address.save();

    // ✅ تعيين العنوان الافتراضي عند الطلب
    if (body.default === true) {
      await User.findByIdAndUpdate(req.decoded.id, { $set: { address_id: address._id } });
    }

    return res.status(200).json({
      success: true,
      message: "Address is created",
      address
    });
  } catch (error) {
    console.error("Error creating address:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

module.exports.getAddress = async (req, res) => {
  try {
    const addresses = await Address.find({ user_id: req.decoded.id });
    const user = await User.findById(req.decoded.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const addressesWithIsDefault = addresses.map(address => {
      const is_default = user.address_id?.toString() === address._id.toString();
      return { ...address.toObject(), is_default };
    });

    return res.status(200).json({
      success: true,
      address: addressesWithIsDefault
    });
  } catch (error) {
    console.error("Error fetching addresses:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

module.exports.deleteAddress = async (req, res) => {
  try {
    const deleted = await Address.findOneAndDelete({
      _id: req.params.id,
      user_id: req.decoded.id
    });

    const user = await User.findById(req.decoded.id);

    if (deleted) {
      if (user && user.address_id && user.address_id.toString() === req.params.id) {
        user.address_id = undefined;
        await user.save();
      }

      return res.status(200).json({
        success: true,
        message: "Address is deleted"
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "Address not found or not owned by user"
      });
    }
  } catch (error) {
    console.error("Error deleting address:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

module.exports.setDefaultAddress = async (req, res) => {
  try {
    const userId = req.decoded.id;
    const addressId = req.params.id;

    // ✅ Step 1: Verify the address exists and belongs to the user
    const address = await Address.findOne({
      _id: addressId,
      user_id: userId
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found or doesn't belong to you"
      });
    }

    // ✅ Step 2: Update user's default address
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { address_id: addressId } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // ✅ Step 3: Return success with address details
    return res.status(200).json({
      success: true,
      message: "Address is now default",
      address: {
        _id: address._id,
        address_title: address.address_title,
        phone: address.phone,
        details: address.details,
        coordinates: address.coordinates,
        is_default: true
      }
    });
  } catch (error) {
    console.error("Error setting default address:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
