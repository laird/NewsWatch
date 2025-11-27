const Parser = require('rss-parser');
const { stories, sourceQuality } = require('../database/firestore');
const { analyzePEImpact } = require('./peAnalysis');

const parser = new Parser({
    timeout: 10000,
    headers: {
        'User-Agent': 'NewsWatch/1.0'
    }
});

// News sources to monitor
const NEWS_SOURCES = [
    {
        name: 'TechCrunch',
        url: 'https://techcrunch.com/feed/',
        category: 'tech'
    },
    {
        name: 'Hacker News',
        url: 'https://news.ycombinator.com/rss',
        category: 'tech'
    },
    {
        name: 'The Information',
        url: 'https://www.theinformation.com/feed',
        category: 'tech'
    },
    // Add more sources as needed
];

/**
 * Ingest news from all configured sources
 */
async function ingestNews() {
    console.log('\n📡 Starting news ingestion...');
    let totalIngested = 0;
    let totalAnalyzed = 0;

    // 1. Get source quality scores
    const qualityList = await sourceQuality.getAll();
    const qualityMap = new Map(qualityList.map(r => [r.domain, parseFloat(r.quality_score)]));

    for (const source of NEWS_SOURCES) {
        try {
            // Check quality score
            const domain = new URL(source.url).hostname.replace('www.', '');
            const qualityScore = qualityMap.get(domain) || 5.0; // Default to neutral

            // Skip low quality sources (autonomous curation)
            if (qualityScore < 3.0) {
                console.log(`  ⏭️  Skipping ${source.name} (Low Quality Score: ${qualityScore})`);
                continue;
            }

            console.log(`  Fetching from ${source.name} (Quality: ${qualityScore})...`);
            const feed = await parser.parseURL(source.url);

            let sourceIngested = 0;

            for (const item of feed.items) {
                try {
                    // Check if story already exists
                    const existing = await stories.getByUrl(item.link);

                    if (existing) {
                        continue; // Skip duplicates
                    }

                    // Extract content
                    const content = item.contentSnippet || item.content || item.summary || '';
                    const summary = content.substring(0, 300) + (content.length > 300 ? '...' : '');

                    // Store story
                    const story = await stories.create({
                        headline: item.title,
                        url: item.link,
                        content,
                        summary,
                        source: source.name,
                        published_at: item.pubDate ? new Date(item.pubDate) : new Date()
                    });

                    sourceIngested++;
                    totalIngested++;

                    // Analyze for PE impact (async, don't wait)
                    // Higher quality sources get priority for analysis if we were rate limited
                    analyzePEImpact(story)
                        .then(() => {
                            totalAnalyzed++;
                            console.log(`    ✓ Analyzed: ${story.headline.substring(0, 60)}...`);
                        })
                        .catch(err => {
                            console.error(`    ✗ Analysis failed for story ${story.id}:`, err.message);
                        });

                } catch (itemError) {
                    console.error(`    Error processing item from ${source.name}:`, itemError.message);
                }
            }

            if (sourceIngested > 0) {
                console.log(`  ✓ ${source.name}: ${sourceIngested} new stories`);
            }

        } catch (sourceError) {
            console.error(`  ✗ Failed to ingest from ${source.name}:`, sourceError.message);
        }
    }

    console.log(`\n✅ News ingestion complete: ${totalIngested} stories ingested\n`);

    return {
        totalIngested,
        totalAnalyzed
    };
}

/**
 * Ingest from a single source (for testing)
 */
async function ingestFromSource(sourceUrl) {
    try {
        const feed = await parser.parseURL(sourceUrl);
        console.log(`Found ${feed.items.length} items from ${feed.title || sourceUrl}`);
        return feed.items;
    } catch (error) {
        console.error(`Error fetching from ${sourceUrl}:`, error);
        throw error;
    }
}

module.exports = {
    ingestNews,
    ingestFromSource,
    NEWS_SOURCES
};
