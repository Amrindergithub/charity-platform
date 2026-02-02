const mongoose = require('mongoose');

const CampaignUpdateSchema = new mongoose.Schema({
    campaignId: { type: Number, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

CampaignUpdateSchema.index({ campaignId: 1 });

module.exports = mongoose.model('CampaignUpdate', CampaignUpdateSchema);
