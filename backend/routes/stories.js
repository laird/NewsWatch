const express = require('express');
const router = express.Router();
const { stories } = require('../database/firestore');
const { analyzePEImpact } = require('../services/peAnalysis');

// Get all stories
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const minPEScore = parseFloat(req.query.minPEScore) || 0;

        const storyList = await stories.getAll({ limit, offset, minPEScore });

        res.json({
            stories: storyList,
            limit,
            offset,
            count: storyList.length
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

        const story = await stories.getById(id);

        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }

        res.json(story);

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

        const storyList = await stories.getTopForNewsletter({ hours, limit });

        res.json({
            stories: storyList,
            hours,
            count: storyList.length
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
        const story = await stories.getById(id);

        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }

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
