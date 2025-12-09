const { stories } = require('./firestore');

const testStories = [
    {
        headline: 'Software Economy Booms in 1899',
        source: 'The Daily Telegraph',
        url: 'http://example.com/story1',
        published_at: new Date().toISOString(),
        summary: 'The software economy is booming with new inventions and steam-powered algorithms. Experts predict a bright future for the industry.',
        content: 'Full content of the article goes here...',
        pe_impact_score: 8,
        pe_analysis: {
            key_insights: ['Market is growing', 'Steam power is key'],
            sectors: ['Technology', 'Steam'],
            categories: ['Growth']
        },
        click_count: 10,
        thumbs_up_count: 5,
        thumbs_down_count: 0,
        is_duplicate: false
    },
    {
        headline: 'Local Developer Invents "Cloud" Computing',
        source: 'The Evening Post',
        url: 'http://example.com/story2',
        published_at: new Date(Date.now() - 86400000).toISOString(),
        summary: 'A local developer has proposed a system of "clouds" to store data. Critics call it vaporware.',
        content: 'Full content of the article goes here...',
        pe_impact_score: 9,
        pe_analysis: {
            key_insights: ['Revolutionary concept', 'High risk'],
            sectors: ['Infrastructure'],
            categories: ['Innovation']
        },
        click_count: 100,
        thumbs_up_count: 50,
        thumbs_down_count: 2,
        is_duplicate: false
    },
    {
        headline: 'Typescript: A Fad or the Future?',
        source: 'The Coding Gazette',
        url: 'http://example.com/story3',
        published_at: new Date(Date.now() - 172800000).toISOString(),
        summary: 'New typing system promises to reduce bugs in telegraph transmissions. Operators are skeptical.',
        content: 'Full content of the article goes here...',
        pe_impact_score: 6,
        pe_analysis: {
            key_insights: ['Safety improved', 'Verbosity increased'],
            sectors: ['Languages'],
            categories: ['Development']
        },
        click_count: 5,
        thumbs_up_count: 1,
        thumbs_down_count: 0,
        is_duplicate: false
    }
];

async function seedStories() {
    console.log('🌱 Seeding test stories...');
    for (const story of testStories) {
        await stories.create(story);
        console.log(`  ✓ Created story: ${story.headline}`);
    }
    console.log('✅ Stories seeded!');
}

if (require.main === module) {
    seedStories().catch(console.error);
}

module.exports = { seedStories };
