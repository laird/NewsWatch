const { generateNewsletterHTML } = require('../backend/services/newsletter');
const fs = require('fs').promises;
const path = require('path');

async function generateMock() {
    const stories = [
        {
            headline: "Test Story 1",
            url: "https://example.com/1",
            summary: "This is a test story summary.",
            source: "TechCrunch",
            published_at: new Date(),
            pe_impact_score: 8,
            thumbs_up_count: 5,
            thumbs_down_count: 1,
            pe_analysis: { key_insights: ["Insight 1", "Insight 2"] }
        },
        {
            headline: "Test Story 2",
            url: "https://example.com/2",
            summary: "Another test story.",
            source: "Bloomberg",
            published_at: new Date(),
            pe_impact_score: 4,
            thumbs_up_count: 0,
            thumbs_down_count: 0,
            pe_analysis: {}
        }
    ];

    const html = await generateNewsletterHTML(stories, { includeGuidance: true });
    await fs.writeFile('newsletter-mock.html', html);
    console.log('Mock newsletter generated at newsletter-mock.html');
}

generateMock().catch(console.error);
