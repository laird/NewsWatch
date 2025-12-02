const { processStory } = require('../backend/services/storyDeduplication');
const { stories } = require('../backend/database/firestore');
const { analyzePEImpact } = require('../backend/services/peAnalysis');

// Mock data for Black Forest Labs funding stories
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
    published_at: new Date(Date.now() + 1000 * 60 * 30) // 30 mins later
};

const story3 = {
    headline: "Black Forest Labs gets $300M investment for AI art tools",
    url: `https://www.theinformation.com/articles/black-forest-labs-gets-300m-investment-${runId}`,
    content: "Black Forest Labs, the creator of the popular Flux model, has received a $300 million investment. Investors include a16z and Sequoia.",
    summary: "Black Forest Labs gets $300M investment from a16z and Sequoia.",
    source: "The Information",
    published_at: new Date(Date.now() + 1000 * 60 * 60) // 1 hour later
};

async function runTest() {
    console.log('🧪 Starting Deduplication Test...');
    console.log('─────────────────────────────────');

    try {
        // 0. Clear database (using direct access to bypass filters)
        console.log('\n0. Clearing database...');
        const { db } = require('../backend/database/db-firestore');
        const snapshot = await db.collection('stories').get();

        if (!snapshot.empty) {
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            console.log(`   ✓ Deleted ${snapshot.size} existing stories`);
        } else {
            console.log('   ✓ Database already empty');
        }

        // 1. Ingest first story
        console.log('\n1. Processing first story...');
        const result1 = await processStory(story1);
        const id1 = typeof result1 === 'object' ? result1.id : result1;
        console.log(`   ✓ Created story ID: ${id1}`);

        // 2. Ingest second story (should merge)
        console.log('\n2. Processing second story (should merge)...');
        const result2 = await processStory(story2);
        const id2 = typeof result2 === 'object' ? result2.id : result2;

        if (id1 === id2) {
            console.log(`   ✓ MERGED! Story ID remains: ${id2}`);
        } else {
            console.error(`   ✗ FAILED TO MERGE! Created new ID: ${id2}`);
        }

        // 3. Ingest third story (should merge)
        console.log('\n3. Processing third story (should merge)...');
        const result3 = await processStory(story3);
        const id3 = typeof result3 === 'object' ? result3.id : result3;

        if (id1 === id3) {
            console.log(`   ✓ MERGED! Story ID remains: ${id3}`);
        } else {
            console.error(`   ✗ FAILED TO MERGE! Created new ID: ${id3}`);
        }

        // 4. Verify final state
        console.log('\n4. Verifying final story state...');
        const finalStory = await stories.getById(id1);

        console.log(`   Headline: ${finalStory.headline}`);
        console.log(`   Source Count: ${finalStory.sources ? finalStory.sources.length : 1}`);

        if (finalStory.sources && finalStory.sources.length === 3) {
            console.log('   ✓ Source count is correct (3)');
            finalStory.sources.forEach(s => console.log(`     - ${s.name} (${s.url})`));
        } else {
            console.error(`   ✗ Incorrect source count: ${finalStory.sources ? finalStory.sources.length : 1} (expected 3)`);
        }

        console.log('\n✅ Test Complete');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Test Failed:', error);
        process.exit(1);
    }
}

// Run the test
runTest();
