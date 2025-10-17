import express from 'express'
import multer from "multer"
import { get_matches } from '../controller/product_matcher_controller.js'

const router = express.Router()

// Configure multer with limits
const upload = multer({
    dest: "uploads/",
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max file size
        files: 1
    },
    fileFilter: (req, file, cb) => {
        // Accept images only
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp|avif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
})

// Error handler for multer
const uploadMiddleware = (req, res, next) => {
    upload.single("image")(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({
                    error: "File too large. Maximum size is 5MB"
                });
            }
            return res.status(400).json({
                error: "File upload error: " + err.message
            });
        } else if (err) {
            return res.status(400).json({
                error: err.message
            });
        }
        next();
    });
};

router.post('/matches', uploadMiddleware, get_matches);

export default router
