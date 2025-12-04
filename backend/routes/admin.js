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

/**
 * POST /api/admin/check-feedback
 * Manually trigger feedback checking from emails
 */
router.post('/check-feedback', checkAuth, async (req, res) => {
    try {
        console.log('📧 Admin triggered feedback check...');
        const feedbackService = require('../services/feedback-ingestion');
        await feedbackService.ingestEmailFeedback();

        res.json({
            success: true,
            message: 'Feedback check completed'
        });
    } catch (error) {
        console.error('Error checking feedback:', error);
        res.status(500).json({
            error: 'Failed to check feedback',
            message: error.message
        });
    }
});

/**
 * POST /api/admin/reprocess-stories
 * Trigger reprocessing of stories to update categorization
 */
router.post('/reprocess-stories', checkAuth, async (req, res) => {
    try {
        console.log('🔄 Admin triggered story reprocessing...');

        // Run asynchronously to avoid timeout
        // In a real production app, this should be a background job (Cloud Tasks/PubSub)
        // For now, we'll start it and return success, logging progress to server logs.

        const { queryDocs } = require('../database/db-firestore');
        const { analyzePEImpact } = require('../services/peAnalysis');

        (async () => {
            try {
                const stories = await queryDocs('stories', [], {
                    orderBy: { field: 'ingested_at', direction: 'desc' },
                    limit: 100 // Limit to 100 most recent for safety/timeout
                });

                console.log(`[REPROCESS] Found ${stories.length} stories to reprocess`);

                for (const story of stories) {
                    try {
                        console.log(`[REPROCESS] Analyzing: ${story.headline.substring(0, 30)}...`);
                        await analyzePEImpact(story);
                        // Small delay
                        await new Promise(r => setTimeout(r, 500));
                    } catch (err) {
                        console.error(`[REPROCESS] Failed story ${story.id}:`, err.message);
                    }
                }
                console.log('[REPROCESS] Completed successfully');
            } catch (err) {
                console.error('[REPROCESS] Fatal error:', err);
            }
        })();

        res.json({
            success: true,
            message: 'Reprocessing started in background (checking last 100 stories). Check server logs for progress.'
        });
    } catch (error) {
        console.error('Error triggering reprocessing:', error);
        res.status(500).json({
            error: 'Failed to trigger reprocessing',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/logs
 * Get available log files or read log content
 * Query params:
 *   - list: if true, returns list of available log files
 *   - file: log filename to read
 *   - lines: number of lines to retrieve (default 100)
 */
router.get('/logs', checkAuth, async (req, res) => {
    try {
        const { list, file, lines = 100 } = req.query;
        const fs = require('fs').promises;
        const path = require('path');
        const logsDir = path.join(__dirname, '../..');

        if (list) {
            // List all .log files
            const allFiles = await fs.readdir(logsDir);
            const logFiles = allFiles.filter(f => f.endsWith('.log'));

            // Get file sizes and modification times
            const filesWithInfo = await Promise.all(
                logFiles.map(async (filename) => {
                    const filePath = path.join(logsDir, filename);
                    const stats = await fs.stat(filePath);
                    return {
                        filename,
                        size: stats.size,
                        modified: stats.mtime
                    };
                })
            );

            // Sort by modification time (newest first)
            filesWithInfo.sort((a, b) => b.modified - a.modified);

            res.json({ files: filesWithInfo });
        } else if (file) {
            // Read specific log file
            const filePath = path.join(logsDir, file);

            // Security check: prevent path traversal
            if (!filePath.startsWith(logsDir) || !file.endsWith('.log')) {
                return res.status(400).json({ error: 'Invalid file name' });
            }

            try {
                const content = await fs.readFile(filePath, 'utf-8');
                const allLines = content.split('\n');
                const numLines = parseInt(lines) || 100;

                // Get last N lines
                const lastLines = allLines.slice(-numLines);

                res.json({
                    filename: file,
                    totalLines: allLines.length,
                    lines: numLines,
                    content: lastLines.join('\n')
                });
            } catch (err) {
                if (err.code === 'ENOENT') {
                    return res.status(404).json({ error: 'Log file not found' });
                }
                throw err;
            }
        } else {
            res.status(400).json({ error: 'Must specify either list=true or file=filename' });
        }
    } catch (error) {
        console.error('Error reading logs:', error);
        res.status(500).json({
            error: 'Failed to read logs',
            message: error.message
        });
    }
});

module.exports = router;
