require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// ── Security Middleware ──
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// ── Static Files ──
app.use('/uploads', express.static(path.join(__dirname, '../frontend/public/uploads')));

// ── Health Check ──
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Routes ──
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/campaigns'));
app.use('/', require('./routes/donations'));
app.use('/', require('./routes/spendingRequests'));
app.use('/', require('./routes/updates'));
app.use('/', require('./routes/upload'));
app.use('/', require('./routes/ai'));
app.use('/api', require('./routes/proxy'));
app.use('/', require('./routes/analytics'));
app.use('/', require('./routes/notifications'));

// ── Global Error Handler (must be last) ──
app.use(errorHandler);

// ── Graceful Shutdown ──
function shutdown(signal) {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    const mongoose = require('mongoose');
    mongoose.connection.close().then(() => {
        console.log('MongoDB connection closed');
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    process.exit(1);
});

// ── Start Server ──
connectDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
    });
});
