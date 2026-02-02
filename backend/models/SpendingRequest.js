const mongoose = require('mongoose');

const SpendingRequestSchema = new mongoose.Schema({
    campaignId: { type: Number, required: true },
    requestIndex: { type: Number, required: true },
    description: { type: String, required: true },
    value: { type: String, required: true },
    currency: { type: String, default: 'ETH' },
    recipient: { type: String, required: true },
    category: { type: String, default: 'Other' },
    txHash: String,
    // Phase 9: AI donor advisor -- cached analysis
    aiAnalysis: {
        score: { type: Number, default: null },
        report: { type: String, default: null },
        analyzedAt: { type: Date, default: null }
    },
    createdAt: { type: Date, default: Date.now }
});

SpendingRequestSchema.index({ campaignId: 1 });
SpendingRequestSchema.index({ campaignId: 1, requestIndex: 1 }, { unique: true });

module.exports = mongoose.model('SpendingRequest', SpendingRequestSchema);
