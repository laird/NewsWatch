const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { analyzePEImpact } = require('../services/peAnalysis');

// Get all stories
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const minPEScore = parseFloat(req.query.minPEScore) || 0;

        const result = await db.query(
            `SELECT id, headline, source, author, url, summary, published_at, 
              pe_impact_score, pe_analysis, relevance_score
       FROM stories
       WHERE pe_impact_score >= $1
       ORDER BY ingested_at DESC
       LIMIT $2 OFFSET $3`,
            [minPEScore, limit, offset]
        );

        res.json({
            stories: result.rows,
            limit,
            offset,
            count: result.rows.length
        });

    } catch (error) {
        console.error('Error fetching stories:', error);
        res.status(500).json({ error: 'Failed to fetch stories' });
    }
});

// Get single story by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'SELECT * FROM stories WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Story not found' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Error fetching story:', error);
        res.status(500).json({ error: 'Failed to fetch story' });
    }
});

// Get top stories for newsletter
router.get('/top/newsletter', async (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        const limit = parseInt(req.query.limit) || 12;

        const result = await db.query(
            `SELECT id, headline, source, author, url, summary, published_at,
              pe_impact_score, pe_analysis, relevance_score
       FROM stories
       WHERE ingested_at > NOW() - INTERVAL '${hours} hours'
       ORDER BY pe_impact_score DESC NULLS LAST, relevance_score DESC NULLS LAST
       LIMIT $1`,
            [limit]
        );

        res.json({
            stories: result.rows,
            hours,
            count: result.rows.length
        });

    } catch (error) {
        console.error('Error fetching top stories:', error);
        res.status(500).json({ error: 'Failed to fetch top stories' });
    }
});

// Analyze story for PE impact
router.post('/:id/analyze', async (req, res) => {
    try {
        const { id } = req.params;

        // Get story
        const storyResult = await db.query(
            'SELECT * FROM stories WHERE id = $1',
            [id]
        );

        if (storyResult.rows.length === 0) {
            return res.status(404).json({ error: 'Story not found' });
        }

        const story = storyResult.rows[0];

        // Analyze
        const analysis = await analyzePEImpact(story);

        res.json({
            success: true,
            analysis
        });

    } catch (error) {
        console.error('Error analyzing story:', error);
        res.status(500).json({ error: 'Failed to analyze story' });
    }
});

module.exports = router;
