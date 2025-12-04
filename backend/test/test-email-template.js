const { generateFeedbackAcknowledgmentEmail, extractUserName } = require('../services/email-templates');

console.log('🧪 Testing Feedback Acknowledgment Email Generation...\n');

// Test 1: Extract User Name
console.log('Test 1: Extract User Name');
const email1 = 'John Doe <john@example.com>';
const name1 = extractUserName(email1);
console.log(`Input: "${email1}" -> Output: "${name1}"`);
if (name1 !== 'John Doe') console.error('❌ Failed to extract name from format "Name <email>"');
else console.log('✅ Passed');

const email2 = 'jane@example.com';
const name2 = extractUserName(email2);
console.log(`Input: "${email2}" -> Output: "${name2}"`);
if (name2 !== 'Jane') console.error('❌ Failed to extract name from simple email');
else console.log('✅ Passed');

console.log('\n---------------------------------------------------\n');

// Test 2: Generate Email with Preferences
console.log('Test 2: Generate Email with Preferences');
const preferences = {
    topSources: [
        { name: 'TechCrunch', weight: 1.5 },
        { name: 'Bloomberg', weight: 0.8 }
    ],
    topCategories: [
        { name: 'Technology', weight: 2.0 },
        { name: 'Finance', weight: 1.2 }
    ]
};

const emailContent = generateFeedbackAcknowledgmentEmail({
    userName: 'John',
    preferences
});

console.log('Subject:', emailContent.subject);
if (emailContent.subject !== 'Thanks for your feedback!') console.error('❌ Incorrect subject');
else console.log('✅ Subject correct');

if (emailContent.html.includes('TechCrunch (+1.5)') && emailContent.html.includes('Technology (+2.0)')) {
    console.log('✅ HTML contains preference data');
} else {
    console.error('❌ HTML missing preference data');
}

if (emailContent.html.includes('Hi John,')) {
    console.log('✅ HTML contains user name');
} else {
    console.error('❌ HTML missing user name');
}

console.log('\n---------------------------------------------------\n');

// Test 3: Generate Email without Preferences (Empty)
console.log('Test 3: Generate Email with Empty Preferences');
const emptyEmailContent = generateFeedbackAcknowledgmentEmail({
    userName: 'Jane',
    preferences: {}
});

if (emptyEmailContent.html.includes('No source preferences yet')) {
    console.log('✅ HTML handles empty sources correctly');
} else {
    console.error('❌ HTML failed to handle empty sources');
}

console.log('\n🎉 Tests Completed');
