// Script to reprocess all stories to update categorization
// Force production project ID
process.env.GCP_PROJECT_ID = 'newswatch-479605';
delete process.env.FIRESTORE_EMULATOR_HOST;

require('dotenv').config({ path: require('path').resolve(__dirname, 'backend/.env') });
const { queryDocs } = require('./backend/database/db-firestore');
const { analyzePEImpact } = require('./backend/services/peAnalysis');

async function reprocessAllStories() {
    console.log('🔍 Starting reprocessing of all stories (PRODUCTION)...\n');

    // Get all stories
    const stories = await queryDocs('stories', [], {
        orderBy: { field: 'ingested_at', direction: 'desc' }
    });

    console.log(`Found ${stories.length} stories to reprocess\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const [index, story] of stories.entries()) {
        try {
            console.log(`[${index + 1}/${stories.length}] Analyzing: ${story.headline.substring(0, 60)}...`);

            // Analyze and update (analyzePEImpact saves to DB)
            const analysis = await analyzePEImpact(story);

            console.log(`  ✓ Updated.`);
            console.log(`    Categories: ${analysis.categories.join(', ')}`);
            console.log(`    Location:   ${analysis.location}`);
            console.log(`    Companies:  ${analysis.companies.join(', ')}`);
            successCount++;

            // Add a small delay to avoid hitting rate limits too hard
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            console.error(`  ✗ Failed: ${error.message}`);
            errorCount++;
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 REPROCESSING COMPLETE');
    console.log('='.repeat(80));
    console.log(`Total Stories: ${stories.length}`);
    console.log(`Successfully Updated: ${successCount}`);
    console.log(`Failed: ${errorCount}`);
    console.log('='.repeat(80) + '\n');

    process.exit(0);
}

reprocessAllStories().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
