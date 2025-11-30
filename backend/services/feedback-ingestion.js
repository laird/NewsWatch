const gmailClient = require('./gmail-client');
const { addDoc, serverTimestamp } = require('../database/db-firestore');

/**
 * Ingest feedback from email replies
 */
async function ingestEmailFeedback() {
    console.log('\n📧 Checking for email feedback...');

    try {
        const replies = await gmailClient.checkRecentReplies();

        if (replies.length === 0) {
            console.log('  No new feedback found.');
            return;
        }

        console.log(`  Found ${replies.length} new feedback emails.`);

        for (const reply of replies) {
            // Store in Firestore
            await addDoc('feedback', {
                source: 'email_reply',
                from_email: reply.from,
                subject: reply.subject,
                feedback_text: reply.body,
                submitted_at: serverTimestamp(),
                processed_for_ai: false // Flag to indicate if AI has seen this yet
            });

            // 4. Update Unified Guidance
            const guidanceService = require('./guidance-service');
            await guidanceService.updateGuidance(reply.body);

            console.log(`  ✓ Saved feedback from ${reply.from} and updated guidance`);

            // 5. Auto-send newsletter if enabled (only for test users)
            if (process.env.AUTO_SEND_ON_FEEDBACK === 'true') {
                // Extract email from "Name <email>" format if necessary
                const emailMatch = reply.from.match(/<(.+)>/) || [null, reply.from];
                const email = emailMatch[1] || reply.from;

                // Check if user is a test user
                const { queryDocs } = require('../database/db-firestore');
                const users = await queryDocs('subscribers', [
                    { field: 'email', op: '==', value: email }
                ]);

                const isTestUser = users.length > 0 && users[0].is_test_user;

                if (isTestUser) {
                    console.log(`  📰 Auto-sending updated newsletter to test user ${email}...`);
                    const { generateAndSendNewsletter } = require('./newsletter');
                    await generateAndSendNewsletter();
                    console.log('  ✓ Updated newsletter sent');
                } else {
                    console.log(`  ℹ️  Skipping auto-send for non-test user ${email}`);
                }
            }
        }

    } catch (error) {
        console.error('Error ingesting feedback:', error);
    }
}

module.exports = {
    ingestEmailFeedback
};
