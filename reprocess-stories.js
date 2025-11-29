// Reprocess all stories with AI analysis
require('dotenv').config();
const db = require('./backend/database/db');
const { analyzePEImpact } = require('./backend/services/peAnalysis');

async function reprocessAllStories() {
    console.log('🔄 Reprocessing all stories with AI analysis...\n');

    try {
        // Get all stories
        const result = await db.query('SELECT * FROM stories ORDER BY ingested_at DESC');
        const stories = result.rows;

        console.log(`Found ${stories.length} stories to process\n`);
        console.log(`Using AI Provider: ${process.env.AI_PROVIDER || 'auto'}`);
        console.log(`Using Base URL: ${process.env.OPENAI_BASE_URL || 'default'}`);
        console.log(`Using Model: ${process.env.AI_MODEL || 'default'}\n`);

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < stories.length; i++) {
            const story = stories[i];
            console.log(`[${i + 1}/${stories.length}] Processing: ${story.headline.substring(0, 60)}...`);

            try {
                // Synchronously wait for AI analysis
                const analysis = await analyzePEImpact(story);

                if (analysis.key_insights && analysis.key_insights.length > 0) {
                    console.log(`  ✓ Success - First insight: ${analysis.key_insights[0].substring(0, 80)}...`);
                    successCount++;
                } else {
                    console.log(`  ⚠ No insights generated`);
                }
            } catch (error) {
                console.error(`  ✗ Error: ${error.message}`);
                errorCount++;
            }

            console.log(''); // Empty line for readability
        }

        console.log('\n📊 Reprocessing complete!');
        console.log(`  ✓ Successful: ${successCount}`);
        console.log(`  ✗ Errors: ${errorCount}`);
        console.log(`  Total: ${stories.length}`);

        process.exit(0);
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

reprocessAllStories();
