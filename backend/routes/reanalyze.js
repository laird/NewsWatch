const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { analyzePEImpact } = require('../services/peAnalysis');

// Reanalyze all stories (useful for testing new prompts or switching AI providers)
router.post('/reanalyze', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100; // Default to 100 to avoid overwhelming the AI

        // Get stories to reanalyze
        const result = await db.query(
            'SELECT * FROM stories ORDER BY ingested_at DESC LIMIT $1',
            [limit]
        );

        const stories = result.rows;
        console.log(`\n🔄 Reanalyzing ${stories.length} stories...`);

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        // Process each story synchronously
        for (let i = 0; i < stories.length; i++) {
            const story = stories[i];
            console.log(`[${i + 1}/${stories.length}] ${story.headline.substring(0, 60)}...`);

            try {
                await analyzePEImpact(story);
                successCount++;
                console.log(`  ✓ Success`);
            } catch (error) {
                errorCount++;
                errors.push({ id: story.id, headline: story.headline.substring(0, 60), error: error.message });
                console.error(`  ✗ Error: ${error.message}`);
            }
        }

        console.log(`\n✅ Reanalysis complete: ${successCount} success, ${errorCount} errors\n`);

        res.json({
            success: true,
            processed: stories.length,
            successful: successCount,
            errors: errorCount,
            errorDetails: errors
        });

    } catch (error) {
        console.error('Error reanalyzing stories:', error);
        res.status(500).json({ error: 'Failed to reanalyze stories', details: error.message });
    }
});

module.exports = router;
