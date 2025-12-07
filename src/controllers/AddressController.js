const Address = require("../models/Address");
const User = require("../models/Users");
const Restaurant = require("../models/Restaurants"); // Import Restaurant model

// Helper to get the correct model based on user type
const getAccountModel = (userType) => {
  if (userType === "Restaurant") return Restaurant;
  return User;
};

module.exports.createAddress = async (req, res) => {
  try {
    const body = req.body || {};

    // ✅ Validate required fields
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

    // ✅ Set default address if requested
    if (body.default === true) {
      const Model = getAccountModel(req.decoded.user_type);
      await Model.findByIdAndUpdate(req.decoded.id, { $set: { address_id: address._id } });
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
    const Model = getAccountModel(req.decoded.user_type);

    // Run queries in parallel for performance
    const [addresses, account] = await Promise.all([
      Address.find({ user_id: req.decoded.id }).lean(),
      Model.findById(req.decoded.id).select("address_id").lean()
    ]);

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found"
      });
    }

    const defaultAddressId = account.address_id?.toString();

    const addressesWithIsDefault = addresses.map(address => ({
      ...address,
      is_default: defaultAddressId === address._id.toString()
    }));

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

    const Model = getAccountModel(req.decoded.user_type);
    const account = await Model.findById(req.decoded.id);

    if (deleted) {
      if (account && account.address_id && account.address_id.toString() === req.params.id) {
        account.address_id = undefined;
        await account.save();
      }

      return res.status(200).json({
        success: true,
        message: "Address is deleted"
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "Address not found or not owned by you"
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
    const Model = getAccountModel(req.decoded.user_type);
    const updatedAccount = await Model.findByIdAndUpdate(
      userId,
      { $set: { address_id: addressId } },
      { new: true }
    );

    if (!updatedAccount) {
      return res.status(404).json({
        success: false,
        message: "Account not found"
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
