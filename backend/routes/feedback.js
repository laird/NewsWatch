const express = require('express');
const router = express.Router();
const db = require('../database/db');

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
        const result = await db.query(
            `INSERT INTO feedback (story_id, rating, feedback_text, ip_address)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
            [storyId, rating, text || null, ipAddress]
        );

        // Update Source Quality Score
        // 1. Get story source URL/domain
        const storyResult = await db.query('SELECT url, source FROM stories WHERE id = $1', [storyId]);
        if (storyResult.rows.length > 0) {
            const story = storyResult.rows[0];
            try {
                const domain = new URL(story.url).hostname.replace('www.', '');

                // 2. Update stats
                const scoreChange = rating === 'up' ? 0.1 : -0.2; // Penalize bad stories more than rewarding good ones

                await db.query(`
          INSERT INTO source_quality (domain, name, quality_score, total_stories, positive_feedback_count, negative_feedback_count)
          VALUES ($1, $2, 5.0 + $3, 1, $4, $5)
          ON CONFLICT (domain) DO UPDATE SET
            quality_score = GREATEST(0.0, LEAST(10.0, source_quality.quality_score + $3)),
            positive_feedback_count = source_quality.positive_feedback_count + $4,
            negative_feedback_count = source_quality.negative_feedback_count + $5,
            last_evaluated_at = NOW()
        `, [
                    domain,
                    story.source || domain,
                    scoreChange,
                    rating === 'up' ? 1 : 0,
                    rating === 'down' ? 1 : 0
                ]);

                console.log(`✓ Updated quality score for ${domain} (${rating === 'up' ? '+' : ''}${scoreChange})`);
            } catch (e) {
                console.error('Error updating source quality:', e);
            }
        }

        console.log(`✓ Feedback received: ${rating} for story ${storyId}`);

        res.status(201).json({
            success: true,
            feedback: result.rows[0]
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

        const result = await db.query(
            `SELECT 
        COUNT(*) as total_feedback,
        SUM(CASE WHEN rating = 'up' THEN 1 ELSE 0 END) as thumbs_up,
        SUM(CASE WHEN rating = 'down' THEN 1 ELSE 0 END) as thumbs_down
       FROM feedback
       WHERE story_id = $1`,
            [storyId]
        );

        res.json(result.rows[0]);

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

        const result = await db.query(
            `SELECT f.*, s.headline, s.source
       FROM feedback f
       LEFT JOIN stories s ON f.story_id = s.id
       ORDER BY f.submitted_at DESC
       LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        res.json({
            feedback: result.rows,
            limit,
            offset
        });

    } catch (error) {
        console.error('Error fetching all feedback:', error);
        res.status(500).json({ error: 'Failed to fetch feedback' });
    }
});

module.exports = router;
