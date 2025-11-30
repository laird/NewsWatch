const express = require('express');
const router = express.Router();
const { stories } = require('../database/firestore');
const { analyzePEImpact } = require('../services/peAnalysis');

// Reanalyze all stories (useful for testing new prompts or switching AI providers)
router.post('/reanalyze', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100; // Default to 100 to avoid overwhelming the AI

        // Get stories to reanalyze
        const storyList = await stories.getAll({ limit });

        console.log(`\n🔄 Reanalyzing ${storyList.length} stories...`);

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        // Process each story synchronously
        for (let i = 0; i < storyList.length; i++) {
            const story = storyList[i];
            console.log(`[${i + 1}/${storyList.length}] ${story.headline.substring(0, 60)}...`);

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
            processed: storyList.length,
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
