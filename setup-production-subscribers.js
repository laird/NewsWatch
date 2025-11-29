const { addDoc, serverTimestamp } = require('./backend/database/db-firestore');

/**
 * Initialize production subscribers
 */
async function setupProductionSubscribers() {
    console.log('📧 Setting up production subscribers...');

    const subscribers = [
        {
            email: 'laird@popk.in',
            name: 'Laird Popkin',
            is_active: true,
            subscribed_at: serverTimestamp(),
            created_at: serverTimestamp()
        },
        {
            email: 'lairdapopkin@hotmail.com',
            name: 'Laird Popkin',
            is_active: true,
            subscribed_at: serverTimestamp(),
            created_at: serverTimestamp()
        }
    ];

    for (const subscriber of subscribers) {
        try {
            await addDoc('subscribers', subscriber);
            console.log(`✓ Added subscriber: ${subscriber.email}`);
        } catch (error) {
            console.error(`❌ Failed to add ${subscriber.email}:`, error.message);
        }
    }

    console.log('✅ Production subscribers setup complete\n');
}

// Run if executed directly
if (require.main === module) {
    setupProductionSubscribers()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Setup failed:', error);
            process.exit(1);
        });
}

module.exports = { setupProductionSubscribers };
