const { stories } = require('../backend/database/firestore');
const { addDoc, deleteDoc } = require('../backend/database/db-firestore');

// Mock data
const runId = Date.now();
const story1 = {
    headline: "Black Forest Labs raises $300M Series B",
    url: `https://techcrunch.com/2025/12/02/black-forest-labs-raises-300m-${runId}`,
    content: "Black Forest Labs has raised $300 million in a Series B round led by Andreessen Horowitz.",
    summary: "Black Forest Labs raises $300M.",
    source: "TechCrunch",
    published_at: new Date(),
    pe_impact_score: 5
};

const story2 = {
    headline: "Black Forest Labs gets $300M investment",
    url: `https://www.theinformation.com/articles/black-forest-labs-gets-300m-investment-${runId}`,
    content: "Black Forest Labs has received a $300 million investment.",
    summary: "Black Forest Labs gets $300M investment.",
    source: "The Information",
    published_at: new Date(),
    pe_impact_score: 4
};

async function runTest() {
    console.log('🧪 Starting Retroactive Deduplication Test...');
    console.log('──────────────────────────────────────────');

    try {
        // 0. Clear database
        console.log('\n0. Clearing database...');
        const { db } = require('../backend/database/db-firestore');
        const snapshot = await db.collection('stories').get();
        if (!snapshot.empty) {
            const batch = db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
        console.log('   ✓ Database cleared');

        // 1. Insert duplicates manually (bypassing deduplication logic)
        console.log('\n1. Inserting duplicates manually...');

        const s1 = await addDoc('stories', {
            ...story1,
            sources: [{ name: story1.source, url: story1.url, published_at: story1.published_at }],
            ingested_at: new Date(),
            created_at: new Date()
        });
        console.log(`   ✓ Inserted story 1: ${s1.id}`);

        const s2 = await addDoc('stories', {
            ...story2,
            sources: [{ name: story2.source, url: story2.url, published_at: story2.published_at }],
            ingested_at: new Date(),
            created_at: new Date()
        });
        console.log(`   ✓ Inserted story 2: ${s2.id}`);

        // 2. Run deduplication script
        console.log('\n2. Running deduplication script...');
        // We can't easily require the script as it runs on load, so we'll execute it via child_process
        const { execSync } = require('child_process');
        try {
            const output = execSync('export FIRESTORE_EMULATOR_HOST=localhost:8080 && export GPROJECT_ID=newswatch-local && node scripts/deduplicate-existing.js', { encoding: 'utf8' });
            console.log(output);
        } catch (e) {
            console.error('Script execution failed:', e.stdout, e.stderr);
            throw e;
        }

        // 3. Verify results
        console.log('\n3. Verifying results...');
        const finalStories = await stories.getAll({ limit: 10 });
        console.log(`   Found ${finalStories.length} stories`);

        // We expect 2 stories still, but one should be marked as duplicate
        const activeStories = finalStories.filter(s => !s.is_duplicate);
        const duplicateStories = finalStories.filter(s => s.is_duplicate);

        if (activeStories.length === 1 && duplicateStories.length === 1) {
            console.log('   ✓ Correctly identified 1 active and 1 duplicate story');

            const winner = activeStories[0];
            const loser = duplicateStories[0];

            console.log(`   Winner sources: ${winner.sources.length}`);
            if (winner.sources.length === 2) {
                console.log('   ✓ Winner has correct source count (2)');
                winner.sources.forEach(s => console.log(`     - ${s.name}`));
            } else {
                console.error(`   ✗ Winner has incorrect source count: ${winner.sources.length}`);
                process.exit(1);
            }

            if (loser.merged_into === winner.id) {
                console.log('   ✓ Loser correctly points to winner');
            } else {
                console.error('   ✗ Loser merged_into ID mismatch');
                process.exit(1);
            }

        } else {
            console.error(`   ✗ Unexpected state! Active: ${activeStories.length}, Duplicates: ${duplicateStories.length}`);
            process.exit(1);
        }

        console.log('\n✅ Test Complete');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Test Failed:', error);
        process.exit(1);
    }
}

runTest();
