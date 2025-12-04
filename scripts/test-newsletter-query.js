const { stories } = require('../backend/database/firestore');

async function testNewsletterQuery() {
    console.log('Testing newsletter query (last 24 hours)...');

    try {
        const results = await stories.getTopForNewsletter({ hours: 24, limit: 20 });

        console.log(`Found ${results.length} stories.`);

        console.log('\nResults:');
        results.forEach((story, index) => {
            const ingested = story.ingested_at ? story.ingested_at.toDate().toISOString() : 'N/A';
            const lastSource = story.last_source_at ? story.last_source_at.toDate().toISOString() : 'N/A';
            const isOldStoryNewSource = story.ingested_at && story.last_source_at &&
                story.last_source_at.toDate() > story.ingested_at.toDate() &&
                (story.last_source_at.toDate() - story.ingested_at.toDate()) > 1000; // > 1s diff

            console.log(`${index + 1}. [${story.pe_impact_score}] ${story.headline.substring(0, 50)}...`);
            console.log(`   Ingested: ${ingested}`);
            console.log(`   Last Src: ${lastSource}`);
            if (isOldStoryNewSource) {
                console.log('   MATCH: Old story with new source!');
            }
            console.log('---');
        });

    } catch (error) {
        console.error('Query failed:', error);
    }
}

testNewsletterQuery().catch(console.error);
