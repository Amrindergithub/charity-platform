const express = require('express');
const router = express.Router();
const SpendingRequest = require('../models/SpendingRequest');
const { requireAuth, requireRole } = require('../middleware/auth');
const { safeParseInt } = require('../middleware/validate');

router.post('/spending-requests', requireAuth, requireRole('charity'), async (req, res) => {
    try {
        const { campaignId, requestIndex, description, value, currency, recipient, category, txHash } = req.body;
        if (!description || !value || !recipient) {
            return res.status(400).json({ error: 'Description, value, and recipient are required' });
        }
        const newRequest = new SpendingRequest({
            campaignId, requestIndex,
            description: String(description).substring(0, 2000),
            value: String(value),
            currency: currency || 'ETH',
            recipient: recipient.toLowerCase(),
            category: category || 'Other',
            txHash
        });
        await newRequest.save();
        res.status(201).json(newRequest);
    } catch (err) {
        console.error("Spending request error:", err);
        res.status(500).json({ error: "Failed to record spending request" });
    }
});

router.get('/spending-requests/:campaignId', async (req, res) => {
    try {
        const cId = safeParseInt(req.params.campaignId);
        const requests = await SpendingRequest.find({ campaignId: cId }).sort({ createdAt: -1 }).limit(200);
        res.json(requests);
    } catch (err) {
        if (err.status === 400) return res.status(400).json({ error: err.message });
        res.status(500).json({ error: "Failed to fetch spending requests" });
    }
});

module.exports = router;
