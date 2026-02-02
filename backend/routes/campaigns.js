const express = require('express');
const router = express.Router();
const Campaign = require('../models/Campaign');
const { requireAuth, requireRole } = require('../middleware/auth');
const { safeParseInt } = require('../middleware/validate');

router.post('/campaigns', requireAuth, requireRole('charity'), async (req, res) => {
    try {
        const { smartContractId, title, description, goal, category, imageUrl, deadlineDays,
                aiTrustScore, aiAnalysis, aiGeneratedDescription, phases } = req.body;
        if (!title || !smartContractId === undefined) {
            return res.status(400).json({ error: 'Title and smart contract ID are required' });
        }
        const newCampaign = new Campaign({
            smartContractId, title: String(title).substring(0, 200),
            description: description ? String(description).substring(0, 5000) : '',
            goal,
            category: category || 'General',
            imageUrl: imageUrl ? String(imageUrl).substring(0, 500) : null,
            deadlineDays: deadlineDays || 0,
            creatorWallet: req.user.walletAddress,
            createdBy: req.user.userId,
            aiTrustScore: (aiTrustScore && aiTrustScore >= 0 && aiTrustScore <= 100) ? aiTrustScore : null,
            aiAnalysis: aiAnalysis ? String(aiAnalysis).substring(0, 2000) : null,
            aiGeneratedDescription: aiGeneratedDescription ? String(aiGeneratedDescription).substring(0, 5000) : null,
            phases: Array.isArray(phases) ? phases.slice(0, 10) : []
        });
        await newCampaign.save();
        res.status(201).json(newCampaign);
    } catch (err) {
        console.error("Campaign creation error:", err);
        res.status(500).json({ error: "Failed to create campaign" });
    }
});

router.get('/campaigns', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 50));
        const skip = (page - 1) * limit;

        const [total, campaigns] = await Promise.all([
            Campaign.countDocuments(),
            Campaign.find()
                .populate('createdBy', 'fullName')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
        ]);

        res.json({ campaigns, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch campaigns" });
    }
});

router.get('/campaigns/by-wallet/:wallet', async (req, res) => {
    try {
        const campaigns = await Campaign.find({
            creatorWallet: req.params.wallet.toLowerCase()
        }).sort({ createdAt: -1 }).limit(100);
        res.json(campaigns);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch campaigns" });
    }
});

router.get('/campaigns/:smartContractId', async (req, res) => {
    try {
        const scId = safeParseInt(req.params.smartContractId);
        const campaign = await Campaign.findOne({ smartContractId: scId })
            .populate('createdBy', 'fullName');
        if (!campaign) return res.status(404).json({ error: "Campaign not found" });
        res.json(campaign);
    } catch (err) {
        if (err.status === 400) return res.status(400).json({ error: err.message });
        res.status(500).json({ error: "Failed to fetch campaign" });
    }
});

module.exports = router;
