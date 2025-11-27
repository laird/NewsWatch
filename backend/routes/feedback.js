const express = require('express');
const router = express.Router();
const { feedback, stories, sourceQuality } = require('../database/firestore');

// Submit feedback
router.post('/', async (req, res) => {
    try {
        const { storyId, rating, text, headline } = req.body;

        // Validation
        if (!storyId || !rating) {
            return res.status(400).json({ error: 'storyId and rating are required' });
        }

        if (!['up', 'down'].includes(rating)) {
            return res.status(400).json({ error: 'rating must be "up" or "down"' });
        }

        // Get client IP
        const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        // Insert feedback
        const newFeedback = await feedback.create({
            story_id: storyId,
            rating,
            feedback_text: text || null,
            ip_address: ipAddress
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

        console.log(`✓ Feedback received: ${rating} for story ${storyId}`);

        res.status(201).json({
            success: true,
            feedback: newFeedback
        });

    } catch (error) {
        console.error('Error saving feedback:', error);
        res.status(500).json({ error: 'Failed to save feedback' });
    }
});

// Get feedback stats for a story
router.get('/stats/:storyId', async (req, res) => {
    try {
        const { storyId } = req.params;

        const stats = await feedback.getStatsByStoryId(storyId);

        res.json(stats);

    } catch (error) {
        console.error('Error fetching feedback stats:', error);
        res.status(500).json({ error: 'Failed to fetch feedback stats' });
    }
});

// Get all feedback (admin only - add auth later)
router.get('/all', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const feedbackList = await feedback.getAll({ limit, offset });

        res.json({
            feedback: feedbackList,
            limit,
            offset
        });

    } catch (error) {
        console.error('Error fetching all feedback:', error);
        res.status(500).json({ error: 'Failed to fetch feedback' });
    }
});

module.exports = router;
