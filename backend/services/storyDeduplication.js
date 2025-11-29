const { queryDocs, getDoc, addDoc, updateDoc, serverTimestamp, timestampFromDate } = require('../database/db-firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Calculate similarity between two strings (simple word overlap approach)
 * Returns a score between 0 and 1
 */
function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;

    const words1 = str1.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const words2 = str2.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    if (words1.length === 0 || words2.length === 0) return 0;

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
}

/**
 * Generate a combined summary from multiple sources using AI
 */
async function generateCombinedSummary(existingStory, newStory) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return null;
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `You are summarizing a news story that has been reported by multiple sources. Create a comprehensive summary that combines insights from all sources.

Headline: "${existingStory.headline}"

Source 1 (${existingStory.source}):
${(existingStory.summary || existingStory.content || '').substring(0, 800)}

Source 2 (${newStory.source}):
${(newStory.summary || newStory.content || '').substring(0, 800)}

Create a comprehensive 3-4 sentence summary that:
- Combines key facts from both sources
- Highlights any unique details from either source
- Maintains a neutral, journalistic tone
- Focuses on business/investment implications

Respond with ONLY the summary text, no additional formatting.`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const combinedSummary = response.text().trim();

        console.log(`  🤖 Generated combined summary from ${existingStory.source} + ${newStory.source}`);
        return combinedSummary;
    } catch (error) {
        console.error('    Failed to generate combined summary:', error.message);
        return null;
    }
}

/**
 * Use AI to check if two stories are about the same topic/event
 * Returns {isDuplicate: boolean, confidence: number, reason: string}
 */
