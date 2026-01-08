/**
 * Image Management Controller
 * Handles image uploads, processing, and deletion
 */

const Item = require("../models/Items");
const Restaurant = require("../models/Restaurants");
const {
    processImage,
    deleteImage,
    deleteOldImage,
    bulkProcessImages,
    formatFileSize
} = require("../utils/imageManager");

/**
 * Uploads and processes a single image
 */
module.exports.uploadImage = async (req, res) => {
    try {
        const { entityType = 'general' } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: "No file provided" });
        }

        const result = await processImage(req.file, entityType);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(201).json({
            message: "Image uploaded and processed successfully",
            file: result.files
        });
    } catch (error) {
        console.error("Error uploading image:", error);
        return res.status(500).json({ message: "Error uploading image", error: error.message });
    }
};

/**
 * Uploads multiple images
 */
module.exports.bulkUploadImages = async (req, res) => {
    try {
        const { entityType = 'general' } = req.body;

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "No files provided" });
        }

        const result = await bulkProcessImages(req.files, entityType);

        if (!result.success && result.errors.length === result.failed) {
            return res.status(400).json(result);
        }

        return res.status(201).json(result);
    } catch (error) {
        console.error("Error bulk uploading images:", error);
        return res.status(500).json({ message: "Error bulk uploading images", error: error.message });
    }
};

/**
 * Updates item image
 */
module.exports.updateItemImage = async (req, res) => {
    try {
        const { itemId } = req.params;

        if (!req.file) {
            return res.status(400).json({ message: "No file provided" });
        }

        // Get current item to get old image path
        const item = await Item.findById(itemId);
        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        // Process new image
        const result = await processImage(req.file, 'item');
        if (!result.success) {
            return res.status(400).json(result);
        }

        // Delete old image
        if (item.photo) {
            await deleteOldImage(item.photo);
        }

        // Update item with new image
        item.photo = result.files.optimized;
        await item.save();

        return res.json({
            message: "Item image updated successfully",
            image: result.files,
            item: { id: item._id, photo: item.photo }
        });
    } catch (error) {
        console.error("Error updating item image:", error);
        return res.status(500).json({ message: "Error updating item image", error: error.message });
    }
};

/**
 * Updates restaurant image (logo or cover photo)
 */
module.exports.updateRestaurantImage = async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { imageType = 'logo' } = req.body; // 'logo' or 'photo'

        if (!req.file) {
            return res.status(400).json({ message: "No file provided" });
        }

        // Get current restaurant
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) {
            return res.status(404).json({ message: "Restaurant not found" });
        }

        // Process new image
        const result = await processImage(req.file, 'restaurant');
        if (!result.success) {
            return res.status(400).json(result);
        }

        // Delete old image
        const oldImagePath = restaurant[imageType];
        if (oldImagePath) {
            await deleteOldImage(oldImagePath);
        }

        // Update restaurant with new image
        restaurant[imageType] = result.files.optimized;
        await restaurant.save();

        return res.json({
            message: `Restaurant ${imageType} updated successfully`,
            image: result.files,
            restaurant: { id: restaurant._id, [imageType]: restaurant[imageType] }
        });
    } catch (error) {
        console.error("Error updating restaurant image:", error);
        return res.status(500).json({ message: "Error updating restaurant image", error: error.message });
    }
};

/**
 * Deletes an image
 */
module.exports.deleteImage = async (req, res) => {
    try {
        const { imagePath } = req.body;

        if (!imagePath) {
            return res.status(400).json({ message: "Image path is required" });
        }

        const result = deleteImage({ original: imagePath });

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error("Error deleting image:", error);
        return res.status(500).json({ message: "Error deleting image", error: error.message });
    }
};

/**
 * Gets image information
 */
module.exports.getImageInfo = async (req, res) => {
    try {
        const { imagePath } = req.query;

        if (!imagePath) {
            return res.status(400).json({ message: "Image path is required" });
        }

        const path = require('path');
        const fs = require('fs');

        const fullPath = path.join(__dirname, '../../', imagePath);

        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ message: "Image not found" });
        }

        const stats = fs.statSync(fullPath);

        return res.json({
            path: imagePath,
            size: stats.size,
            size_formatted: formatFileSize(stats.size),
            created: stats.birthtime,
            modified: stats.mtime
        });
    } catch (error) {
        console.error("Error getting image info:", error);
        return res.status(500).json({ message: "Error getting image info", error: error.message });
    }
};

/**
 * Batch delete images
 */
module.exports.batchDeleteImages = async (req, res) => {
    try {
        const { imagePaths } = req.body;

        if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
            return res.status(400).json({ message: "Image paths array is required" });
        }

        const results = [];
        const errors = [];

        for (const imagePath of imagePaths) {
            const result = deleteImage({ original: imagePath });
            if (result.success) {
                results.push({ path: imagePath, status: 'deleted' });
            } else {
                errors.push({ path: imagePath, error: result.error });
            }
        }

        return res.json({
            message: 'Batch delete completed',
            deleted: results.length,
            failed: errors.length,
            results,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error("Error batch deleting images:", error);
        return res.status(500).json({ message: "Error batch deleting images", error: error.message });
    }
};
