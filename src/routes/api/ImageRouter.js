const router = require('express').Router();
const multer = require('multer');
const ImageController = require('../../controllers/ImageController');
const { checkToken } = require('../../auth/token_validation');

// Configure multer for image uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
        }
    }
});

// Upload single image
router.post('/upload', upload.single('image'), ImageController.uploadImage);

// Upload multiple images
router.post('/bulk-upload', upload.array('images', 10), ImageController.bulkUploadImages);

// Update item image
router.post('/item/:itemId', checkToken, upload.single('image'), ImageController.updateItemImage);

// Update restaurant image
router.post('/restaurant/:restaurantId', checkToken, upload.single('image'), ImageController.updateRestaurantImage);

// Get image info
router.get('/info', ImageController.getImageInfo);

// Delete image
router.delete('/delete', checkToken, ImageController.deleteImage);

// Batch delete images
router.post('/batch-delete', checkToken, ImageController.batchDeleteImages);

module.exports = router;
