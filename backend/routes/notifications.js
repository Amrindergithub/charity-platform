const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const Donation = require('../models/Donation');
const { requireAuth } = require('../middleware/auth');

// GET /notifications — list current user's notifications
router.get('/notifications', requireAuth, async (req, res) => {
    try {
        const wallet = req.user.walletAddress.toLowerCase();
        const items = await Notification.find({ recipientWallet: wallet })
            .sort({ createdAt: -1 })
            .limit(50);
        const unread = items.filter(n => !n.read).length;
        res.json({ notifications: items, unread });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /notifications/mark-read — mark all (or by id) as read
router.post('/notifications/mark-read', requireAuth, async (req, res) => {
    try {
        const wallet = req.user.walletAddress.toLowerCase();
        const { id } = req.body || {};
        const filter = { recipientWallet: wallet, read: false };
        if (id) filter._id = id;
        const result = await Notification.updateMany(filter, { $set: { read: true } });
        res.json({ updated: result.modifiedCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /notifications/cancel-broadcast — called by frontend after cancelCampaign tx confirmed
// Creates a notification for every donor of that campaign.
// Auth: must be a logged-in user (campaign manager). We trust txHash exists; on-chain truth is the contract.
router.post('/notifications/cancel-broadcast', requireAuth, async (req, res) => {
    try {
        const { campaignId, reason, txHash } = req.body;
        if (campaignId === undefined || campaignId === null) {
            return res.status(400).json({ error: 'campaignId required' });
        }
        // Find unique donor wallets for this campaign
        const donors = await Donation.distinct('donorWallet', { campaignId: parseInt(campaignId) });
        if (donors.length === 0) return res.json({ created: 0 });

        const docs = donors.map(w => ({
            recipientWallet: w.toLowerCase(),
            type: 'campaign_cancelled',
            title: `Campaign #${campaignId} cancelled`,
            message: `Campaign cancelled by manager. Reason: ${reason || 'Not provided'}. Your proportional share of remaining funds has been auto-refunded to your wallet.`,
            campaignId: parseInt(campaignId),
            txHash: txHash || undefined,
        }));
        await Notification.insertMany(docs);
        res.json({ created: docs.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
