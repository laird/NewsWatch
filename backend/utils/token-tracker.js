/**
 * Token usage tracker for newsletter generation
 * Tracks AI token consumption across all operations
 */

let currentSessionTokens = 0;

/**
 * Add tokens to current session
 */
function addTokens(count) {
    if (typeof count === 'number' && count > 0) {
        currentSessionTokens += count;
    }
}

/**
 * Get current session token count
 */
function getTokenCount() {
    return currentSessionTokens;
}

/**
 * Reset token counter (call at start of newsletter generation)
 */
function reset() {
    currentSessionTokens = 0;
}

/**
 * Format token count for display
 */
function formatTokenCost(tokens) {
    if (tokens >= 1000000) {
        return `${(tokens / 1000000).toFixed(1)}M tokens`;
    } else if (tokens >= 1000) {
        return `${(tokens / 1000).toFixed(1)}K tokens`;
    } else {
        return `${tokens} tokens`;
    }
}

module.exports = {
    addTokens,
    getTokenCount,
    reset,
    formatTokenCost
};
