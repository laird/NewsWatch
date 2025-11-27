// Story data - in production this would come from an API
const stories = {
    1: {
        headline: "OpenAI Announces GPT-5 with Breakthrough Reasoning Capabilities",
        byline: "TechCrunch | November 26, 2025, 6:00 AM EST",
        content: [
            "OpenAI unveiled GPT-5 this morning, marking what CEO Sam Altman calls \"the most significant leap in AI reasoning since GPT-4.\" The new model demonstrates unprecedented performance in complex problem-solving, mathematical reasoning, and long-form planning tasks.",
            "Early benchmarks show GPT-5 achieving 95% accuracy on graduate-level mathematics problems, compared to GPT-4's 78%. The model also demonstrates improved factual accuracy and reduced hallucinations, addressing key criticisms of previous versions.",
            "Pricing remains unchanged at $20/month for ChatGPT Plus subscribers, with API access starting at $0.03 per 1K tokens. Enterprise customers will gain access to fine-tuning capabilities in Q1 2026.",
            "The announcement sent ripples through the AI industry, with Anthropic and Google expected to respond with their own model updates in the coming weeks. Investors reacted positively, with Microsoft shares up 3.2% in pre-market trading.",
            "Industry analysts suggest this release could accelerate enterprise AI adoption, particularly in sectors requiring complex reasoning such as financial analysis, legal research, and scientific computing."
        ],
        sources: [
            { title: "OpenAI Official Announcement", url: "https://openai.com/blog/gpt-5" },
            { title: "TechCrunch Coverage", url: "https://techcrunch.com/2025/11/26/openai-gpt-5" },
            { title: "Benchmark Results", url: "https://arxiv.org/example" }
        ]
    },
    2: {
        headline: "Stripe Acquires Fintech Startup Lemon for $850M",
        byline: "Bloomberg | November 26, 2025, 5:30 AM EST",
        content: [
            "Payment giant Stripe announced the acquisition of Lemon, a Y Combinator-backed fintech startup specializing in embedded banking solutions for SaaS companies. The deal values Lemon at $850 million, marking Stripe's largest acquisition since 2021.",
            "Lemon's technology enables software companies to offer banking services directly within their applications, including checking accounts, debit cards, and lending products. The startup serves over 500 SaaS companies and processes $2 billion in annual transaction volume.",
            "Stripe plans to integrate Lemon's capabilities into its existing product suite, allowing its millions of customers to add banking features with minimal engineering effort. The acquisition is expected to close in Q1 2026, pending regulatory approval.",
            "The move positions Stripe more competitively against rivals like Adyen and PayPal, who have also been expanding their embedded finance offerings. Analysts view the acquisition as strategic, given the growing demand for integrated financial services in software applications."
        ],
        sources: [
            { title: "Bloomberg Report", url: "https://bloomberg.com/news/stripe-lemon" },
            { title: "Stripe Press Release", url: "https://stripe.com/newsroom/lemon-acquisition" }
        ]
    },
    3: {
        headline: "AWS Launches New AI Chip to Compete with NVIDIA",
        byline: "The Information | November 26, 2025, 7:15 AM EST",
        content: [
            "Amazon Web Services introduced Trainium2, its latest custom AI training chip, claiming 40% better performance per dollar compared to NVIDIA's H100 GPUs. The announcement comes as cloud providers seek to reduce dependence on NVIDIA's dominant hardware.",
            "Trainium2 chips are now available in AWS's EC2 instances, with major AI companies including Anthropic and Stability AI already committed to using the new hardware. The move intensifies competition in the AI infrastructure market.",
            "AWS claims the chips can train large language models 30% faster than previous generation Trainium chips, while consuming 25% less power. The company has invested over $2 billion in custom chip development over the past three years.",
            "The move is part of a broader trend among cloud providers to develop proprietary AI hardware, reducing reliance on NVIDIA while potentially offering customers more cost-effective options for AI workloads."
        ],
        sources: [
            { title: "AWS Announcement", url: "https://aws.amazon.com/trainium2" },
            { title: "The Information Analysis", url: "https://theinformation.com/aws-chip" }
        ]
    }
    // Add more stories as needed
};

