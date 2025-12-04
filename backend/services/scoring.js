const { feedback, stories } = require('../database/firestore');

/**
 * Scoring Service
 * Handles both Personal and Community scoring logic based on user feedback.
 */

// --- Configuration ---

// Personal Scoring Weights
const PERSONAL_WEIGHT = 0.1;
const PERSONAL_MIN_MULTIPLIER = 0.5;
const PERSONAL_MAX_MULTIPLIER = 2.0;

// Community Scoring Weights
const COMMUNITY_WEIGHT = 0.02;
const COMMUNITY_MIN_MULTIPLIER = 0.8;
const COMMUNITY_MAX_MULTIPLIER = 1.2;

/**
 * Calculate Personal Scores for a specific user
 * Combines AI-based scoring (using user guidance) with voting-based multipliers
 * @param {Object} user - The user object (must contain email)
 * @param {Array} candidateStories - List of stories to score
 * @returns {Promise<Array>} - Stories with added `personal_score` and `personal_multiplier`
 */
async function scoreStoriesForUser(user, candidateStories) {
    if (!user || !user.email) {
        console.warn('⚠️ scoreStoriesForUser called without valid user');
        return candidateStories.map(s => ({ ...s, personal_score: s.pe_impact_score || 0 }));
    }

    // 1. Get user's text guidance (for AI filtering)
    const userGuidanceService = require('./user-guidance-service');
    const userGuidance = await userGuidanceService.getUserGuidance(user.email);

    // 2. Apply AI-based relevance filtering if user has guidance
    let scoredStories = [...candidateStories];
    if (userGuidance && userGuidance.length > 50) { // Only if substantial guidance exists
        try {
            const aiService = require('./ai-service');

            // For each story, get AI relevance score based on user guidance
            const aiScoringPrompts = candidateStories.slice(0, 20).map((story, idx) => { // Limit to top 20 for performance
                return {
                    story,
                    prompt: `
USER PREFERENCES:
"${userGuidance}"

STORY:
Title: ${story.headline}
Summary: ${story.summary || 'N/A'}
Categories: ${story.pe_analysis?.sectors?.join(', ') || 'N/A'}

TASK: Rate how relevant this story is to the user's preferences on a scale of 0-10, where:
- 0 = Completely irrelevant or explicitly against their preferences
- 5 = Neutral, somewhat relates to their interests
- 10 = Perfectly aligned with their stated preferences

Respond with ONLY a number 0-10, no explanation.`
                };
            });

            // Process AI scoring (simplified - in production, batch this)
            for (const { story, prompt } of aiScoringPrompts.slice(0, 10)) { // Further limit for initial implementation
                try {
                    const result = await aiService.generateContent(prompt, { temperature: 0, maxTokens: 10 });
                    const aiScore = parseFloat(result.text.trim()) || 5; // Default to neutral if parse fails
                    story.ai_relevance_score = Math.max(0, Math.min(10, aiScore)); // Clamp to 0-10
                } catch (error) {
                    console.warn(`AI scoring failed for story ${story.id}:`, error.message);
                    story.ai_relevance_score = 5; // Default neutral
                }
            }

            // For stories we didn't AI score, default to neutral
            candidateStories.forEach(story => {
                if (story.ai_relevance_score === undefined) {
                    story.ai_relevance_score = 5;
                }
            });

        } catch (error) {
            console.error('AI relevance scoring failed:', error.message);
            // Fall through to voting-based scoring only
        }
    }

    // 3. Fetch User's Voting Feedback
    const userFeedback = await feedback.getByUser(user.email);

    // 4. Build Preference Profile from votes
    const profile = buildPreferenceProfile(userFeedback);

    // 5. Calculate final personal scores (combining AI + voting)
    return scoredStories.map(story => {
        const multipliers = calculateMultipliers(story, profile, {
            weight: PERSONAL_WEIGHT,
            min: PERSONAL_MIN_MULTIPLIER,
            max: PERSONAL_MAX_MULTIPLIER
        });

        const baseScore = story.pe_impact_score || 0;
        const aiRelevance = (story.ai_relevance_score || 5) / 10; // Normalize to 0-1

        // Combine: base score * AI relevance * voting multipliers
        const finalScore = baseScore * aiRelevance * multipliers.source * multipliers.category;

        return {
            ...story,
            personal_score: Number(finalScore.toFixed(2)),
            personal_multipliers: multipliers,
            ai_relevance: story.ai_relevance_score
        };
    });
}

