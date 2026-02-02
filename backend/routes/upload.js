const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { requireAuth, requireRole } = require('../middleware/auth');

// Sanitize filename — strip everything except alphanumeric, hyphens, underscores, dots
function sanitizeFilename(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../../frontend/public/uploads')),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${sanitizeFilename(file.originalname)}`)
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
            return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only JPEG, PNG and WebP images are allowed'));
        }
        cb(null, true);
    }
});

router.post('/upload', requireAuth, requireRole('charity'), upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No valid image uploaded. Accepted: JPEG, PNG, WebP (max 5MB)' });
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

module.exports = router;