// Load story based on URL parameter
function loadStory() {
    const urlParams = new URLSearchParams(window.location.search);
    const storyId = urlParams.get('id');

    if (!storyId || !stories[storyId]) {
        // Redirect to home if story not found
        window.location.href = 'index.html';
        return;
    }

    const story = stories[storyId];

    // Update page title
    document.getElementById('page-title').textContent = `${story.headline} - NewsWatch`;

    // Build story HTML
    let html = `
        <h2 class="headline">${story.headline}</h2>
        <div class="byline">${story.byline}</div>
        <div class="story-content">
            ${story.content.map(p => `<p>${p}</p>`).join('')}
        </div>
    `;

    // Add source links if available
    if (story.sources && story.sources.length > 0) {
        html += `
            <div class="source-links">
                <h4>Sources & Related Reading</h4>
                <ul>
                    ${story.sources.map(s => `<li><a href="${s.url}" target="_blank" rel="noopener">${s.title}</a></li>`).join('')}
                </ul>
            </div>
        `;
    }

    // Add feedback section
    html += `
        <div class="feedback-section">
            <h4>Was this story relevant?</h4>
            <div class="feedback-buttons">
                <button class="thumb-btn thumb-up" onclick="handleFeedback(${storyId}, 'up')" data-active="false">
                    <span class="thumb-icon">👍</span> Relevant
                </button>
                <button class="thumb-btn thumb-down" onclick="handleFeedback(${storyId}, 'down')" data-active="false">
                    <span class="thumb-icon">👎</span> Not Relevant
                </button>
            </div>
            <div class="feedback-input-container" id="feedback-input" style="display: none;">
                <textarea class="feedback-text" id="feedback-text" placeholder="Tell us more about why this story was or wasn't relevant..."></textarea>
                <button class="submit-feedback-btn" onclick="submitFeedback(${storyId})">Submit Feedback</button>
            </div>
        </div>
    `;

    document.getElementById('story-content').innerHTML = html;

    // Load existing feedback state
    loadFeedbackState(storyId);
}

// Handle feedback buttons
function handleFeedback(storyId, direction) {
    const thumbUpBtn = document.querySelector('.thumb-up');
    const thumbDownBtn = document.querySelector('.thumb-down');
    const feedbackInput = document.getElementById('feedback-input');

    // Get or create feedback data
    let feedbackData = JSON.parse(localStorage.getItem('newswatch_feedback') || '{}');
    if (!feedbackData[storyId]) {
        feedbackData[storyId] = { rating: null, text: '', timestamp: new Date().toISOString() };
    }

    // Toggle button state
    const clickedBtn = direction === 'up' ? thumbUpBtn : thumbDownBtn;
    const wasActive = clickedBtn.dataset.active === 'true';

    // Reset both buttons
    thumbUpBtn.dataset.active = 'false';
    thumbDownBtn.dataset.active = 'false';

    if (!wasActive) {
        clickedBtn.dataset.active = 'true';
        feedbackData[storyId].rating = direction;
        feedbackInput.style.display = 'block';
    } else {
        feedbackData[storyId].rating = null;
        feedbackInput.style.display = 'none';
    }

    localStorage.setItem('newswatch_feedback', JSON.stringify(feedbackData));
}

// Submit feedback
function submitFeedback(storyId) {
    const feedbackText = document.getElementById('feedback-text').value.trim();
    let feedbackData = JSON.parse(localStorage.getItem('newswatch_feedback') || '{}');

    if (feedbackData[storyId]) {
        feedbackData[storyId].text = feedbackText;
        feedbackData[storyId].timestamp = new Date().toISOString();
        localStorage.setItem('newswatch_feedback', JSON.stringify(feedbackData));

        // Show success message
        const feedbackInput = document.getElementById('feedback-input');
        feedbackInput.innerHTML = '<div class="feedback-success">✓ Thank you! Your feedback helps us improve.</div>';

        console.log('Feedback submitted:', feedbackData[storyId]);
    }
}

// Load existing feedback state
function loadFeedbackState(storyId) {
    const feedbackData = JSON.parse(localStorage.getItem('newswatch_feedback') || '{}');
    if (feedbackData[storyId] && feedbackData[storyId].rating) {
        const btn = document.querySelector(`.thumb-${feedbackData[storyId].rating}`);
        if (btn) {
            btn.dataset.active = 'true';
            document.getElementById('feedback-input').style.display = 'block';
        }
        if (feedbackData[storyId].text) {
            const textarea = document.getElementById('feedback-text');
            if (textarea) {
                textarea.value = feedbackData[storyId].text;
            }
        }
    }
}

// Load story on page load
document.addEventListener('DOMContentLoaded', loadStory);
