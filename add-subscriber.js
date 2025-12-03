require('dotenv').config({ path: require('path').resolve(__dirname, 'backend/.env') });
const { addDoc, serverTimestamp } = require('./backend/database/db-firestore');

async function addSubscriber() {
    const email = 'lairdapopkin@hotmail.com';
    console.log(`Adding subscriber: ${email}`);

    try {
        await addDoc('subscribers', {
            email: email,
            name: 'Laird Popkin',
            is_active: true,
            subscribed_at: serverTimestamp(),
            source: 'manual_add'
        });
        console.log('✅ Subscriber added successfully');
    } catch (error) {
        console.error('❌ Failed to add subscriber:', error);
    }
}

addSubscriber();
