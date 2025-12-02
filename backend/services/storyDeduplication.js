const { queryDocs, getDoc, addDoc, updateDoc, serverTimestamp, timestampFromDate, runTransaction } = require('../database/db-firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Normalize URL for comparison
 * Removes query parameters, fragments, trailing slashes, and www prefix
 */
function normalizeUrl(url) {
    if (!url) return '';
    try {
        const u = new URL(url);
        // Remove www. prefix
        let hostname = u.hostname.replace(/^www\./, '');
        // Remove trailing slash from pathname
        let pathname = u.pathname.replace(/\/$/, '');
        // Return origin + pathname (no query params or fragments)
        return `${u.protocol}//${hostname}${pathname}`.toLowerCase();
    } catch (e) {
        // If URL parsing fails, return lowercase version
        return url.toLowerCase().replace(/\/$/, '');
    }
}

/**
 * Calculate similarity between two strings (simple word overlap approach)
 * Returns a score between 0 and 1
 */
function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;

    const tokenize = (str) => {
        return str.toLowerCase()
            .replace(/[$£€]/g, '') // Remove currency symbols
            .replace(/\b(\d+)[mkb]\b/g, '$1') // Remove suffixes from numbers (300m -> 300)
            .split(/[^a-z0-9]+/) // Split by non-alphanumeric
            .filter(w => w.length >= 3 || (w.length >= 2 && /\d/.test(w))); // Keep words >= 3 chars, or 2 chars if they contain digits (e.g. 5g, 3d)
    };

    const words1 = tokenize(str1);
    const words2 = tokenize(str2);

    if (words1.length === 0 || words2.length === 0) return 0;

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
}

/**
 * Calculate Overlap Coefficient between two strings
 * (Intersection / Min(Size1, Size2))
 * Good for detecting when one string is roughly a subset of another
 */
