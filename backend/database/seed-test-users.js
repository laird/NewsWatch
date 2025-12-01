const { subscribers } = require('./firestore');

/**
 * Ensure test users exist in the database
 * Called on server startup
 */
async function seedTestUsers() {
    const testUsers = [
        {
            email: 'laird@popk.in',
            is_test_user: true,
            subscribed: true
        },
        {
            email: 'lairdapopkin@hotmail.com',
            is_test_user: true,
            subscribed: true
        }
    ];

    console.log('🔧 Checking test users...');

    for (const userData of testUsers) {
        try {
            // Check if user exists
            const existingUser = await subscribers.getByEmail(userData.email);

            if (!existingUser) {
                // Create new user
                await subscribers.create(userData);
                console.log(`  ✓ Created test user: ${userData.email}`);
            } else {
                // Update to ensure is_test_user flag is set
                if (!existingUser.is_test_user) {
                    await subscribers.update(existingUser.id, {
                        is_test_user: true,
                        subscribed: true
                    });
                    console.log(`  ✓ Updated test user: ${userData.email}`);
                } else {
                    console.log(`  ✓ Test user exists: ${userData.email}`);
                }
            }
        } catch (error) {
            console.error(`  ✗ Error seeding test user ${userData.email}:`, error.message);
        }
    }

    console.log('✅ Test users ready\n');
}

module.exports = { seedTestUsers };
