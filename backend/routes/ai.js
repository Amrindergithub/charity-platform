const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const SpendingRequest = require('../models/SpendingRequest');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sanitizeForPrompt } = require('../middleware/validate');

// Rate limit AI endpoints
const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Too many AI requests. Please wait a minute.' }
});

// Initialise Gemini
let geminiModel = null;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
if (GEMINI_API_KEY) {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    console.log('Gemini AI initialised (gemini-2.5-flash)');
} else {
    console.log('GEMINI_API_KEY not set — AI features disabled');
}

function cleanAIResponse(text) {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    return JSON.parse(cleaned);
}

// ── Campaign Builder ──
router.post('/ai/generate-campaign', aiLimiter, requireAuth, requireRole('charity'), async (req, res) => {
    if (!geminiModel) {
        return res.status(503).json({ error: 'AI service not configured. Set GEMINI_API_KEY environment variable.' });
    }
    try {
        const { title, category, goalETH, numPhases } = req.body;
        if (!title || !goalETH) {
            return res.status(400).json({ error: 'Title and goal amount are required' });
        }

        const safeTitle = sanitizeForPrompt(title);
        const safeCategory = sanitizeForPrompt(category || 'General');
        const phases = Math.min(Math.max(parseInt(numPhases) || 3, 1), 10);

        const prompt = `You are a charity campaign feasibility analyst and copywriter for TrustChain, a blockchain donation platform.

A charity wants to create a campaign with these details:
- Title: "${safeTitle}"
- Category: ${safeCategory}
- Fundraising Goal: ${parseFloat(goalETH)} ETH

Your task:
1. Write a compelling, professional campaign description (150-250 words) that would inspire donors.
2. Propose exactly ${phases} funding phases (milestones) that logically break down the campaign goal.
   - Each phase must have a "description" (what it funds), and a "targetAmount" (cumulative ETH, ascending).
   - The final phase's targetAmount MUST equal exactly ${parseFloat(goalETH)}.
   - Make the phases realistic and budget-appropriate.
3. Provide a Trust/Feasibility Score from 1-100 based on whether the goal amount is realistic for the stated purpose.
4. Write a short analysis (2-3 sentences) explaining your score.

Respond ONLY with valid JSON in this exact format (no markdown, no code fences):
{
  "description": "...",
  "trustScore": 85,
  "analysis": "...",
  "phases": [
    { "description": "Phase 1 name", "targetAmount": "2" },
    { "description": "Phase 2 name", "targetAmount": "5" },
    { "description": "Phase 3 name", "targetAmount": "${parseFloat(goalETH)}" }
  ]
}`;

        const result = await geminiModel.generateContent(prompt);
        const parsed = cleanAIResponse(result.response.text());

        res.json({
            success: true,
            description: parsed.description,
            trustScore: Math.min(100, Math.max(0, parseInt(parsed.trustScore) || 50)),
            analysis: parsed.analysis,
            phases: parsed.phases
        });
    } catch (err) {
        console.error('AI generate-campaign error:', err);
        res.status(500).json({ error: 'AI generation failed. Please try again or enter details manually.' });
    }
});

// ── Donor Advisor ──
router.post('/ai/analyze-request', aiLimiter, requireAuth, async (req, res) => {
    if (!geminiModel) {
        return res.status(503).json({ error: 'AI service not configured. Set GEMINI_API_KEY environment variable.' });
    }
    try {
        const { campaignId, requestIndex, description, valueETH, campaignTitle, campaignGoalETH, phaseDescription } = req.body;
        if (!description || !valueETH) {
            return res.status(400).json({ error: 'Request description and value are required' });
        }

        // Check cache
        const existing = await SpendingRequest.findOne({ campaignId, requestIndex });
        if (existing?.aiAnalysis?.score) {
            return res.json({
                success: true,
                score: existing.aiAnalysis.score,
                report: existing.aiAnalysis.report,
                cached: true
            });
        }

        const safeDesc = sanitizeForPrompt(description);
        const safeTitle = sanitizeForPrompt(campaignTitle || 'Unknown');
        const safePhase = sanitizeForPrompt(phaseDescription || 'General spending');

        const prompt = `You are a financial feasibility analyst advising donors on a blockchain charity platform called TrustChain.

A charity campaign "${safeTitle}" (goal: ${parseFloat(campaignGoalETH) || '?'} ETH) has submitted a spending request for donor approval:

- Request Description: "${safeDesc}"
- Requested Amount: ${parseFloat(valueETH)} ETH
- Phase/Milestone: ${safePhase}

Donors must vote to approve or reject this request. Help them decide:

1. Score (1-100): How reasonable is this amount for the described purpose? 100 = perfectly reasonable, 1 = clearly fraudulent.
2. Report (3-4 sentences): Explain your reasoning. Consider market rates, typical costs for this type of work, and any red flags.
3. Recommendation: "APPROVE", "CAUTION", or "REJECT"

Respond ONLY with valid JSON (no markdown, no code fences):
{
  "score": 78,
  "report": "...",
  "recommendation": "APPROVE"
}`;

        const result = await geminiModel.generateContent(prompt);
        const parsed = cleanAIResponse(result.response.text());

        // Cache result
        if (existing) {
            existing.aiAnalysis = {
                score: parsed.score,
                report: `${parsed.report}\n\nRecommendation: ${parsed.recommendation}`,
                analyzedAt: new Date()
            };
            await existing.save();
        }

        res.json({
            success: true,
            score: parsed.score,
            report: parsed.report,
            recommendation: parsed.recommendation,
            cached: false
        });
    } catch (err) {
        console.error('AI analyze-request error:', err);
        res.status(500).json({ error: 'AI analysis failed. Please try again.' });
    }
});

module.exports = router;
