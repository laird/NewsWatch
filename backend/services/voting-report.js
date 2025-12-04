const { feedback } = require('../database/firestore');

/**
 * Voting Report Service
 * Generates aggregate voting statistics for sources and categories
 */

const COMMUNITY_WEIGHT = 0.02;
const MIN_MULTIPLIER = 0.8;
const MAX_MULTIPLIER = 1.2;

/**
 * Generate voting report with aggregate statistics
 * @returns {Promise<Object>} Report with sources and categories data
 */
async function generateVotingReport() {
    // Fetch all feedback (enriched with story data)
    const allFeedback = await feedback.getAll({ limit: 1000 });

    // Aggregate by source
    const sourceStats = {};
    const categoryStats = {};

    for (const item of allFeedback) {
        const vote = item.rating === 'up' ? 1 : (item.rating === 'down' ? -1 : 0);
        if (vote === 0) continue;

        // Source aggregation
        const source = item.source_domain || item.source || 'Unknown';
        if (!sourceStats[source]) {
            sourceStats[source] = { upvotes: 0, downvotes: 0, storyIds: new Set() };
        }
        if (vote > 0) sourceStats[source].upvotes++;
        if (vote < 0) sourceStats[source].downvotes++;
        if (item.story_id) sourceStats[source].storyIds.add(item.story_id);

        // Category aggregation (support both 'categories' and 'sectors')
        const itemCategories = item.categories || item.sectors || [];
        for (const category of itemCategories) {
            if (!categoryStats[category]) {
                categoryStats[category] = { upvotes: 0, downvotes: 0, storyIds: new Set() };
            }
            if (vote > 0) categoryStats[category].upvotes++;
            if (vote < 0) categoryStats[category].downvotes++;
            if (item.story_id) categoryStats[category].storyIds.add(item.story_id);
        }
    }

    // Format sources
    const sources = Object.entries(sourceStats).map(([name, stats]) => {
        const netVotes = stats.upvotes - stats.downvotes;
        const multiplier = Math.max(MIN_MULTIPLIER, Math.min(MAX_MULTIPLIER, 1 + (netVotes * COMMUNITY_WEIGHT)));

        return {
            name,
            netVotes,
            upvotes: stats.upvotes,
            downvotes: stats.downvotes,
            storyCount: stats.storyIds.size,
            multiplier: Number(multiplier.toFixed(2))
        };
    });

    // Format categories
    const categories = Object.entries(categoryStats).map(([name, stats]) => {
        const netVotes = stats.upvotes - stats.downvotes;
        const multiplier = Math.max(MIN_MULTIPLIER, Math.min(MAX_MULTIPLIER, 1 + (netVotes * COMMUNITY_WEIGHT)));

        return {
            name,
            netVotes,
            upvotes: stats.upvotes,
            downvotes: stats.downvotes,
            storyCount: stats.storyIds.size,
            multiplier: Number(multiplier.toFixed(2))
        };
    });

    // Sort by net votes descending
    sources.sort((a, b) => b.netVotes - a.netVotes);
    categories.sort((a, b) => b.netVotes - a.netVotes);

    return {
        sources,
        categories,
        metadata: {
            totalFeedback: allFeedback.length,
            dateRange: 'All time',
            lastUpdated: new Date().toISOString()
        }
    };
}

module.exports = {
    generateVotingReport
};
