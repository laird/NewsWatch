const cron = require('node-cron');
const { generateAndSendNewsletter } = require('./services/newsletter');
const { ingestNews } = require('./services/newsIngestion');
const { generateStaticSite } = require('./generate-site');

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

    // Hourly news ingestion and site generation
    cron.schedule('0 * * * *', async () => {
        console.log(`\n📡 Scheduled news ingestion triggered at ${new Date().toLocaleString()}`);
        try {
            await ingestNews();
            console.log('✅ Scheduled news ingestion complete');

            // Generate static site after ingestion
            await generateStaticSite();
            console.log('✅ Static site regenerated\n');
        } catch (error) {
            console.error('❌ Scheduled task failed:', error);
        }
    });

    console.log('  ✓ News ingestion scheduled hourly');

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
