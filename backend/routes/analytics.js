const express = require('express');
const router = express.Router();
const Campaign = require('../models/Campaign');
const Donation = require('../models/Donation');
const SpendingRequest = require('../models/SpendingRequest');
const CampaignUpdate = require('../models/CampaignUpdate');
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

// ── 24h Donation Flow (bucketed by hour) ──
router.get('/analytics/flow-24h', async (req, res) => {
    try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const agg = await Donation.aggregate([
            { $match: { createdAt: { $gte: since } } },
            {
                $group: {
                    _id: { $dateTrunc: { date: "$createdAt", unit: "hour" } },
                    count: { $sum: 1 },
                    amount: { $sum: { $toDouble: "$amount" } }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Build 24 buckets aligned to hours-ago-from-now (oldest first → newest last)
        const buckets = [];
        const nowHour = new Date();
        nowHour.setMinutes(0, 0, 0);
        for (let i = 23; i >= 0; i--) {
            const t = new Date(nowHour.getTime() - i * 60 * 60 * 1000);
            const match = agg.find(a => new Date(a._id).getTime() === t.getTime());
            buckets.push({
                hour: t.toISOString(),
                count: match ? match.count : 0,
                amount: match ? parseFloat(match.amount.toFixed(4)) : 0
            });
        }
        res.json(buckets);
    } catch (err) {
        console.error("flow-24h error:", err);
        res.status(500).json({ error: "Failed to fetch flow" });
    }
});

// ── Recent Activity Audit Trail (donations + spending requests + campaign cancellations) ──
router.get('/analytics/audit-trail', async (req, res) => {
    try {
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const [donations, requests, updates] = await Promise.all([
            Donation.find({ txHash: { $ne: null } })
                .sort({ createdAt: -1 }).limit(limit).lean(),
            SpendingRequest.find({ txHash: { $ne: null } })
                .sort({ createdAt: -1 }).limit(limit).lean(),
            CampaignUpdate.find({ title: /cancel/i })
                .sort({ createdAt: -1 }).limit(limit).lean()
        ]);

        const events = [
            ...donations.map(d => ({
                type: 'donation',
                desc: `Donation of ${parseFloat(d.amount).toFixed(d.currency === 'ETH' ? 4 : 2)} ${d.currency || 'ETH'} to campaign #${d.campaignId}`,
                hash: d.txHash,
                at: d.createdAt,
                campaignId: d.campaignId
            })),
            ...requests.map(r => ({
                type: 'spending_request',
                desc: `Spending request #${r.requestIndex} (${r.category}) — ${parseFloat(r.value).toFixed(4)} ${r.currency || 'ETH'} on campaign #${r.campaignId}`,
                hash: r.txHash,
                at: r.createdAt,
                campaignId: r.campaignId
            })),
            ...updates.map(u => ({
                type: 'campaign_cancelled',
                desc: `Campaign #${u.campaignId} cancelled`,
                hash: null,
                at: u.createdAt,
                campaignId: u.campaignId
            }))
        ];
        events.sort((a, b) => new Date(b.at) - new Date(a.at));
        res.json(events.slice(0, limit));
    } catch (err) {
        console.error("audit-trail error:", err);
        res.status(500).json({ error: "Failed to fetch audit trail" });
    }
});

// ── Trend Summary (period-over-period deltas) ──
router.get('/analytics/trend-summary', async (req, res) => {
    try {
        const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 30));
        const now = Date.now();
        const currStart = new Date(now - days * 86400000);
        const prevStart = new Date(now - 2 * days * 86400000);

        const [currDon, prevDon, currCount, prevCount, currCampaigns, prevCampaigns, currUsers, prevUsers] = await Promise.all([
            Donation.aggregate([
                { $match: { createdAt: { $gte: currStart } } },
                { $group: { _id: null, total: { $sum: { $toDouble: "$amount" } } } }
            ]),
            Donation.aggregate([
                { $match: { createdAt: { $gte: prevStart, $lt: currStart } } },
                { $group: { _id: null, total: { $sum: { $toDouble: "$amount" } } } }
            ]),
            Donation.countDocuments({ createdAt: { $gte: currStart } }),
            Donation.countDocuments({ createdAt: { $gte: prevStart, $lt: currStart } }),
            Campaign.countDocuments({ createdAt: { $gte: currStart } }),
            Campaign.countDocuments({ createdAt: { $gte: prevStart, $lt: currStart } }),
            User.countDocuments({ createdAt: { $gte: currStart } }),
            User.countDocuments({ createdAt: { $gte: prevStart, $lt: currStart } })
        ]);

        const pct = (curr, prev) => {
            if (!prev || prev === 0) return null; // hide chip when no baseline
            return parseFloat((((curr - prev) / prev) * 100).toFixed(1));
        };

        const currAmount = currDon[0]?.total || 0;
        const prevAmount = prevDon[0]?.total || 0;

        res.json({
            days,
            donationAmount: { current: currAmount, previous: prevAmount, deltaPct: pct(currAmount, prevAmount) },
            donationCount: { current: currCount, previous: prevCount, deltaPct: pct(currCount, prevCount) },
            campaigns: { current: currCampaigns, previous: prevCampaigns, deltaPct: pct(currCampaigns, prevCampaigns) },
            users: { current: currUsers, previous: prevUsers, deltaPct: pct(currUsers, prevUsers) }
        });
    } catch (err) {
        console.error("trend-summary error:", err);
        res.status(500).json({ error: "Failed to fetch trends" });
    }
});

// ── Geographic Distribution of Donations ──
router.get('/analytics/geo', async (req, res) => {
    try {
        const agg = await Donation.aggregate([
            { $match: { country: { $ne: null } } },
            {
                $group: {
                    _id: { country: "$country", code: "$countryCode" },
                    count: { $sum: 1 },
                    amount: { $sum: { $toDouble: "$amount" } }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 50 }
        ]);
        const result = agg.map(a => ({
            country: a._id.country,
            code: a._id.code,
            count: a.count,
            amount: parseFloat(a.amount.toFixed(4))
        }));
        res.json(result);
    } catch (err) {
        console.error("geo error:", err);
        res.status(500).json({ error: "Failed to fetch geo distribution" });
    }
});

module.exports = router;
