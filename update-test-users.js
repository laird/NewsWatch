const { subscribers, db } = require('./backend/database/firestore');

async function setTestUsers() {
    const testEmails = ['laird@popk.in', 'lairdapopkin@hotmail.com'];

    console.log('Updating test users...');

    for (const email of testEmails) {
        const user = await subscribers.getByEmail(email);
        if (user) {
            await db.collection('subscribers').doc(user.id).update({
                is_test_user: true
            });
            console.log(`✓ Set is_test_user=true for ${email}`);
        } else {
            console.log(`⚠️ User ${email} not found`);
            // Create if not exists for testing purposes? No, better to just log.
        }
    }

    console.log('Done.');
}

setTestUsers().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