async function checkSemanticSimilarity(story1, story2) {
    try {
        // Only use AI if Gemini is configured
        if (!process.env.GEMINI_API_KEY) {
            return { isDuplicate: false, confidence: 0, reason: 'AI not configured' };
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `Compare these two news stories and determine if they are about the same event, topic, or company announcement.

Story 1:
Headline: "${story1.headline}"
Summary: ${(story1.summary || story1.content || '').substring(0, 300)}

Story 2:
Headline: "${story2.headline}"
Summary: ${(story2.summary || story2.content || '').substring(0, 300)}

Respond ONLY with valid JSON in this exact format:
{
  "is_duplicate": true or false,
  "confidence": 0-100,
  "reason": "brief explanation"
}`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // Clean up markdown code blocks if present
        const jsonStr = text.replaceAll(/```json\n?|\n?```/g, '').trim();
        const analysis = JSON.parse(jsonStr);

        return {
            isDuplicate: analysis.is_duplicate,
            confidence: analysis.confidence,
            reason: analysis.reason
        };
    } catch (error) {
        console.error('    AI similarity check failed:', error.message);
        return { isDuplicate: false, confidence: 0, reason: 'AI error' };
    }
}

/**
 * Find a similar story in Firestore
 * Returns the existing story if a match is found, null otherwise
 */
async function findSimilarStory(newStory) {
    // First check: exact URL match (fastest, most reliable)
    if (newStory.url) {
        const exactMatches = await queryDocs('stories', [
            { field: 'url', op: '==', value: newStory.url }
        ]);

        if (exactMatches.length > 0) {
            console.log(`  🔗 Exact URL match found for: ${newStory.headline.substring(0, 60)}...`);
            return exactMatches[0];
        }
    }

    // Get recent stories (last 48 hours) to check for duplicates
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const recentStories = await queryDocs('stories', [
        { field: 'ingested_at', op: '>', value: timestampFromDate(twoDaysAgo) }
    ], {
        orderBy: { field: 'ingested_at', direction: 'desc' }
    });

    // First pass: word-based similarity (fast)
    const wordBasedCandidates = [];

    for (const existing of recentStories) {
        // Check headline similarity
        const headlineSimilarity = calculateSimilarity(newStory.headline, existing.headline);

        // Check content similarity (first 200 chars)
        const newContent = (newStory.content || newStory.summary || '').substring(0, 200);
        const existingContent = (existing.content || existing.summary || '').substring(0, 200);
        const contentSimilarity = calculateSimilarity(newContent, existingContent);

        // BOTH headline AND content must be very similar to auto-merge
        // This prevents false positives from stories that share common tech terms
        if (headlineSimilarity > 0.75 && contentSimilarity > 0.75) {
            return existing;
        }

        // If moderately similar, add to candidates for AI check
        // Increased thresholds to reduce false positives
        if (headlineSimilarity > 0.5 || contentSimilarity > 0.6) {
            wordBasedCandidates.push({ story: existing, headlineSim: headlineSimilarity, contentSim: contentSimilarity });
        }
    }

    // Second pass: AI semantic similarity for candidates (slower but more accurate)
    if (wordBasedCandidates.length > 0 && process.env.GEMINI_API_KEY) {
        // Sort candidates by similarity and check top 3
        wordBasedCandidates.sort((a, b) =>
            Math.max(b.headlineSim, b.contentSim) - Math.max(a.headlineSim, a.contentSim)
        );

        for (const candidate of wordBasedCandidates.slice(0, 3)) {
            const aiResult = await checkSemanticSimilarity(newStory, candidate.story);

            if (aiResult.isDuplicate && aiResult.confidence > 70) {
                console.log(`    🤖 AI detected duplicate: ${aiResult.reason} (confidence: ${aiResult.confidence}%)`);
                return candidate.story;
            }
        }
    }

    return null;
}

/**
 * Merge a new story into an existing one
 * Adds the new source to the sources array and updates content if needed
 */
async function mergeStories(existingStory, newStory) {
    // Parse existing sources array - ensure it's an array
    let sources = Array.isArray(existingStory.sources) ? existingStory.sources : [];

    // Add new source
    const newSource = {
        name: newStory.source,
        url: newStory.url,
        published_at: newStory.published_at
    };

    // Check if this source is already in the list (by URL or Name)
    // Normalize URL: remove query params and trailing slashes for comparison
    const normalizeUrl = (url) => {
        try {
            const u = new URL(url);
            return u.origin + u.pathname.replace(/\/$/, '');
        } catch (e) {
            return url;
        }
    };

    const newUrlNormalized = normalizeUrl(newSource.url);

    const sourceExists = sources.some(s => {
        // Check exact URL match
        if (s.url === newSource.url) return true;

        // Check normalized URL match
        if (normalizeUrl(s.url) === newUrlNormalized) return true;

        // Check name match (if URL is missing or different but name is same, it might be same source)
        // But be careful, "Hacker News" might have different links. 
        // So maybe only dedupe if URL is same.

        return false;
    });

    if (!sourceExists) {
        sources.push(newSource);
        console.log(`  📰 Merging story from ${newStory.source} into existing story (${sources.length} sources total)`);
    } else {
        console.log(`  ⚠️  Source ${newStory.source} already exists for this story, skipping merge`);
        return existingStory.id;
    }

    // Calculate source count multiplier for PE impact score
    // More sources = more important story
    // Formula: base_score * (1 + (source_count - 1) * 0.15)
    const sourceMultiplier = 1 + (sources.length - 1) * 0.15;
    const boostedScore = existingStory.pe_impact_score
        ? Math.min(99.99, existingStory.pe_impact_score * sourceMultiplier)
        : null;

    // Generate combined summary from multiple sources
    const combinedSummary = await generateCombinedSummary(existingStory, newStory);

    // Prepare update data
    const updateData = {
        sources: sources,
    };

    if (boostedScore !== null) {
        updateData.pe_impact_score = boostedScore;
    }

    // Update content if new content is longer
    if (newStory.content && newStory.content.length > (existingStory.content || '').length) {
        updateData.content = newStory.content;
    }

    // Update summary with AI-generated combined summary or longer summary
    if (combinedSummary) {
        updateData.summary = combinedSummary;
    } else if (newStory.summary && newStory.summary.length > (existingStory.summary || '').length) {
        updateData.summary = newStory.summary;
    }

    // Update the existing story
    await updateDoc('stories', existingStory.id, updateData);

    console.log(`  📰 Merged story from ${newStory.source} (${sources.length} sources, score: ${boostedScore?.toFixed(2) || 'N/A'})`);

    return existingStory.id;
}

/**
 * Process a new story - either insert it or merge with existing
 * Returns the story ID (new or existing)
 */
async function processStory(newStory) {
    const similarStory = await findSimilarStory(newStory);

    if (similarStory) {
        return await mergeStories(similarStory, newStory);
    }

    // No duplicate found, insert as new story
    // Initialize sources array with the first source
    const sources = [{
        name: newStory.source,
        url: newStory.url,
        published_at: newStory.published_at
    }];

    const storyData = {
        headline: newStory.headline,
        url: newStory.url,
        content: newStory.content,
        summary: newStory.summary,
        source: newStory.source,
        sources: sources,
        published_at: timestampFromDate(new Date(newStory.published_at)),
        ingested_at: serverTimestamp(),
        created_at: serverTimestamp()
    };

    const story = await addDoc('stories', storyData);
    return story;
}

module.exports = {
    findSimilarStory,
    mergeStories,
    processStory,
    calculateSimilarity
};
