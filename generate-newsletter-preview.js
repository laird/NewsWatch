const { queryDocs } = require('./backend/database/db-firestore');
const { generateNewsletterHTML } = require('./backend/services/newsletter');
const fs = require('fs').promises;
require('dotenv').config({ path: './backend/.env' });

async function generatePreview() {
    console.log('📧 Generating newsletter preview...');

    try {
        // Get top stories (same logic as newsletter)
        const stories = await queryDocs('stories', [], {
            orderBy: [
                { field: 'pe_impact_score', direction: 'desc' },
                { field: 'relevance_score', direction: 'desc' },
                { field: 'ingested_at', direction: 'desc' }
            ],
            limit: 12
        });

        console.log(`Found ${stories.length} stories`);

        // Generate HTML
        const html = await generateNewsletterHTML(stories);

        // Write to file
        await fs.writeFile('newsletter-preview.html', html);

        console.log('✅ Preview saved to newsletter-preview.html');
        console.log('   Open it in your browser to test!');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Run if called directly
if (require.main === module) {
    generatePreview()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}
