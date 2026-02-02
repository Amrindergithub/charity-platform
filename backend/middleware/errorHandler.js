const multer = require('multer');

function errorHandler(err, req, res, next) {
  console.error('Unhandled error:', err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ error: 'File upload error: ' + err.message });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request payload too large' });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
}

module.exports = errorHandler;
