const express = require('express');
const router = express.Router();
const Donation = require('../models/Donation');
const { requireAuth, requireRole } = require('../middleware/auth');
const { safeParseInt, validateTxHash } = require('../middleware/validate');

router.post('/donations', requireAuth, requireRole('donor'), async (req, res) => {
    try {
        const { campaignId, donorWallet, amount, currency, txHash, donorName } = req.body;
        if (!txHash || !validateTxHash(txHash)) {
            return res.status(400).json({ error: 'Valid transaction hash required' });
        }
        if (!amount || isNaN(parseFloat(amount))) {
            return res.status(400).json({ error: 'Valid donation amount required' });
        }
        const validCurrencies = ['ETH', 'USDT', 'USDC', 'DAI', 'mUSDT'];
        const newDonation = new Donation({
            campaignId, donorWallet: donorWallet ? donorWallet.toLowerCase() : req.user.walletAddress,
            amount: String(amount),
            currency: validCurrencies.includes(currency) ? currency : 'ETH',
            txHash, donorName: donorName ? String(donorName).substring(0, 100) : undefined
        });
        await newDonation.save();
        res.status(201).json(newDonation);
    } catch (err) {
        console.error("Donation recording error:", err);
        res.status(500).json({ error: "Failed to record donation" });
    }
});

router.get('/donations/:campaignId', async (req, res) => {
    try {
        const cId = safeParseInt(req.params.campaignId);
        const donations = await Donation.find({ campaignId: cId }).sort({ createdAt: -1 }).limit(500);
        res.json(donations);
    } catch (err) {
        if (err.status === 400) return res.status(400).json({ error: err.message });
        res.status(500).json({ error: "Failed to fetch donations" });
    }
});

router.get('/donations/by-wallet/:wallet', async (req, res) => {
    try {
        const donations = await Donation.find({
            donorWallet: req.params.wallet.toLowerCase()
        }).sort({ createdAt: -1 }).limit(500);
        res.json(donations);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch donations" });
    }
});

module.exports = router;
