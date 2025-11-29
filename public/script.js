// Navigate to story detail page
function viewStory(storyId) {
    // In production, this would navigate to story-{id}.html
    // For now, we'll use URL parameters
    window.location.href = `story.html?id=${storyId}`;
}

// Configuration
const API_BASE_URL = 'http://localhost:3000/api'; // Point to local feedback server

/**
 * Handle thumbs up/down click
 */
async function handleThumb(storyId, rating, event) {
    // Prevent navigation when clicking feedback buttons
    if (event) {
        event.stopPropagation();
    }

    const thumbUpBtn = event.currentTarget.parentElement.querySelector('.thumb-up');
    const thumbDownBtn = event.currentTarget.parentElement.querySelector('.thumb-down');

    // Initialize feedback data for this story if it doesn't exist
    if (!window.feedbackData) {
        window.feedbackData = {};
    }

    if (!window.feedbackData[storyId]) {
        window.feedbackData[storyId] = {
            rating: null,
            timestamp: new Date().toISOString()
        };
    }

    // Toggle the clicked button
    const clickedBtn = event.currentTarget;
    const wasActive = clickedBtn.dataset.active === 'true';

    // Reset both buttons
    thumbUpBtn.dataset.active = 'false';
    thumbDownBtn.dataset.active = 'false';

    if (!wasActive) {
        // Activate the clicked button
        clickedBtn.dataset.active = 'true';
        window.feedbackData[storyId].rating = direction;
    } else {
        // Deactivate
        window.feedbackData[storyId].rating = null;
    }

    // Store in localStorage
    localStorage.setItem('newswatch_feedback', JSON.stringify(window.feedbackData));

    console.log('Feedback updated:', window.feedbackData);
}

// Load feedback state on page load
function loadFeedbackState() {
    const stored = localStorage.getItem('newswatch_feedback');
    if (stored) {
        window.feedbackData = JSON.parse(stored);

        // Restore button states
        Object.keys(window.feedbackData).forEach(storyId => {
            const feedback = window.feedbackData[storyId];
            if (feedback.rating) {
                const btn = document.querySelector(`[data-story-id="${storyId}"] .thumb-${feedback.rating}`);
                if (btn) {
                    btn.dataset.active = 'true';
                }
            }
        });
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', loadFeedbackState);

console.log('NewsWatch Newsletter loaded!');
console.log('Click on any story to read the full article');
