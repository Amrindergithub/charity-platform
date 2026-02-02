const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
    smartContractId: { type: Number, required: true, unique: true },
    title: { type: String, required: true },
    description: String,
    goal: String,
    category: { type: String, default: 'General' },
    imageUrl: String,
    creatorWallet: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deadlineDays: { type: Number, default: 0 },
    // Phase 9: AI analysis fields
    aiTrustScore: { type: Number, default: null },
    aiAnalysis: { type: String, default: null },
    aiGeneratedDescription: { type: String, default: null },
    // Phase 9: Phase metadata (mirrors on-chain phases for frontend rendering)
    phases: [{
        description: String,
        targetAmount: String,
        vendor: String
    }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Campaign', CampaignSchema);
