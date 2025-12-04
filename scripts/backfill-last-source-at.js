const { db, collections } = require('../backend/database/firestore');
const { timestampFromDate } = require('../backend/database/db-firestore');

async function backfillLastSourceAt() {
    console.log('Starting backfill of last_source_at...');

    const snapshot = await collections.stories.get();
    let updatedCount = 0;
    let skippedCount = 0;

    const batchSize = 500;
    let batch = db.batch();
    let operationCount = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();

        // Skip if already has last_source_at
        if (data.last_source_at) {
            skippedCount++;
            continue;
        }

        let maxDate = data.published_at ? data.published_at.toDate() : (data.ingested_at ? data.ingested_at.toDate() : new Date());

        // Check sources for later dates
        if (data.sources && Array.isArray(data.sources)) {
            for (const source of data.sources) {
                if (source.published_at) {
                    const sourceDate = new Date(source.published_at);
                    if (sourceDate > maxDate) {
                        maxDate = sourceDate;
                    }
                }
            }
        }

        const ref = collections.stories.doc(doc.id);
        batch.update(ref, {
            last_source_at: timestampFromDate(maxDate)
        });

        operationCount++;
        updatedCount++;

        if (operationCount >= batchSize) {
            await batch.commit();
            console.log(`Committed batch of ${operationCount} updates`);
            batch = db.batch();
            operationCount = 0;
        }
    }

    if (operationCount > 0) {
        await batch.commit();
        console.log(`Committed final batch of ${operationCount} updates`);
    }

    console.log(`Backfill complete.`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped: ${skippedCount}`);
}

backfillLastSourceAt().catch(console.error);
