const { generateFeedbackAcknowledgmentEmail, extractUserName } = require('../services/email-templates');
const fs = require('fs').promises;
const path = require('path');

async function generateSample() {
    console.log('🧪 Generating Sample Feedback Acknowledgment Email...\n');

    // Sample data
    const preferences = {
        topSources: [
            { name: 'TechCrunch', weight: 1.5 },
            { name: 'Bloomberg', weight: 0.8 },
            { name: 'The Information', weight: 2.0 }
        ],
        topCategories: [
            { name: 'Technology', weight: 2.0 },
            { name: 'Finance', weight: 1.2 },
            { name: 'Healthcare', weight: 0.5 }
        ]
    };

    const emailContent = generateFeedbackAcknowledgmentEmail({
        userName: 'John Doe',
        preferences
    });

    console.log('📧 Subject:', emailContent.subject);
    console.log('📝 HTML Length:', emailContent.html.length, 'characters\n');

    // Check for preference data
    console.log('Checking for preference data in HTML:');
    console.log('  TechCrunch found:', emailContent.html.includes('TechCrunch'));
    console.log('  (+1.5) found:', emailContent.html.includes('(+1.5)'));
    console.log('  Technology found:', emailContent.html.includes('Technology'));
    console.log('  (+2.0) found:', emailContent.html.includes('(+2.0)'));
    console.log('  "TechCrunch (+1.5)" found:', emailContent.html.includes('TechCrunch (+1.5)'));

    // Save to file
    const outputPath = path.join(__dirname, '../../sample-acknowledgment-email.html');
    await fs.writeFile(outputPath, emailContent.html);
    console.log('\n✅ Sample email saved to:', outputPath);
    console.log('   Open this file in a browser to preview the email\n');
}

generateSample().catch(console.error);
