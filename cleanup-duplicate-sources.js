const { queryDocs, updateDoc } = require('./backend/database/db-firestore');
require('dotenv').config({ path: './backend/.env' });

async function cleanupDuplicateSources() {
    console.log('🧹 Starting cleanup of duplicate sources...');

    try {
        // Get all stories
        const stories = await queryDocs('stories', [], { limit: 1000 }); // Process in batches if needed
        console.log(`Found ${stories.length} stories to check.`);

        let updatedCount = 0;

        for (const story of stories) {
            if (!story.sources || !Array.isArray(story.sources) || story.sources.length <= 1) {
                continue;
            }

            const originalCount = story.sources.length;
            const uniqueSources = [];
            const seen = new Set();

            for (const source of story.sources) {
                // Create a unique key based on URL and Name
                // Normalize URL by removing query params for stricter deduplication if needed
                // For now, just use the full URL as that's what the ingestion logic uses
                const key = `${source.name}|${source.url}`;

                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueSources.push(source);
                }
            }

            if (uniqueSources.length < originalCount) {
                console.log(`  📝 Fixing story "${story.headline.substring(0, 50)}..."`);
                console.log(`     Reduced sources from ${originalCount} to ${uniqueSources.length}`);

                await updateDoc('stories', story.id, {
                    sources: uniqueSources
                });
                updatedCount++;
            }
        }

        console.log(`\n✅ Cleanup complete. Updated ${updatedCount} stories.`);

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    }
}

// Run if called directly
if (require.main === module) {
    cleanupDuplicateSources()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}
