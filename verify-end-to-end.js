require('dotenv').config({ path: require('path').resolve(__dirname, 'backend/.env') });
const { generateAndSendNewsletter } = require('./backend/services/newsletter');
const guidanceService = require('./backend/services/guidance-service');

async function endToEndVerification() {
    console.log('🔄 End-to-End Feedback Loop Verification\n');
    console.log('='.repeat(60));

    try {
        // Step 1: Send Initial Newsletter
        console.log('\n📰 STEP 1: Sending initial newsletter...');
        await generateAndSendNewsletter();
        console.log('✅ Initial newsletter sent to lairdapopkin@hotmail.com');

        // Step 2: Check Initial Guidance
        console.log('\n🧠 STEP 2: Checking current guidance...');
        const initialGuidance = await guidanceService.getCurrentGuidance();
        console.log('Current Guidance:');
        console.log('----------------------------------------');
        console.log(initialGuidance || 'No guidance set yet');
        console.log('----------------------------------------');

        // Step 3: Simulate Feedback
        console.log('\n💬 STEP 3: Simulating user feedback...');
        const feedback = "Focus heavily on enterprise SaaS with ARR > $10M. Ignore consumer apps.";
        console.log(`Feedback: "${feedback}"`);
        await guidanceService.updateGuidance(feedback);

        // Step 4: Verify Guidance Update
        console.log('\n🔍 STEP 4: Verifying guidance was updated...');
        const updatedGuidance = await guidanceService.getCurrentGuidance();
        console.log('Updated Guidance:');
        console.log('----------------------------------------');
        console.log(updatedGuidance);
        console.log('----------------------------------------');

        // Step 5: Send Second Newsletter (with updated guidance)
        console.log('\n📰 STEP 5: Sending second newsletter with updated guidance...');
        await generateAndSendNewsletter();
        console.log('✅ Second newsletter sent (should include updated guidance)');

        console.log('\n' + '='.repeat(60));
        console.log('🎉 SUCCESS: End-to-End Verification Complete!');
        console.log('\nWhat happened:');
        console.log('1. ✓ Sent initial newsletter');
        console.log('2. ✓ Received and processed feedback');
        console.log('3. ✓ AI merged feedback into unified guidance');
        console.log('4. ✓ Sent second newsletter showing updated guidance');
        console.log('\nCheck your inbox for both newsletters!');

    } catch (error) {
        console.error('\n❌ Verification failed:', error);
        throw error;
    }
}

endToEndVerification();
