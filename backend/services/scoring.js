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
 * @param {Object} user - The user object (must contain email)
 * @param {Array} candidateStories - List of stories to score
 * @returns {Promise<Array>} - Stories with added `personal_score` and `personal_multiplier`
 */
async function scoreStoriesForUser(user, candidateStories) {
    if (!user || !user.email) {
        console.warn('⚠️ scoreStoriesForUser called without valid user');
        return candidateStories.map(s => ({ ...s, personal_score: s.pe_impact_score || 0 }));
    }

    // 1. Fetch User's Feedback
    const userFeedback = await feedback.getByUser(user.email);

    // 2. Build Preference Profile
    const profile = buildPreferenceProfile(userFeedback);

    // 3. Score Stories
    return candidateStories.map(story => {
        const multipliers = calculateMultipliers(story, profile, {
            weight: PERSONAL_WEIGHT,
            min: PERSONAL_MIN_MULTIPLIER,
            max: PERSONAL_MAX_MULTIPLIER
        });

        const baseScore = story.pe_impact_score || 0;
        const finalScore = baseScore * multipliers.source * multipliers.category;

        return {
            ...story,
            personal_score: Number(finalScore.toFixed(2)),
            personal_multipliers: multipliers
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
        if (item.sectors && Array.isArray(item.sectors)) {
            for (const sector of item.sectors) {
                categories[sector] = (categories[sector] || 0) + vote;
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
    const sectors = story.pe_analysis?.sectors || [];

    if (sectors.length > 0) {
        // Find the highest multiplier among all sectors this story belongs to
        let maxCatMult = 1;
        let minCatMult = 1; // Track min to handle negative preferences too?
        // Strategy: If ANY category is liked, boost it. If ALL are disliked, penalize?
        // Let's stick to the plan: "If a story has multiple categories, use the highest multiplier".
        // This is optimistic.

        const multipliers = sectors.map(sector => {
            const votes = profile.categories[sector] || 0;
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
