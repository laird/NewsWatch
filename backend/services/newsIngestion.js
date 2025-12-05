const Parser = require('rss-parser');
const { stories, sourceQuality } = require('../database/firestore');
const { analyzePEImpact } = require('./peAnalysis');
const { processStory } = require('./storyDeduplication');

const parser = new Parser({
    timeout: 10000,
    headers: {
        'User-Agent': 'NewsWatch/1.0'
    }
});

/**
 * Generate a concise 1-2 sentence summary using AI
 */
async function generateSummary(headline, content) {
    try {
        const aiService = require('./ai-service');

        const prompt = `Summarize this news article in EXACTLY 1-2 concise sentences (maximum 150 characters total). Focus on the most newsworthy aspect. Do not include marketing language or boilerplate.

Headline: ${headline}

Content: ${content.substring(0, 1500)}

Respond with ONLY the summary text, no additional formatting.`;

        const result = await aiService.generateContent(prompt, {
            temperature: 0.3,  // Lower temperature for consistency
            maxTokens: 100
        });

        const summary = result.text.trim();

        // Validate it's 1-2 sentences
        const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length > 2) {
            // Take only first 2 sentences
            return sentences.slice(0, 2).join('. ') + '.';
        }

        return summary;

    } catch (error) {
        console.warn('Failed to generate AI summary:', error.message);
        // Fallback: create simple summary from first sentence of content
        const firstSentence = content.match(/^[^.!?]+[.!?]/)?.[0] || content.substring(0, 150);
        return firstSentence.trim();
    }
}

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
    {
        name: 'VentureBeat',
        url: 'https://venturebeat.com/feed/',
        category: 'tech'
    },
    {
        name: 'Reuters Technology',
        url: 'https://www.reuters agency.com/feed/?best-topics=tech&post_type=best',
        category: 'tech'
    },
    {
        name: 'PE Hub',
        url: 'https://www.pehub.com/feed/',
        category: 'pe'
    },
    {
        name: 'SaaStr',
        url: 'https://www.saastr.com/feed/',
        category: 'saas'
    },
    {
        name: 'Bloomberg Technology',
        url: 'https://feeds.bloomberg.com/technology/news.rss',
        category: 'tech'
    },
    {
        name: 'WSJ Technology',
        url: 'https://feeds.content.dowjones.io/public/rss/RSSMarketsMain',
        category: 'business'
    },
    {
        name: 'Axios',
        url: 'https://api.axios.com/feed/',
        category: 'tech'
    },
    {
        name: 'The Verge',
        url: 'https://www.theverge.com/rss/index.xml',
        category: 'tech'
    },
    {
        name: 'Ars Technica',
        url: 'https://feeds.arstechnica.com/arstechnica/index',
        category: 'tech'
    },
    {
        name: 'MIT Technology Review',
        url: 'https://www.technologyreview.com/feed/',
        category: 'tech'
    },
    {
        name: 'Crunchbase News',
        url: 'https://news.crunchbase.com/feed/',
        category: 'startup'
    }
];

/**
 * Ingest news from all configured sources
 */
async function ingestNews() {
    console.log('\\n📡 Starting news ingestion...');
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
                    // Extract content
                    const content = item.contentSnippet || item.content || item.summary || '';

                    // Generate concise 1-2 sentence summary using AI
                    const summary = await generateSummary(item.title, content);

                    // Process story (will deduplicate if similar story exists)
                    const story = await processStory({
                        headline: item.title,
                        url: item.link,
                        content: content,
                        summary: summary,
                        source: source.name,
                        published_at: item.pubDate ? new Date(item.pubDate) : new Date()
                    });

                    // If processStory returned a UUID string, it was a merge
                    // If it returned an object, it's a new story
                    const isNewStory = typeof story === 'object';

                    if (isNewStory) {
                        sourceIngested++;
                        totalIngested++;

                        // Analyze for PE impact (async, don't wait)
                        analyzePEImpact(story)
                            .then(() => {
                                totalAnalyzed++;
                                console.log(`    ✓ Analyzed: ${story.headline.substring(0, 60)}...`);
                            })
                            .catch(err => {
                                console.error(`    ✗ Analysis failed for story ${story.id}:`, err.message);
                            });
                    }

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

    console.log(`\\n✅ News ingestion complete: ${totalIngested} stories ingested\\n`);

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
