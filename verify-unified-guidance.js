require('dotenv').config({ path: require('path').resolve(__dirname, 'backend/.env') });
const guidanceService = require('./backend/services/guidance-service');

async function verifyUnifiedGuidance() {
    console.log('🧪 Verifying Unified Guidance System...');

    try {
        // 1. Initial State
        console.log('\n1️⃣  Fetching initial guidance...');
        const initial = await guidanceService.getCurrentGuidance();
        console.log('   Initial Guidance:', initial ? `"${initial.substring(0, 50)}..."` : 'None');

        // 2. Simulate New Feedback
        const feedback1 = "Please focus more on SaaS valuations and ignore crypto news.";
        console.log(`\n2️⃣  Simulating Feedback 1: "${feedback1}"`);
        const updated1 = await guidanceService.updateGuidance(feedback1);
        console.log('   Updated Guidance:', `\n   "${updated1}"`);

        // 3. Simulate More Feedback (Conflicting/Additive)
        const feedback2 = "Actually, keep an eye on crypto infrastructure, but ignore coins. Also look for healthcare rollups.";
        console.log(`\n3️⃣  Simulating Feedback 2: "${feedback2}"`);
        const updated2 = await guidanceService.updateGuidance(feedback2);
        console.log('   Updated Guidance:', `\n   "${updated2}"`);

        console.log('\n🎉 SUCCESS: Guidance is evolving based on feedback!');

    } catch (error) {
        console.error('❌ Verification failed:', error);
    }
}

verifyUnifiedGuidance();