/**
 * Calculate Community Scores based on all feedback
 * @param {Array} candidateStories - List of stories to score
 * @returns {Promise<Array>} - Stories with updated `community_score` (if different from pe_impact_score)
 */
async function scoreStoriesForCommunity(candidateStories) {
    // 1. Fetch All Feedback (Limit to recent 1000 to avoid perf issues if scaling)
    const allFeedback = await feedback.getAll({ limit: 1000 });

    // 2. Build Community Profile
    const profile = buildPreferenceProfile(allFeedback);

    // 3. Score Stories
    return candidateStories.map(story => {
        const multipliers = calculateMultipliers(story, profile, {
            weight: COMMUNITY_WEIGHT,
            min: COMMUNITY_MIN_MULTIPLIER,
            max: COMMUNITY_MAX_MULTIPLIER
        });

        const baseScore = story.pe_impact_score || 0;
        const finalScore = baseScore * multipliers.source * multipliers.category;

        return {
            ...story,
            community_score: Number(finalScore.toFixed(2)),
            community_multipliers: multipliers
        };
    });
}

// --- Helper Functions ---

/**
 * Build a preference profile from a list of feedback items
 */
function buildPreferenceProfile(feedbackList) {
    const sources = {};
    const categories = {};

    for (const item of feedbackList) {
        const vote = item.rating === 'up' ? 1 : (item.rating === 'down' ? -1 : 0);
        if (vote === 0) continue;

        // Source Preference
        // Assuming feedback item has `source` or we need to look it up. 
        // Ideally feedback ingestion enriches with source domain/name.
        // If not, we might need to rely on the story data if joined, but for now let's assume 
        // the feedback object has 'source_domain' or 'source_name' or we extract from story.
        // *Correction*: The current feedback schema might just have storyId. 
        // We need to rely on the story data associated with the feedback.
        // For efficiency, let's assume the caller or the db helper enriches feedback, 
        // OR we just use what's available.

        // If feedback has source/category metadata directly:
        if (item.source_domain) {
            sources[item.source_domain] = (sources[item.source_domain] || 0) + vote;
        }

        // Category Preference
        // Support both 'categories' (new) and 'sectors' (legacy) for backward compatibility
        const itemCategories = item.categories || item.sectors;
        if (itemCategories && Array.isArray(itemCategories)) {
            for (const category of itemCategories) {
                categories[category] = (categories[category] || 0) + vote;
            }
        }
    }

    return { sources, categories };
}

/**
 * Calculate multipliers for a single story based on a profile
 */
function calculateMultipliers(story, profile, config) {
    const { weight, min, max } = config;

    // Source Multiplier
    // Extract domain or source name from story
    let sourceKey = story.source_domain || story.source;
    // Simple normalization if needed, e.g., lowercasing
    if (sourceKey) sourceKey = sourceKey.toLowerCase(); // Ensure profile keys are also lowercased if doing this

    // Note: In buildPreferenceProfile, we should also normalize keys. 
    // For MVP, let's assume exact match on 'source' string if domain not available.

    const sourceVotes = profile.sources[sourceKey] || 0;
    let sourceMultiplier = 1 + (sourceVotes * weight);
    sourceMultiplier = Math.max(min, Math.min(max, sourceMultiplier));

    // Category Multiplier
    let categoryMultiplier = 1;
    // Support both 'categories' (new) and 'sectors' (legacy) for backward compatibility
    const storyCategories = story.pe_analysis?.categories || story.pe_analysis?.sectors || [];

    if (storyCategories.length > 0) {
        // Find the highest multiplier among all categories this story belongs to
        // Strategy: If ANY category is liked, boost it. If ALL are disliked, penalize?
        // Let's stick to the plan: "If a story has multiple categories, use the highest multiplier".
        // This is optimistic.

        const multipliers = storyCategories.map(category => {
            const votes = profile.categories[category] || 0;
            return 1 + (votes * weight);
        });

        // We want the most extreme deviation from 1? Or just the highest?
        // If I hate 'Crypto' (0.5) but love 'SaaS' (1.5), and a story is 'Crypto SaaS', 
        // should I see it? Probably yes (1.5).
        categoryMultiplier = Math.max(...multipliers);
    }

    categoryMultiplier = Math.max(min, Math.min(max, categoryMultiplier));

    return {
        source: Number(sourceMultiplier.toFixed(2)),
        category: Number(categoryMultiplier.toFixed(2))
    };
}

module.exports = {
    scoreStoriesForUser,
    scoreStoriesForCommunity
};
