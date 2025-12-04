const { stories } = require('../backend/database/firestore');
const { timestampFromDate } = require('../backend/database/db-firestore');

async function seedData() {
    console.log('Seeding test data...');

    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);

    // 1. Old story (should NOT be in newsletter)
    await stories.create({
        headline: 'Old Story',
        url: 'http://example.com/old',
        source: 'Old Source',
        published_at: timestampFromDate(twoDaysAgo),
        ingested_at: timestampFromDate(twoDaysAgo),
        pe_impact_score: 5,
        sources: [{ name: 'Old Source', url: 'http://example.com/old', published_at: twoDaysAgo.toISOString() }]
    });
    console.log('Created Old Story');

    // 2. New story (should be in newsletter)
    await stories.create({
        headline: 'New Story',
        url: 'http://example.com/new',
        source: 'New Source',
        published_at: timestampFromDate(oneHourAgo),
        ingested_at: timestampFromDate(oneHourAgo),
        pe_impact_score: 8,
        sources: [{ name: 'New Source', url: 'http://example.com/new', published_at: oneHourAgo.toISOString() }]
    });
    console.log('Created New Story');

    // 3. Old story with new source (should be in newsletter)
    // Note: We simulate this by creating it with old ingested_at but one new source
    await stories.create({
        headline: 'Old Story with New Source',
        url: 'http://example.com/old-new',
        source: 'Old Source',
        published_at: timestampFromDate(twoDaysAgo),
        ingested_at: timestampFromDate(twoDaysAgo),
        pe_impact_score: 9,
        sources: [
            { name: 'Old Source', url: 'http://example.com/old-new', published_at: twoDaysAgo.toISOString() },
            { name: 'New Source', url: 'http://example.com/old-new-2', published_at: oneHourAgo.toISOString() }
        ]
    });
    console.log('Created Old Story with New Source');

    console.log('Seeding complete.');
}

seedData().catch(console.error);
