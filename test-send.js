require('dotenv').config({ path: require('path').resolve(__dirname, 'backend/.env') });
const { generateAndSendNewsletter } = require('./backend/services/newsletter');

async function testSend() {
    console.log('🚀 Starting test send...');
    try {
        const result = await generateAndSendNewsletter();
        console.log('✅ Test send complete:', result);
    } catch (error) {
        console.error('❌ Test send failed:', error);
    }
    process.exit(0);
}

testSend();
