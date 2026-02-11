const express = require('express');
const router = express.Router();
const Campaign = require('../models/Campaign');
const Donation = require('../models/Donation');
const SpendingRequest = require('../models/SpendingRequest');
const { User } = require('../models/User');

// ── Platform Stats (parallel queries) ──
router.get('/stats', async (req, res) => {
    try {
        const [
            totalCampaigns, totalDonations, totalUsers,
            totalDonors, totalCharities, totalSpendingRequests,
            ethAgg, stableAgg, categoryAgg
        ] = await Promise.all([
            Campaign.countDocuments(),
            Donation.countDocuments(),
            User.countDocuments(),
            User.countDocuments({ role: 'donor' }),
            User.countDocuments({ role: 'charity' }),
            SpendingRequest.countDocuments(),
            Donation.aggregate([
                { $match: { currency: { $in: ['ETH', null] } } },
                { $group: { _id: null, total: { $sum: { $toDouble: "$amount" } } } }
            ]),
            Donation.aggregate([
                { $match: { currency: { $in: ['USDT', 'USDC', 'DAI', 'mUSDT'] } } },
                { $group: { _id: null, total: { $sum: { $toDouble: "$amount" } } } }
            ]),
            SpendingRequest.aggregate([
                { $group: { _id: "$category", total: { $sum: { $toDouble: "$value" } }, count: { $sum: 1 } } },
                { $sort: { total: -1 } }
            ])
        ]);

        const totalETH = ethAgg.length > 0 ? ethAgg[0].total : 0;
        const totalStable = stableAgg.length > 0 ? stableAgg[0].total : 0;

        res.json({
            totalCampaigns, totalDonations, totalUsers,
            totalDonors, totalCharities, totalSpendingRequests,
            totalETH: totalETH.toFixed(4),
            totalStablecoin: totalStable.toFixed(2),
            spendingByCategory: categoryAgg
        });
    } catch (err) {
        console.error("Stats error:", err);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

// ── Donations Over Time ──
router.get('/analytics/donations-over-time', async (req, res) => {
    try {
        const agg = await Donation.aggregate([
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" },
                        day: { $dayOfMonth: "$createdAt" }
                    },
                    totalAmount: { $sum: { $toDouble: "$amount" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
            { $limit: 365 }
        ]);
        const formatted = agg.map(item => ({
            date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
            amount: parseFloat(item.totalAmount.toFixed(4)),
            count: item.count
        }));
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch analytics" });
    }
});

// ── Campaigns By Category ──
router.get('/analytics/by-category', async (req, res) => {
    try {
        const agg = await Campaign.aggregate([
            { $group: { _id: "$category", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        res.json(agg);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch analytics" });
    }
});

module.exports = router;
