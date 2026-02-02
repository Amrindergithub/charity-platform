const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const rateLimit = require('express-rate-limit');
const { User, generateNonce } = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { validateWalletAddress, validateString } = require('../middleware/validate');

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 12;

// Rate limiting on auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many attempts. Please try again later.' }
});

// ── Register ──
router.post('/register', authLimiter, async (req, res, next) => {
    try {
        const { fullName, email, password, role, walletAddress } = req.body;
        if (typeof email !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ error: "Invalid input types" });
        }
        if (!fullName || !email || !password || !walletAddress) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters" });
        }
        if (!validateWalletAddress(walletAddress)) {
            return res.status(400).json({ error: "Invalid wallet address format" });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const newUser = new User({
            fullName: fullName.substring(0, 100),
            email: email.toLowerCase().substring(0, 200),
            password: hashedPassword,
            role: ['donor', 'charity'].includes(role) ? role : 'donor',
            walletAddress: walletAddress.toLowerCase(),
            nonce: generateNonce()
        });
        await newUser.save();
        console.log("User registered:", email, role, walletAddress);
        res.status(201).json({ success: true, message: "Account created successfully!" });
    } catch (err) {
        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern || {})[0];
            if (field === 'walletAddress') {
                return res.status(400).json({ error: "That wallet address is already registered." });
            }
            return res.status(400).json({ error: "That email is already taken." });
        }
        console.error("Register Error:", err);
        res.status(500).json({ error: "Registration failed. Please try again." });
    }
});

// ── Login ──
router.post('/login', authLimiter, async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (typeof email !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ error: "Invalid input" });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        const token = jwt.sign(
            { userId: user._id, email: user.email, role: user.role, walletAddress: user.walletAddress, fullName: user.fullName },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        const userResponse = {
            _id: user._id, fullName: user.fullName, email: user.email,
            role: user.role, walletAddress: user.walletAddress, createdAt: user.createdAt
        };
        res.json({ success: true, token, user: userResponse });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: "Login failed. Please try again." });
    }
});

// ── Session restore ──
router.get('/me', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password -nonce');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve user' });
    }
});

// ── Web3 Nonce ──
router.post('/auth/nonce', authLimiter, async (req, res) => {
    try {
        const { walletAddress } = req.body;
        if (!walletAddress || typeof walletAddress !== 'string') {
            return res.status(400).json({ error: 'Wallet address required' });
        }
        if (!validateWalletAddress(walletAddress)) {
            return res.status(400).json({ error: 'Invalid wallet address format' });
        }
        const wallet = walletAddress.toLowerCase();

        // Atomic: find user and set nonce if missing, preventing race condition
        const user = await User.findOneAndUpdate(
            { walletAddress: wallet, $or: [{ nonce: null }, { nonce: { $exists: false } }] },
            { $set: { nonce: generateNonce() } },
            { new: true }
        );
        // If no update was needed, just fetch the user
        const finalUser = user || await User.findOne({ walletAddress: wallet });
        if (!finalUser) {
            return res.status(404).json({ error: 'No account found for this wallet. Please register first.' });
        }

        const msg = `Sign this message to login to TrustChain:\n\nNonce: ${finalUser.nonce}`;
        res.json({ nonce: finalUser.nonce, message: msg });
    } catch (err) {
        console.error('Nonce error:', err);
        res.status(500).json({ error: 'Failed to generate nonce' });
    }
});

// ── Web3 Verify ──
router.post('/auth/web3', authLimiter, async (req, res) => {
    try {
        const { walletAddress, signature } = req.body;
        if (!walletAddress || !signature || typeof walletAddress !== 'string' || typeof signature !== 'string') {
            return res.status(400).json({ error: 'Wallet address and signature required' });
        }
        if (!validateWalletAddress(walletAddress)) {
            return res.status(400).json({ error: 'Invalid wallet address format' });
        }
        const wallet = walletAddress.toLowerCase();

        // Atomic: find user and rotate nonce in one operation to prevent replay
        const user = await User.findOne({ walletAddress: wallet });
        if (!user) {
            return res.status(404).json({ error: 'No account found for this wallet' });
        }

        const message = `Sign this message to login to TrustChain:\n\nNonce: ${user.nonce}`;

        let recoveredAddress;
        try {
            recoveredAddress = ethers.verifyMessage(message, signature);
        } catch (sigErr) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        if (recoveredAddress.toLowerCase() !== wallet) {
            return res.status(401).json({ error: 'Signature verification failed — wallet mismatch' });
        }

        // Rotate nonce atomically
        await User.updateOne({ _id: user._id }, { $set: { nonce: generateNonce() } });

        const token = jwt.sign(
            { userId: user._id, email: user.email, role: user.role, walletAddress: user.walletAddress, fullName: user.fullName },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        const userResponse = {
            _id: user._id, fullName: user.fullName, email: user.email,
            role: user.role, walletAddress: user.walletAddress, createdAt: user.createdAt
        };
        console.log('Web3 login:', user.email, wallet);
        res.json({ success: true, token, user: userResponse });
    } catch (err) {
        console.error('Web3 login error:', err);
        res.status(500).json({ error: 'Web3 login failed' });
    }
});

// ── Profile ──
router.put('/profile', requireAuth, async (req, res) => {
    try {
        const { fullName } = req.body;
        if (!fullName || typeof fullName !== 'string') {
            return res.status(400).json({ error: 'Valid name required' });
        }
        const user = await User.findByIdAndUpdate(
            req.user.userId,
            { fullName: fullName.substring(0, 100) },
            { new: true }
        ).select('-password -nonce');
        res.json({ user });
    } catch (err) {
        console.error("Profile update error:", err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// ── Change Password ──
router.put('/change-password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
            return res.status(400).json({ error: 'Invalid input' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const valid = await bcrypt.compare(currentPassword, user.password);
        if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

        user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await user.save();
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        console.error("Password change error:", err);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

module.exports = router;
