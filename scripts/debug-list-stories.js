const { collections } = require('../backend/database/firestore');

async function listStories() {
    console.log('Listing all stories...');
    const snapshot = await collections.stories.get();
    console.log(`Found ${snapshot.size} stories.`);
    snapshot.forEach(doc => {
        console.log(`- ${doc.id}: ${doc.data().headline}`);
    });
}

listStories().catch(console.error);
