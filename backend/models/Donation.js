const mongoose = require('mongoose');

const DonationSchema = new mongoose.Schema({
    campaignId: { type: Number, required: true },
    donorWallet: { type: String, required: true },
    amount: { type: String, required: true },
    currency: { type: String, enum: ['ETH', 'USDT', 'USDC', 'DAI', 'mUSDT'], default: 'ETH' },
    txHash: { type: String, required: true },
    donorName: String,
    createdAt: { type: Date, default: Date.now }
});

DonationSchema.index({ campaignId: 1 });
DonationSchema.index({ donorWallet: 1 });

module.exports = mongoose.model('Donation', DonationSchema);
