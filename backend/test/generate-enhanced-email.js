const { generateFeedbackAcknowledgmentEmail, extractUserName } = require('../services/email-templates');
const fs = require('fs').promises;
const path = require('path');

async function generateSample() {
    console.log('🧪 Generating Enhanced Feedback Acknowledgment Email with User Guidance...\n');

    const userGuidance = "Prioritize stories about SaaS companies with strong unit economics and sustainable growth. Focus on enterprise software acquisitions and healthcare technology platforms. Avoid cryptocurrency-related content unless it directly impacts software infrastructure businesses.";

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
        userGuidance,
        preferences
    });

    console.log('📧 Subject:', emailContent.subject);
    console.log('📝 HTML Length:', emailContent.html.length, 'characters\n');

    // Check for content
    console.log('Checking content in HTML:');
    console.log('  User guidance found:', emailContent.html.includes(userGuidance.substring(0, 50)));
    console.log('  Personalization section found:', emailContent.html.includes('Your Personalization'));
    console.log('  Voting preferences section found:', emailContent.html.includes('Your Voting Preferences'));
    console.log('  TechCrunch found:', emailContent.html.includes('TechCrunch'));

    // Save to file
    const outputPath = path.join(__dirname, '../../sample-acknowledgment-email-enhanced.html');
    await fs.writeFile(outputPath, emailContent.html);
    console.log('\n✅ Enhanced email saved to:', outputPath);
    console.log('   Open this file in a browser to preview\n');
}

generateSample().catch(console.error);
