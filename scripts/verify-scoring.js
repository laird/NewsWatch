const scoring = require('../backend/services/scoring');
const { feedback, stories } = require('../backend/database/firestore');

// Mock Data
const mockUser = { email: 'test@example.com' };

const mockStories = [
    {
        id: 's1',
        headline: 'AI in Healthcare',
        source: 'TechCrunch',
        source_domain: 'techcrunch.com',
        pe_impact_score: 8.0,
        pe_analysis: { sectors: ['AI', 'Healthcare'] }
    },
    {
        id: 's2',
        headline: 'SaaS Growth Slows',
        source: 'Bloomberg',
        source_domain: 'bloomberg.com',
        pe_impact_score: 7.0,
        pe_analysis: { sectors: ['SaaS'] }
    },
    {
        id: 's3',
        headline: 'Crypto Regulation',
        source: 'CoinDesk',
        source_domain: 'coindesk.com',
        pe_impact_score: 6.0,
        pe_analysis: { sectors: ['Crypto'] }
    }
];

const mockFeedback = [
    { rating: 'up', source_domain: 'techcrunch.com', sectors: ['AI'] },
    { rating: 'up', source_domain: 'techcrunch.com', sectors: ['Healthcare'] },
    { rating: 'down', source_domain: 'coindesk.com', sectors: ['Crypto'] }
];

// Mock Firestore Methods
feedback.getByUser = async (email) => {
    console.log(`[Mock] Fetching feedback for ${email}`);
    return mockFeedback;
};

feedback.getAll = async () => {
    console.log('[Mock] Fetching all feedback');
    return mockFeedback;
};

async function runVerification() {
    console.log('🧪 Starting Scoring Verification...\n');

    // 1. Test Personal Scoring
    console.log('--- Personal Scoring Test ---');
    console.log('User likes: TechCrunch, AI, Healthcare');
    console.log('User dislikes: CoinDesk, Crypto');

    const personalResults = await scoring.scoreStoriesForUser(mockUser, mockStories);

    personalResults.forEach(s => {
        console.log(`\nStory: ${s.headline} (${s.source})`);
        console.log(`Base Score: ${s.pe_impact_score}`);
        console.log(`Multipliers: Source=${s.personal_multipliers.source}, Category=${s.personal_multipliers.category}`);
        console.log(`Personal Score: ${s.personal_score}`);

        // Assertions
        if (s.id === 's1') {
            // TechCrunch (+2 votes -> +0.2 -> 1.2) * AI/Healthcare (+1 vote -> +0.1 -> 1.1)
            // Expected: 8.0 * 1.2 * 1.1 = 10.56
            if (s.personal_score > s.pe_impact_score) console.log('✅ Correctly boosted');
            else console.error('❌ Failed to boost');
        }
        if (s.id === 's3') {
            // CoinDesk (-1 vote -> -0.1 -> 0.9) * Crypto (-1 vote -> -0.1 -> 0.9)
            // Expected: 6.0 * 0.9 * 0.9 = 4.86
            if (s.personal_score < s.pe_impact_score) console.log('✅ Correctly penalized');
            else console.error('❌ Failed to penalize');
        }
    });

    // 2. Test Community Scoring
    console.log('\n--- Community Scoring Test ---');
    console.log('Community likes: TechCrunch, AI');
    console.log('Community dislikes: CoinDesk, Crypto');

    const communityResults = await scoring.scoreStoriesForCommunity(mockStories);

    communityResults.forEach(s => {
        console.log(`\nStory: ${s.headline}`);
        console.log(`Base Score: ${s.pe_impact_score}`);
        console.log(`Multipliers: Source=${s.community_multipliers.source}, Category=${s.community_multipliers.category}`);
        console.log(`Community Score: ${s.community_score}`);

        // Assertions
        if (s.id === 's1') {
            // Should be boosted but less than personal
            // TechCrunch (+2 -> +0.04 -> 1.04) * AI (+1 -> +0.02 -> 1.02)
            // Expected: 8.0 * 1.04 * 1.02 = 8.48
            if (s.community_score > s.pe_impact_score && s.community_score < 10.0) console.log('✅ Correctly boosted (conservative)');
            else console.error('❌ Failed community boost check');
        }
    });

    console.log('\n✅ Verification Complete');
}

runVerification().catch(console.error);
