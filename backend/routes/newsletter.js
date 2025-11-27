const express = require('express');
const router = express.Router();
const { newsletters } = require('../database/firestore');
const { generateAndSendNewsletter } = require('../services/newsletter');

// Get latest newsletter
router.get('/latest', async (req, res) => {
    try {
        const newsletter = await newsletters.getLatest();

        if (!newsletter) {
            return res.status(404).json({ error: 'No newsletters found' });
        }

        res.json(newsletter);

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

        const newsletterList = await newsletters.getHistory({ limit, offset });

        res.json({
            newsletters: newsletterList,
            limit,
            offset,
            count: newsletterList.length
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

module.exports = router;
