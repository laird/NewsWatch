const { stories } = require('../backend/database/firestore');
const { findSimilarStory, mergeExistingStories, calculateSimilarity, calculateOverlap } = require('../backend/services/storyDeduplication');

async function deduplicateExisting(dryRun = false) {
    console.log(`🧹 Starting Retroactive Deduplication ${dryRun ? '(DRY RUN)' : ''}...`);
    console.log('──────────────────────────────────────────────────────────');

    try {
        // 1. Fetch all stories
        // We need to fetch ALL stories to be thorough, but for performance we might want to limit
        // For now, let's fetch last 500 stories
        const allStories = await stories.getAll({ limit: 500 });
        console.log(`✓ Fetched ${allStories.length} stories to analyze`);

        let mergeCount = 0;
        const processedIds = new Set();

        // 2. Iterate and compare
        for (let i = 0; i < allStories.length; i++) {
            const story = allStories[i];

            if (processedIds.has(story.id)) continue;
            if (story.is_duplicate) continue; // Skip already duplicated stories

            // Look for duplicates in the REST of the list
            for (let j = i + 1; j < allStories.length; j++) {
                const candidate = allStories[j];

                if (processedIds.has(candidate.id)) continue;
                if (candidate.is_duplicate) continue; // Skip already duplicated stories

                // Check similarity
                const headlineJaccard = calculateSimilarity(story.headline, candidate.headline);
                const headlineOverlap = calculateOverlap(story.headline, candidate.headline);
                const headlineSim = Math.max(headlineJaccard, headlineOverlap);

                const contentSim = calculateSimilarity(
                    (story.content || '').substring(0, 200),
                    (candidate.content || '').substring(0, 200)
                );

                const combinedScore = (headlineSim + contentSim) / 2;

                // Lower threshold for AI candidates (was 0.35)
                if (combinedScore > 0.25) {
                    console.log(`\n🔍 Potential Duplicate Found (Score: ${combinedScore.toFixed(2)}):`);
                    console.log(`   A: [${story.id}] ${story.headline}`);
                    console.log(`   B: [${candidate.id}] ${candidate.headline}`);

                    let shouldMerge = false;

                    // Use AI to confirm if available
                    if (process.env.GEMINI_API_KEY) {
                        const { checkSemanticSimilarity } = require('../backend/services/storyDeduplication');
                        const aiResult = await checkSemanticSimilarity(story, candidate);

                        if (aiResult.isDuplicate && aiResult.confidence > 70) {
                            console.log(`   🤖 AI Confirmed: ${aiResult.reason} (${aiResult.confidence}%)`);
                            shouldMerge = true;
                        } else {
                            console.log(`   🤖 AI Rejected: ${aiResult.reason} (${aiResult.confidence}%)`);
                        }
                    } else {
                        // Fallback to strict heuristic
                        if (combinedScore > 0.4) {
                            console.log(`   ⚠️  No AI key, using heuristic threshold`);
                            shouldMerge = true;
                        }
                    }

                    if (shouldMerge) {
                        if (!dryRun) {
                            // Merge B into A
                            await mergeExistingStories(story, candidate);
                            processedIds.add(candidate.id);
                            mergeCount++;
                        } else {
                            console.log(`   [DRY RUN] Would merge B into A`);
                        }
                    }
                }
            }
        }

        console.log('\n──────────────────────────────────────────────────────────');
        console.log(`✅ Deduplication Complete. Merged ${mergeCount} pairs.`);
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Deduplication Failed:', error);
        process.exit(1);
    }
}

// Check for --dry-run flag
const isDryRun = process.argv.includes('--dry-run');
deduplicateExisting(isDryRun);
