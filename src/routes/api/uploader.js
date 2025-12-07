const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Set up the multer storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './deliveria_upload'); // Specify the destination folder for uploaded images
    },
    filename: function (req, file, cb) {
        // Generate a random filename to prevent path traversal and other attacks
        crypto.randomBytes(16, (err, buf) => {
            if (err) {
                return cb(err);
            }
            const filename = buf.toString('hex') + path.extname(file.originalname);
            cb(null, filename);
        });
    }
});

// File filter to only allow specific image types
const fileFilter = (req, file, cb) => {
    const allowedFileTypes = /jpeg|jpg|png|gif/;
    const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedFileTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only images are allowed'));
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 5 // 5MB file size limit
    },
    fileFilter: fileFilter
});

module.exports = { upload };