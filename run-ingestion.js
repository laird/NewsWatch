const { ingestNews } = require('./backend/services/newsIngestion');

async function run() {
    try {
        await ingestNews();
        process.exit(0);
    } catch (error) {
        console.error('Ingestion failed:', error);
        process.exit(1);
    }
}

run();
