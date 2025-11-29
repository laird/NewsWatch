const gmailClient = require('./backend/services/gmail-client');
require('dotenv').config({ path: require('path').resolve(__dirname, 'backend/.env') });

async function verifyEmail() {
    console.log('🕵️‍♀️ Starting self-verification...');

    const subject = `Verification Test ${Date.now()}`;
    const html = `
        <h1>Verification Test</h1>
        <p>This is a test to verify the email body is visible.</p>
        <p>Sent at: ${new Date().toISOString()}</p>
    `;

    try {
        // 1. Send Email to self
        console.log(`\n📤 Sending test email to ${process.env.ADMIN_EMAIL}...`);
        await gmailClient.sendEmail({
            to: process.env.ADMIN_EMAIL,
            subject,
            html
        });

        console.log('✅ Email sent successfully.');
        console.log('⏳ Waiting 5 seconds for delivery...');

        await new Promise(resolve => setTimeout(resolve, 5000));

        // 2. Check Inbox for the message
        console.log('\n📥 Checking inbox for verification...');
        const replies = await gmailClient.checkRecentReplies();

        // Filter for our specific test subject
        const testEmail = replies.find(r => r.subject === subject);

        if (testEmail) {
            console.log('✅ Found test email in inbox!');
            console.log('----------------------------------------');
            console.log(`Subject: ${testEmail.subject}`);
            console.log(`Body Length: ${testEmail.body.length} chars`);
            console.log(`Body Preview: ${testEmail.body.substring(0, 100).replace(/\n/g, ' ')}...`);
            console.log('----------------------------------------');

            if (testEmail.body.length > 0 && testEmail.body.includes('Verification Test')) {
                console.log('🎉 SUCCESS: Email body is visible and correct.');
            } else {
                console.error('❌ FAILURE: Email body is empty or incorrect.');
            }
        } else {
            console.warn('⚠️  Could not find the test email in inbox (might be in Sent folder or delayed).');
            console.log('Please check your actual inbox manually.');
        }

    } catch (error) {
        console.error('❌ Verification failed:', error);
    }
}

verifyEmail();
