const express = require('express');
const router = express.Router();
const { feedback, stories, sourceQuality } = require('../database/firestore');

// Handle vote via GET link (for email)
router.get('/', async (req, res) => {
    try {
        const { storyId, rating } = req.query;

        // Validation
        if (!storyId || !rating) {
            return res.status(400).send('Missing storyId or rating');
        }

        if (!['up', 'down'].includes(rating)) {
            return res.status(400).send('Invalid rating');
        }

        // Get client IP
        const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        // Insert feedback
        await feedback.create({
            story_id: storyId,
            rating,
            feedback_text: null,
            ip_address: ipAddress,
            source: 'email_link'
        });

        // Update Source Quality Score
        const story = await stories.getById(storyId);
        if (story && story.url) {
            try {
                const domain = new URL(story.url).hostname.replace('www.', '');
                const scoreChange = rating === 'up' ? 0.1 : -0.2;
                const isPositive = rating === 'up';

                await sourceQuality.upsert(domain, story.source || domain, scoreChange, isPositive);
                console.log(`✓ Updated quality score for ${domain} (${rating === 'up' ? '+' : ''}${scoreChange})`);
            } catch (e) {
                console.error('Error updating source quality:', e);
            }
        }

        console.log(`✓ Email vote received: ${rating} for story ${storyId}`);

        // Redirect to success page
        res.redirect('/vote-success.html');

    } catch (error) {
        console.error('Error processing vote link:', error);
        res.status(500).send('Failed to process vote');
    }
});

module.exports = router;
