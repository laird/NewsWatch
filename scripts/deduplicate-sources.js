const { stories } = require('../backend/database/firestore');
const { updateDoc } = require('../backend/database/db-firestore');
const { normalizeUrl } = require('../backend/services/storyDeduplication');

/**
 * Helper to deduplicate sources
 * Copied from storyDeduplication.js to ensure standalone execution
 */
function dedupeSources(sources) {
    const seenUrls = new Set();
    const seenSources = new Set();

    return sources.filter(src => {
        const normUrl = normalizeUrl(src.url);

        // 1. Check URL duplication
        if (seenUrls.has(normUrl)) return false;
        seenUrls.add(normUrl);

        // 2. Check Source Name duplication
        if (src.name) {
            const normalizedName = src.name.toLowerCase().trim();
            if (seenSources.has(normalizedName)) return false;
            seenSources.add(normalizedName);
        }

        return true;
    });
}

async function runCleanup() {
    console.log('🧹 Starting Source Deduplication Cleanup...');

    try {
        // Get all stories
        // In a real large DB we'd paginate, but for now we'll fetch recent ones or all
        const allStories = await stories.getAll();
        console.log(`   Found ${allStories.length} stories to check.`);

        let updatedCount = 0;

        for (const story of allStories) {
            if (!story.sources || story.sources.length <= 1) continue;

            const originalCount = story.sources.length;
            const uniqueSources = dedupeSources(story.sources);

            if (uniqueSources.length < originalCount) {
                console.log(`   Fixing story: "${story.headline}"`);
                console.log(`     Sources: ${originalCount} -> ${uniqueSources.length}`);

                await updateDoc('stories', story.id, {
                    sources: uniqueSources
                });
                updatedCount++;
            }
        }

        console.log(`\n✅ Cleanup Complete. Updated ${updatedCount} stories.`);
        process.exit(0);

    } catch (error) {
        console.error('Cleanup failed:', error);
        process.exit(1);
    }
}

runCleanup();