function calculateOverlap(str1, str2) {
    if (!str1 || !str2) return 0;

    const tokenize = (str) => {
        return str.toLowerCase()
            .replace(/[$£€]/g, '')
            .replace(/\b(\d+)[mkb]\b/g, '$1')
            .split(/[^a-z0-9]+/)
            .filter(w => w.length >= 3 || (w.length >= 2 && /\d/.test(w)));
    };

    const words1 = tokenize(str1);
    const words2 = tokenize(str2);

    if (words1.length === 0 || words2.length === 0) return 0;

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const minSize = Math.min(set1.size, set2.size);

    return intersection.size / minSize;
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

        // Second check: normalized URL match (catches variations like with/without www, trailing slashes)
        const normalizedNewUrl = normalizeUrl(newStory.url);
        if (normalizedNewUrl) {
            // Get all recent stories and check normalized URLs in memory
            // (Firestore doesn't support field transformations in queries)
            const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
            const recentStories = await queryDocs('stories', [
                { field: 'ingested_at', op: '>', value: timestampFromDate(twoDaysAgo) }
            ]);

            for (const existing of recentStories) {
                if (existing.url && normalizeUrl(existing.url) === normalizedNewUrl) {
                    console.log(`  🔗 Normalized URL match found: ${newStory.url} matches ${existing.url}`);
                    return existing;
                }
            }
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
        // Check headline similarity (Jaccard and Overlap)
        const headlineJaccard = calculateSimilarity(newStory.headline, existing.headline);
        const headlineOverlap = calculateOverlap(newStory.headline, existing.headline);
        const headlineSimilarity = Math.max(headlineJaccard, headlineOverlap); // Use the better metric

        // Check content similarity (first 200 chars)
        const newContent = (newStory.content || newStory.summary || '').substring(0, 200);
        const existingContent = (existing.content || existing.summary || '').substring(0, 200);
        const contentSimilarity = calculateSimilarity(newContent, existingContent);

        console.log(`    Comparing with: ${existing.headline.substring(0, 30)}...`);
        console.log(`      Headline Sim: ${headlineSimilarity.toFixed(2)} (J:${headlineJaccard.toFixed(2)} O:${headlineOverlap.toFixed(2)})`);
        console.log(`      Content Sim: ${contentSimilarity.toFixed(2)}`);

        // BOTH headline AND content must be very similar to auto-merge
        // This prevents false positives from stories that share common tech terms
        if (headlineSimilarity > 0.8 && contentSimilarity > 0.75) {
            console.log('      -> Auto-merge threshold met');
            return existing;
        }

        // If moderately similar, add to candidates for AI check
        // Lowered thresholds to catch more potential duplicates (e.g. "Black Forest Labs" matches)
        if (headlineSimilarity > 0.4 || contentSimilarity > 0.4) {
            console.log('      -> Added to AI candidates');
            wordBasedCandidates.push({ story: existing, headlineSim: headlineSimilarity, contentSim: contentSimilarity });
        }
    }

    // Second pass: AI semantic similarity for candidates (slower but more accurate)
    if (wordBasedCandidates.length > 0) {
        // Sort candidates by similarity and check top 3
        wordBasedCandidates.sort((a, b) =>
            Math.max(b.headlineSim, b.contentSim) - Math.max(a.headlineSim, a.contentSim)
        );

        for (const candidate of wordBasedCandidates.slice(0, 3)) {
            // If we have an API key, use AI
            if (process.env.GEMINI_API_KEY) {
                const aiResult = await checkSemanticSimilarity(newStory, candidate.story);

                if (aiResult.isDuplicate && aiResult.confidence > 70) {
                    console.log(`    🤖 AI detected duplicate: ${aiResult.reason} (confidence: ${aiResult.confidence}%)`);
                    return candidate.story;
                }
            } else {
                // Fallback if no AI key: use stricter heuristic for "candidates" that passed the loose filter
                // If they share significant words (like proper nouns), merge them
                // Lowered to 0.35 to catch cases like "Black Forest Labs" (score ~0.38)
                const combinedScore = (candidate.headlineSim + candidate.contentSim) / 2;
                if (combinedScore > 0.35) {
                    console.log(`    ⚠️  No AI key, but high combined similarity (${combinedScore.toFixed(2)}), assuming duplicate`);
                    return candidate.story;
                }
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
    // Use centralized URL normalization
    const newUrlNormalized = normalizeUrl(newSource.url);

    const sourceExists = sources.some(s => {
        // Check exact URL match
        if (s.url === newSource.url) return true;

        // Check normalized URL match
        if (normalizeUrl(s.url) === newUrlNormalized) return true;

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

/**
 * Merge two EXISTING stories (retroactive deduplication)
 * Merges 'loser' into 'winner' and marks 'loser' as duplicate
 */
async function mergeExistingStories(winner, loser) {
    console.log(`  🔄 Merging existing story ${loser.id} into ${winner.id}`);

    // 1. Merge sources
    let sources = Array.isArray(winner.sources) ? winner.sources : [];

    // Add winner's own source if not in sources array
    if (sources.length === 0) {
        sources.push({
            name: winner.source,
            url: winner.url,
            published_at: winner.published_at
        });
    }

    // Add loser's sources
    const loserSources = Array.isArray(loser.sources) ? loser.sources : [{
        name: loser.source,
        url: loser.url,
        published_at: loser.published_at
    }];

    for (const src of loserSources) {
        const srcUrlNormalized = normalizeUrl(src.url);
        const exists = sources.some(s => normalizeUrl(s.url) === srcUrlNormalized);
        if (!exists) {
            sources.push(src);
        }
    }

    // 2. Update winner
    const sourceMultiplier = 1 + (sources.length - 1) * 0.15;
    const boostedScore = winner.pe_impact_score
        ? Math.min(99.99, winner.pe_impact_score * sourceMultiplier)
        : null;

    const updateData = {
        sources: sources
    };

    if (boostedScore !== null) {
        updateData.pe_impact_score = boostedScore;
    }

    // Use longer content/summary
    if ((loser.content || '').length > (winner.content || '').length) {
        updateData.content = loser.content;
    }
    if ((loser.summary || '').length > (winner.summary || '').length) {
        updateData.summary = loser.summary;
    }

    await updateDoc('stories', winner.id, updateData);
    console.log(`    ✓ Updated winner ${winner.id} with ${sources.length} sources`);

    // 3. Soft delete loser (mark as merged)
    // User requested not to delete historical data
    await updateDoc('stories', loser.id, {
        merged_into: winner.id,
        is_duplicate: true,
        hidden: true // Flag to hide from frontend/newsletter
    });
    console.log(`    ✓ Marked loser ${loser.id} as duplicate of ${winner.id}`);

    return winner.id;
}

module.exports = {
    findSimilarStory,
    mergeStories,
    mergeExistingStories,
    processStory,
    calculateSimilarity,
    calculateOverlap,
    normalizeUrl
};
