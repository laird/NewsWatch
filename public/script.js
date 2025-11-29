// Navigate to story detail page
function viewStory(storyId) {
    // In production, this would navigate to story-{id}.html
    // For now, we'll use URL parameters
    window.location.href = `story.html?id=${storyId}`;
}

// Configuration
// Configuration
const API_BASE_URL = '/api'; // Relative path works for both dev and prod

/**
 * Handle thumbs up/down click
 */
async function handleThumb(storyId, direction, event) {
    // Prevent navigation when clicking feedback buttons
    if (event) {
        event.stopPropagation();
        event.preventDefault();
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

/**
 * Trigger newsletter generation (Test Mode)
 */
async function triggerNewsletter() {
    if (!confirm('⚡ Are you sure you want to trigger a newsletter send? This will email all subscribers.')) {
        return;
    }

    try {
        const btn = document.querySelector('button[onclick="triggerNewsletter()"]');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ Sending...';
        }

        const response = await fetch(`${API_BASE_URL}/newsletter/send`, {
            method: 'POST'
        });

        const data = await response.json();

        if (response.ok) {
            alert(`✅ Newsletter sent successfully!\n\nRecipients: ${data.recipientCount}\nStories: ${data.storyCount}`);
        } else {
            throw new Error(data.message || 'Failed to send newsletter');
        }

    } catch (error) {
        console.error('Error triggering newsletter:', error);
        alert(`❌ Error: ${error.message}`);
    } finally {
        const btn = document.querySelector('button[onclick="triggerNewsletter()"]');
        if (btn) {
            btn.disabled = false;
            btn.textContent = '⚡ Send Test Newsletter';
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', loadFeedbackState);

console.log('NewsWatch Newsletter loaded!');
console.log('Click on any story to read the full article');
