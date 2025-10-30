const multer = require('multer');

// Set up the multer storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './deliveria_upload'); // Specify the destination folder for uploaded images
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + file.originalname); // Use the current timestamp to generate a unique filename
    }
});

const upload = multer({ storage: storage });
module.exports = { upload }