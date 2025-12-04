const express = require('express');
const router = express.Router();
const guidanceService = require('../services/guidance-service');
const newsletterService = require('../services/newsletter');
const { newsletters } = require('../database/firestore');
const fs = require('fs').promises;
const path = require('path');

// Middleware to check admin authentication
function checkAuth(req, res, next) {
    const password = req.body.password || req.query.auth;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
        return res.status(500).json({
            error: 'Admin password not configured',
            message: 'Set ADMIN_PASSWORD environment variable'
        });
    }

    if (password !== adminPassword) {
        return res.status(401).json({
            authenticated: false,
            message: 'Invalid password'
        });
    }

    next();
}

/**
 * POST /api/admin/auth
 * Verify admin password
 */
router.post('/auth', (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
        return res.status(500).json({
            error: 'Admin password not configured',
            message: 'Set ADMIN_PASSWORD environment variable'
        });
    }

    if (password === adminPassword) {
        res.json({ authenticated: true, message: 'Authentication successful' });
    } else {
        res.status(401).json({ authenticated: false, message: 'Invalid password' });
    }
});

/**
 * GET /api/admin/guidance
 * Get current AI guidance
 */
router.get('/guidance', checkAuth, async (req, res) => {
    try {
        const guidance = await guidanceService.getCurrentGuidance();

        // Get last updated timestamp from Firestore
        const { getDoc } = require('../database/db-firestore');
        const doc = await getDoc('system_settings', 'pe_analysis_guidance');

        res.json({
            guidance: guidance || '',
            lastUpdated: doc?.last_updated || null
        });
    } catch (error) {
        console.error('Error fetching guidance:', error);
        res.status(500).json({
            error: 'Failed to fetch guidance',
            message: error.message
        });
    }
});

/**
 * PUT /api/admin/guidance
 * Update AI guidance
 */
router.put('/guidance', checkAuth, async (req, res) => {
    try {
        const { guidance } = req.body;

        if (!guidance || typeof guidance !== 'string') {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'Guidance text is required'
            });
        }

        // Save directly to Firestore
        const { setDoc, serverTimestamp } = require('../database/db-firestore');
        await setDoc('system_settings', 'pe_analysis_guidance', {
            current_guidance: guidance,
            last_updated: serverTimestamp(),
            manually_updated: true
        });

        res.json({
            success: true,
            message: 'Guidance updated successfully'
        });
    } catch (error) {
        console.error('Error updating guidance:', error);
        res.status(500).json({
            error: 'Failed to update guidance',
            message: error.message
        });
    }
});

/**
 * POST /api/admin/trigger-newsletter
 * Generate and send test newsletter
 */
router.post('/trigger-newsletter', checkAuth, async (req, res) => {
    try {
        console.log('📧 Admin triggered test newsletter generation...');

        // Generate and send newsletter to test users only
        const result = await newsletterService.generateAndSendTestNewsletter();

        res.json({
            success: true,
            message: 'Test newsletter sent successfully',
            archiveUrl: result.archiveUrl,
            recipientCount: result.recipientCount,
            storyCount: result.storyCount
        });
    } catch (error) {
        console.error('Error triggering newsletter:', error);
        res.status(500).json({
            error: 'Failed to generate newsletter',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/newsletter-archives
 * Get list of recent newsletter archives
 */
router.get('/newsletter-archives', checkAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;

        // Get newsletters from Firestore
        const recentNewsletters = await newsletters.getHistory({ limit });

        // Map to archive format
        const archives = recentNewsletters.map(nl => ({
            date: nl.date,
            archiveUrl: nl.archive_url,
            recipientCount: nl.recipient_count,
            isTest: nl.is_test || false,
            storyCount: nl.story_ids?.length || 0
        }));

        res.json({ archives });
    } catch (error) {
        console.error('Error fetching archives:', error);
        res.status(500).json({
            error: 'Failed to fetch archives',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/voting-report
 * Get aggregate voting statistics for sources and categories
 */
router.get('/voting-report', checkAuth, async (req, res) => {
    try {
        const votingReportService = require('../services/voting-report');
        const report = await votingReportService.generateVotingReport();

        res.json(report);
    } catch (error) {
        console.error('Error generating voting report:', error);
        res.status(500).json({
            error: 'Failed to generate voting report',
            message: error.message
        });
    }
});

module.exports = router;
