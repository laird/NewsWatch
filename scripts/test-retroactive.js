const { stories } = require('../backend/database/firestore');
const { addDoc, serverTimestamp, timestampFromDate } = require('../backend/database/db-firestore');
const { deduplicateExisting } = require('./deduplicate-existing'); // We need to export this function first!

// Mock data
const runId = Date.now();
const story1 = {
    headline: "Black Forest Labs raises $300M Series B",
    url: `https://techcrunch.com/2025/12/02/black-forest-labs-raises-300m-${runId}`,
    content: "Black Forest Labs has raised $300 million in a Series B round led by Andreessen Horowitz. The company develops generative AI models for image creation.",
    summary: "Black Forest Labs raises $300M for generative AI image models.",
    source: "TechCrunch",
    published_at: new Date()
};

const story2 = {
    headline: "Generative AI startup Black Forest Labs secures $300 million",
    url: `https://venturebeat.com/ai/black-forest-labs-secures-300-million-funding-${runId}`,
    content: "Generative AI startup Black Forest Labs announced today it has secured $300 million in new funding. The round values the company at $1.5 billion.",
    summary: "Black Forest Labs secures $300 million funding at $1.5B valuation.",
    source: "VentureBeat",
    published_at: new Date(Date.now() + 1000 * 60 * 30)
};

async function runTest() {
    console.log('🧪 Starting Retroactive Deduplication Test...');

    try {
        // 1. Clear database
        const { db } = require('../backend/database/db-firestore');
        const snapshot = await db.collection('stories').get();
        if (!snapshot.empty) {
            const batch = db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            console.log('   ✓ Cleared database');
        }

        // 2. Manually insert duplicates (bypassing ingestion logic)
        console.log('\n2. Inserting duplicate stories manually...');

        const s1Data = {
            ...story1,
            sources: [{ name: story1.source, url: story1.url, published_at: story1.published_at }],
            published_at: timestampFromDate(story1.published_at),
            ingested_at: serverTimestamp(),
            created_at: serverTimestamp()
        };
        const s1 = await addDoc('stories', s1Data);
        console.log(`   ✓ Inserted Story A: ${s1.id}`);

        const s2Data = {
            ...story2,
            sources: [{ name: story2.source, url: story2.url, published_at: story2.published_at }],
            published_at: timestampFromDate(story2.published_at),
            ingested_at: serverTimestamp(),
            created_at: serverTimestamp()
        };
        const s2 = await addDoc('stories', s2Data);
        console.log(`   ✓ Inserted Story B: ${s2.id}`);

        // 3. Run deduplication script
        console.log('\n3. Running deduplication script...');
        // We need to run the script as a child process because it might not export the function cleanly
        // or we can modify the script to export. Let's try running as child process.
        const { execSync } = require('child_process');
        try {
            const output = execSync('node scripts/deduplicate-existing.js', { encoding: 'utf8' });
            console.log(output);
        } catch (e) {
            console.error('Script failed:', e.message);
        }

        // 4. Verify results
        console.log('\n4. Verifying results...');
        const finalS1 = await stories.getById(s1.id);
        const finalS2 = await stories.getById(s2.id);

        if (finalS2.is_duplicate && finalS2.merged_into === s1.id) {
            console.log('   ✅ SUCCESS: Story B marked as duplicate of Story A');
        } else if (finalS1.is_duplicate && finalS1.merged_into === s2.id) {
            console.log('   ✅ SUCCESS: Story A marked as duplicate of Story B');
        } else {
            console.error('   ❌ FAILURE: Stories were not merged');
            console.log('   Story A:', finalS1);
            console.log('   Story B:', finalS2);
            process.exit(1);
        }

        console.log('\n✅ Test Complete');
        process.exit(0);

    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

runTest();
