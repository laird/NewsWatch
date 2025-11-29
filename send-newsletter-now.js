require('dotenv').config({ path: require('path').resolve(__dirname, 'backend/.env') });
const { generateAndSendNewsletter } = require('./backend/services/newsletter');

async function sendNow() {
    console.log('🚀 Triggering immediate newsletter generation...');
    try {
        const result = await generateAndSendNewsletter();
        console.log('\n📊 Result:', result);
    } catch (error) {
        console.error('❌ Failed:', error);
    }
}

sendNow();
