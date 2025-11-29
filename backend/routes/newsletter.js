const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { generateAndSendNewsletter } = require('../services/newsletter');
const { generateStaticSite } = require('../generate-site');

// Get latest newsletter
router.get('/latest', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM newsletters
       ORDER BY date DESC
       LIMIT 1`
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No newsletters found' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Error fetching latest newsletter:', error);
        res.status(500).json({ error: 'Failed to fetch newsletter' });
    }
});

// Get newsletter history
router.get('/history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 30;
        const offset = parseInt(req.query.offset) || 0;

        const result = await db.query(
            `SELECT * FROM newsletters
       ORDER BY date DESC
       LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        res.json({
            newsletters: result.rows,
            limit,
            offset,
            count: result.rows.length
        });

    } catch (error) {
        console.error('Error fetching newsletter history:', error);
        res.status(500).json({ error: 'Failed to fetch newsletter history' });
    }
});

// Send newsletter now (manual trigger)
router.post('/send', async (req, res) => {
    try {
        console.log('📧 Manual newsletter send triggered');

        const result = await generateAndSendNewsletter();

        res.json({
            success: true,
            recipientCount: result.recipientCount,
            storyCount: result.storyCount,
            sentAt: result.sentAt
        });

    } catch (error) {
        console.error('Error sending newsletter:', error);
        res.status(500).json({
            error: 'Failed to send newsletter',
            message: error.message
        });
    }
});

// Generate static site (manual trigger)
router.post('/generate-site', async (req, res) => {
    try {
        console.log('🏗️ Manual static site generation triggered');
        await generateStaticSite();
        res.json({ success: true, message: 'Static site generated successfully' });
    } catch (error) {
        console.error('Error generating static site:', error);
        res.status(500).json({ error: 'Failed to generate static site', message: error.message });
    }
});

module.exports = router;
