const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    recipientWallet: { type: String, required: true, lowercase: true },
    type: {
        type: String,
        enum: ['campaign_cancelled', 'refund_sent', 'campaign_update', 'spending_request', 'campaign_funded'],
        required: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    campaignId: { type: Number },
    txHash: { type: String },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

NotificationSchema.index({ recipientWallet: 1, createdAt: -1 });
NotificationSchema.index({ recipientWallet: 1, read: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);
