const express = require('express');
const router = express.Router();
const CampaignUpdate = require('../models/CampaignUpdate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { safeParseInt } = require('../middleware/validate');

router.post('/campaign-updates', requireAuth, requireRole('charity'), async (req, res) => {
    try {
        const { campaignId, title, content } = req.body;
        if (!campaignId || !title || !content) {
            return res.status(400).json({ error: 'Campaign ID, title, and content are required' });
        }
        const update = new CampaignUpdate({
            campaignId,
            title: String(title).substring(0, 200),
            content: String(content).substring(0, 5000),
            createdBy: req.user.userId
        });
        await update.save();
        res.status(201).json(update);
    } catch (err) {
        console.error("Campaign update error:", err);
        res.status(500).json({ error: "Failed to post update" });
    }
});

router.get('/campaign-updates/:campaignId', async (req, res) => {
    try {
        const cId = safeParseInt(req.params.campaignId);
        const updates = await CampaignUpdate.find({ campaignId: cId })
            .populate('createdBy', 'fullName')
            .sort({ createdAt: -1 });
        res.json(updates);
    } catch (err) {
        if (err.status === 400) return res.status(400).json({ error: err.message });
        res.status(500).json({ error: "Failed to fetch updates" });
    }
});

module.exports = router;
