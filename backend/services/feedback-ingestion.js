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

            // 5. Auto-send newsletter if enabled
            if (process.env.AUTO_SEND_ON_FEEDBACK === 'true') {
                console.log('  📰 Auto-sending updated newsletter...');
                const { generateAndSendNewsletter } = require('./newsletter');
                await generateAndSendNewsletter();
                console.log('  ✓ Updated newsletter sent');
            }
        }

    } catch (error) {
        console.error('Error ingesting feedback:', error);
    }
}

module.exports = {
    ingestEmailFeedback
};
