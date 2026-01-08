/**
 * Image Management System
 * Handles image uploads, processing, and deletion
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Default upload directory
const UPLOAD_DIR = path.join(__dirname, '../../deliveria_upload');
const THUMBNAIL_DIR = path.join(UPLOAD_DIR, 'thumbnails');
const OPTIMIZED_DIR = path.join(UPLOAD_DIR, 'optimized');

/**
 * Ensures required directories exist
 */
function ensureDirectoriesExist() {
    const dirs = [UPLOAD_DIR, THUMBNAIL_DIR, OPTIMIZED_DIR];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

/**
 * Validates image file
 * @param {object} file - Multer file object
 * @returns {object} - {valid: boolean, error: string}
 */
function validateImageFile(file) {
    if (!file) {
        return { valid: false, error: 'No file provided' };
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedMimes.includes(file.mimetype)) {
        return { valid: false, error: 'Only JPEG, PNG, and WebP images are allowed' };
    }

    if (file.size > maxSize) {
        return { valid: false, error: 'File size exceeds 5MB limit' };
    }

    return { valid: true };
}

/**
 * Processes and optimizes uploaded image
 * Creates thumbnail and optimized versions
 * @param {object} file - Multer file object
 * @param {string} entityType - Type of entity (product, restaurant, etc.)
 * @returns {promise<object>} - {success: boolean, files: {original, thumbnail, optimized}, error: string}
 */
async function processImage(file, entityType = 'general') {
    try {
        ensureDirectoriesExist();

        // Validate file
        const validation = validateImageFile(file);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        // Generate unique filename
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        const filename = `${entityType}_${timestamp}_${random}`;
        const ext = path.extname(file.originalname);

        // Save original file (if needed)
        const originalPath = path.join(UPLOAD_DIR, `${filename}${ext}`);
        fs.writeFileSync(originalPath, file.buffer);

        // Create thumbnail (200x200)
        const thumbnailPath = path.join(THUMBNAIL_DIR, `${filename}_thumb.webp`);
        await sharp(file.buffer)
            .resize(200, 200, {
                fit: 'cover',
                position: 'center'
            })
            .webp({ quality: 80 })
            .toFile(thumbnailPath);

        // Create optimized version (800x600 for product images)
        const optimizedPath = path.join(OPTIMIZED_DIR, `${filename}_optimized.webp`);
        await sharp(file.buffer)
            .resize(800, 600, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .webp({ quality: 85 })
            .toFile(optimizedPath);

        // Return file paths (relative to server root)
        const uploadDir = 'deliveria_upload';
        
        return {
            success: true,
            files: {
                original: path.join(uploadDir, `${filename}${ext}`).replace(/\\/g, '/'),
                thumbnail: path.join(uploadDir, 'thumbnails', `${filename}_thumb.webp`).replace(/\\/g, '/'),
                optimized: path.join(uploadDir, 'optimized', `${filename}_optimized.webp`).replace(/\\/g, '/'),
                filename: filename,
                extension: ext,
                original_name: file.originalname,
                size: file.size,
                mimetype: file.mimetype
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Deletes image and its variants
 * @param {object} imagePaths - Object containing paths to delete
 * @param {string} imagePaths.original - Original image path
 * @param {string} imagePaths.thumbnail - Thumbnail path
 * @param {string} imagePaths.optimized - Optimized image path
 * @returns {object} - {success: boolean, deleted: array, error: string}
 */
function deleteImage(imagePaths) {
    try {
        const deleted = [];

        // Delete original
        if (imagePaths.original) {
            const originalFullPath = path.join(__dirname, '../../', imagePaths.original);
            if (fs.existsSync(originalFullPath)) {
                fs.unlinkSync(originalFullPath);
                deleted.push('original');
            }
        }

        // Delete thumbnail
        if (imagePaths.thumbnail) {
            const thumbnailFullPath = path.join(__dirname, '../../', imagePaths.thumbnail);
            if (fs.existsSync(thumbnailFullPath)) {
                fs.unlinkSync(thumbnailFullPath);
                deleted.push('thumbnail');
            }
        }

        // Delete optimized
        if (imagePaths.optimized) {
            const optimizedFullPath = path.join(__dirname, '../../', imagePaths.optimized);
            if (fs.existsSync(optimizedFullPath)) {
                fs.unlinkSync(optimizedFullPath);
                deleted.push('optimized');
            }
        }

        return { success: true, deleted };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Deletes old image when new one is uploaded (replacement)
 * @param {string} oldImagePath - Path to old image
 * @returns {object} - {success: boolean, error: string}
 */
function deleteOldImage(oldImagePath) {
    try {
        if (!oldImagePath) {
            return { success: true };
        }

        const fullPath = path.join(__dirname, '../../', oldImagePath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Bulk upload images
 * @param {array} files - Array of multer file objects
 * @param {string} entityType - Type of entity
 * @returns {promise<object>} - {success: boolean, images: array, errors: array}
 */
async function bulkProcessImages(files, entityType = 'general') {
    try {
        if (!files || files.length === 0) {
            return { success: false, error: 'No files provided' };
        }

        const results = [];
        const errors = [];

        for (const file of files) {
            const result = await processImage(file, entityType);
            if (result.success) {
                results.push(result.files);
            } else {
                errors.push({ filename: file.originalname, error: result.error });
            }
        }

        return {
            success: errors.length === 0,
            images: results,
            errors: errors,
            processed: results.length,
            failed: errors.length
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Gets file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

module.exports = {
    processImage,
    deleteImage,
    deleteOldImage,
    bulkProcessImages,
    validateImageFile,
    formatFileSize,
    ensureDirectoriesExist,
    UPLOAD_DIR,
    THUMBNAIL_DIR,
    OPTIMIZED_DIR
};
