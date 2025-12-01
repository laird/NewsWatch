const { Firestore } = require('@google-cloud/firestore');

async function addProductionTestUsers() {
    const db = new Firestore({
        projectId: 'newswatch-479605'
    });

    const testUsers = [
        {
            email: 'laird@popk.in',
            is_test_user: true,
            subscribed: true,
            created_at: new Date()
        },
        {
            email: 'lairdapopkin@hotmail.com',
            is_test_user: true,
            subscribed: true,
            created_at: new Date()
        }
    ];

    console.log('Adding test users to production...');

    for (const user of testUsers) {
        // Check if user exists
        const existingUsers = await db.collection('subscribers')
            .where('email', '==', user.email)
            .get();

        if (existingUsers.empty) {
            // Add new user
            await db.collection('subscribers').add(user);
            console.log(`✓ Added ${user.email}`);
        } else {
            // Update existing user
            const doc = existingUsers.docs[0];
            await db.collection('subscribers').doc(doc.id).update({
                is_test_user: true,
                subscribed: true
            });
            console.log(`✓ Updated ${user.email} to test user`);
        }
    }

    console.log('Done!');
}

addProductionTestUsers().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
