const cron = require('node-cron');
const { generateAndSendNewsletter } = require('./services/newsletter');
const { ingestNews } = require('./services/newsIngestion');
const { ingestEmailFeedback } = require('./services/feedback-ingestion');

/**
 * Initialize all scheduled tasks
 */
function initializeScheduler() {
    console.log('\n⏰ Initializing scheduler...\n');

    // Daily newsletter at 6:00 AM
    const newsletterTime = process.env.NEWSLETTER_SEND_TIME || '06:00';
    const [hour, minute] = newsletterTime.split(':');

    cron.schedule(`${minute} ${hour} * * *`, async () => {
        console.log(`\n📧 Scheduled newsletter send triggered at ${new Date().toLocaleString()}`);
        try {
            await generateAndSendNewsletter();
            console.log('✅ Scheduled newsletter sent successfully\n');
        } catch (error) {
            console.error('❌ Scheduled newsletter failed:', error);
            // TODO: Send alert to admin
        }
    }, {
        timezone: process.env.NEWSLETTER_TIMEZONE || 'America/New_York'
    });

    console.log(`  ✓ Newsletter scheduled for ${newsletterTime} daily (${process.env.NEWSLETTER_TIMEZONE || 'America/New_York'})`);

    // Hourly news ingestion
    cron.schedule('0 * * * *', async () => {
        console.log(`\n📡 Scheduled news ingestion triggered at ${new Date().toLocaleString()}`);
        try {
            await ingestNews();
            console.log('✅ Scheduled news ingestion complete\n');
        } catch (error) {
            console.error('❌ Scheduled news ingestion failed:', error);
        }
    });

    console.log('  ✓ News ingestion scheduled hourly');

    // Hourly feedback ingestion (at minute 30)
    cron.schedule('30 * * * *', async () => {
        console.log(`\n📧 Scheduled feedback ingestion triggered at ${new Date().toLocaleString()}`);
        try {
            await ingestEmailFeedback();
            console.log('✅ Feedback ingestion complete\n');
        } catch (error) {
            console.error('❌ Feedback ingestion failed:', error);
        }
    });
    console.log('  ✓ Feedback ingestion scheduled hourly (minute 30)');

    // Optional: Run news ingestion immediately on startup
    if (process.env.INGEST_ON_STARTUP !== 'false') {
        console.log('\n  ⚡ Running initial news ingestion...');
        setTimeout(async () => {
            try {
                await ingestNews();
            } catch (error) {
                console.error('Initial news ingestion failed:', error);
            }
        }, 5000); // Wait 5 seconds after startup
    }

    console.log('\n✅ Scheduler initialized\n');
}

module.exports = {
    initializeScheduler
};
