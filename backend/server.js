const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const feedbackRoutes = require('./routes/feedback');
const storiesRoutes = require('./routes/stories');
const newsletterRoutes = require('./routes/newsletter');
const subscriberRoutes = require('./routes/subscribers');
const adminRoutes = require('./routes/admin');
const { initializeScheduler } = require('./scheduler');
const { seedTestUsers } = require('./database/seed-test-users');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/api/feedback', feedbackRoutes);
app.use('/vote', require('./routes/vote'));
app.use('/api/stories', storiesRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/subscribers', subscriberRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reanalyze', require('./routes/reanalyze'));

// Redirect to GCS static site (production) or serve local (dev)
const GCS_BASE_URL = 'https://storage.googleapis.com/newswatch-479605-public';
const IS_DEV = process.env.NODE_ENV !== 'production';

// Helper to serve file from GCS
async function serveFromGCS(res, filename, contentType) {
    try {
        const { Storage } = require('@google-cloud/storage');
        const storage = new Storage();
        const bucketName = `${process.env.GCP_PROJECT_ID}-public`;
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(filename);

        const [exists] = await file.exists();
        if (!exists) {
            return res.status(404).send('Not found');
        }

        if (contentType) {
            res.setHeader('Content-Type', contentType);
        }

        // Pipe the file stream to the response
        file.createReadStream()
            .on('error', (err) => {
                console.error(`Error streaming ${filename} from GCS:`, err);
                res.status(500).end();
            })
            .pipe(res);

    } catch (error) {
        console.error(`Error serving ${filename} from GCS:`, error);
        res.status(500).send('Internal Server Error');
    }
}

// Serve index page
app.get('/', (req, res) => {
    if (IS_DEV) {
        res.sendFile(path.join(__dirname, '../public/index.html'));
    } else {
        serveFromGCS(res, 'index.html', 'text/html');
    }
});

// Serve archive page
app.get('/archive.html', (req, res) => {
    if (IS_DEV) {
        res.sendFile(path.join(__dirname, '../public/archive.html'));
    } else {
        serveFromGCS(res, 'archive.html', 'text/html');
    }
});

// Serve story pages
app.get('/story/:id.html', (req, res) => {
    if (IS_DEV) {
        res.sendFile(path.join(__dirname, `../public/story/${req.params.id}.html`));
    } else {
        serveFromGCS(res, `story/${req.params.id}.html`, 'text/html');
    }
});

// Serve admin page (local only, not on GCS)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// API route to trigger generation (for Cloud Scheduler)
app.post('/api/generate-site', async (req, res) => {
    try {
        const { generateStaticSite } = require('./generate-site');
        // Run asynchronously to avoid timeout
        generateStaticSite().catch(err => console.error('Generation failed:', err));
        res.json({ status: 'started', message: 'Site generation triggered (GCS)' });
    } catch (error) {
        console.error('Error triggering generation:', error);
        res.status(500).json({ error: 'Failed to trigger generation' });
    }
});

// In production, proxy CSS/JS from GCS. In dev, express.static serves from public/
if (!IS_DEV) {
    app.get('/styles.css', (req, res) => serveFromGCS(res, 'styles.css', 'text/css'));
    app.get('/script.js', (req, res) => serveFromGCS(res, 'script.js', 'application/javascript'));
}

// Keep express.static for fallback/local dev
app.use(express.static(path.join(__dirname, '../public')));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`\n🚀 NewsWatch API server running on http://0.0.0.0:${PORT}`);
    console.log(`📊 Health check: http://0.0.0.0:${PORT}/health`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}\n`);

    // Seed test users
    try {
        await seedTestUsers();
    } catch (error) {
        console.error('⚠️ Failed to seed test users:', error.message);
    }

    // Initialize scheduler
    if (process.env.ENABLE_SCHEDULER !== 'false') {
        initializeScheduler();
    } else {
        console.log('⚠️ Scheduler disabled via environment variable');
    }
});

module.exports = app;
