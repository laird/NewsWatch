// Script to analyze all stories for PE impact
require('dotenv').config({ path: require('path').resolve(__dirname, 'backend/.env') });
const { queryDocs } = require('./backend/database/db-firestore');
const { analyzePEImpact } = require('./backend/services/peAnalysis');

async function analyzeAllStories() {
    console.log('🔍 Starting PE impact analysis for all stories...\n');

    // Get all stories
    const stories = await queryDocs('stories', [], {
        orderBy: { field: 'ingested_at', direction: 'desc' },
        limit: 5
    });

    console.log(`Found ${stories.length} stories to analyze\n`);

    const results = [];

    for (const story of stories) {
        try {
            console.log(`Analyzing: ${story.headline.substring(0, 60)}...`);
            const analysis = await analyzePEImpact(story);

            results.push({
                headline: story.headline,
                url: story.url,
                source: story.source,
                pe_impact_score: analysis.overall_score,
                relevance_score: analysis.relevance_score,
                investment_score: analysis.investment_score,
                deal_score: analysis.deal_score,
                portfolio_score: analysis.portfolio_score,
                sectors: analysis.sectors,
                insights: analysis.insights,
                explanation: analysis.explanation || 'No explanation available'
            });

            console.log(`  ✓ Score: ${analysis.overall_score}/10 | Relevance: ${analysis.relevance_score}/10\n`);

        } catch (error) {
            console.error(`  ✗ Failed: ${error.message}\n`);
        }
    }

    // Sort by PE impact score
    results.sort((a, b) => b.pe_impact_score - a.pe_impact_score);

    console.log('\n' + '='.repeat(80));
    console.log('📊 ANALYSIS RESULTS - Sorted by PE Impact Score');
    console.log('='.repeat(80) + '\n');

    results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.headline}`);
        console.log(`   Source: ${result.source}`);
        console.log(`   PE Impact: ${result.pe_impact_score}/10 | Investment: ${result.investment_score}/10 | Deal: ${result.deal_score}/10 | Portfolio: ${result.portfolio_score}/10`);
        console.log(`   Sectors: ${result.sectors.join(', ') || 'N/A'}`);
        if (result.explanation) {
            console.log(`   \n   WHY THIS SCORE:`);
            result.explanation.split('\n').forEach(line => console.log(`     ${line}`));
        }
        if (result.insights && result.insights.length > 0) {
            console.log(`   \n   INSIGHTS:`);
            result.insights.forEach(insight => console.log(`     ${insight}`));
        }
        console.log(`   URL: ${result.url}`);
        console.log('');
    });

    console.log('✅ Analysis complete!\n');
    process.exit(0);
}

analyzeAllStories().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
