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

            // 4. Update Unified Guidance (Global - for community news)
            const guidanceService = require('./guidance-service');
            await guidanceService.updateGuidance(reply.body);

            // 4b. Update Per-User Guidance (for personalized news)
            const emailMatch = reply.from.match(/<(.+)>/) || [null, reply.from];
            const email = emailMatch[1] || reply.from;

            const userGuidanceService = require('./user-guidance-service');
            await userGuidanceService.updateUserGuidance(email, reply.body);

            console.log(`  ✓ Saved feedback from ${reply.from} and updated guidance`);

            // 5. Send acknowledgment email to feedback sender
            try {
                // Extract email from "Name <email>" format if necessary
                const emailMatch = reply.from.match(/<(.+)>/) || [null, reply.from];
                const email = emailMatch[1] || reply.from;

                // Get user's text-based guidance
                const userGuidanceService = require('./user-guidance-service');
                const userGuidance = await userGuidanceService.getUserGuidance(email);

                // Get user's preference weights (voting-based)
                const { feedback: feedbackDB } = require('../database/firestore');
                const userFeedback = await feedbackDB.getByUser(email);

                // Build preference profile
                const sources = {};
                const categories = {};

                for (const item of userFeedback) {
                    const vote = item.rating === 'up' ? 1 : (item.rating === 'down' ? -1 : 0);
                    if (vote === 0) continue;

                    if (item.source_domain) {
                        sources[item.source_domain] = (sources[item.source_domain] || 0) + vote;
                    }

                    if (item.sectors && Array.isArray(item.sectors)) {
                        for (const sector of item.sectors) {
                            categories[sector] = (categories[sector] || 0) + vote;
                        }
                    }
                }

                // Get top sources and categories (positive weights only)
                const topSources = Object.entries(sources)
                    .filter(([_, weight]) => weight > 0)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([name, weight]) => ({ name, weight }));

                const topCategories = Object.entries(categories)
                    .filter(([_, weight]) => weight > 0)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([name, weight]) => ({ name, weight }));

                // Generate and send email
                const emailTemplates = require('./email-templates');
                const userName = emailTemplates.extractUserName(reply.from);
                const emailContent = emailTemplates.generateFeedbackAcknowledgmentEmail({
                    userName,
                    userGuidance,
                    preferences: { topSources, topCategories }
                });

                const { sendBulkEmail } = require('./newsletter');
                await sendBulkEmail({
                    to: [email],
                    subject: emailContent.subject,
                    html: emailContent.html
                });

                console.log(`  📧 Sent acknowledgment email to ${email}`);
            } catch (emailError) {
                console.error(`  ⚠️ Failed to send acknowledgment email:`, emailError.message);
                // Continue processing even if email fails
            }

            // 6. Auto-send newsletter if enabled (only for test users)
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
