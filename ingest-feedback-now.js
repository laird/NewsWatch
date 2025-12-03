const { ingestEmailFeedback } = require('./backend/services/feedback-ingestion');
const { getFeedbackGuidance } = require('./backend/services/peAnalysis');
require('dotenv').config({ path: require('path').resolve(__dirname, 'backend/.env') });

async function testFeedbackLoop() {
    console.log('🔄 Testing Feedback Loop...');

    try {
        // 1. Ingest Feedback
        console.log('\n📥 Ingesting feedback from Gmail...');
        await ingestEmailFeedback();

        // 2. Verify AI Guidance
        console.log('\n🤖 Checking AI Guidance...');
        const guidance = await getFeedbackGuidance();

        if (guidance) {
            console.log('✅ AI Guidance found:');
            console.log('----------------------------------------');
            console.log(guidance);
            console.log('----------------------------------------');
            console.log('🎉 SUCCESS: Feedback loop is operational!');
        } else {
            console.log('ℹ️  No recent feedback found yet.');
            console.log('   (Did you reply to the newsletter?)');
        }

    } catch (error) {
        console.error('❌ Feedback loop test failed:', error);
    }
}

testFeedbackLoop();
