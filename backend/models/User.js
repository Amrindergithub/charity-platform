const mongoose = require('mongoose');
const crypto = require('crypto');

function generateNonce() {
    return crypto.randomBytes(32).toString('hex');
}

const UserSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['donor', 'charity'], default: 'donor' },
    walletAddress: { type: String, required: true, unique: true },
    nonce: { type: String, default: generateNonce },
    resetToken: String,
    resetExpires: Date,
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

module.exports = { User, generateNonce };
