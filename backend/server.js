const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const feedbackRoutes = require('./routes/feedback');
const storiesRoutes = require('./routes/stories');
const newsletterRoutes = require('./routes/newsletter');
const subscriberRoutes = require('./routes/subscribers');
const { initializeScheduler } = require('./scheduler');

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
app.use('/api/stories', storiesRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/subscribers', subscriberRoutes);
app.use('/api/reanalyze', require('./routes/reanalyze'));

// Redirect to GCS static site
const GCS_BASE_URL = 'https://storage.googleapis.com/newswatch-479605-public';

// Serve index page - Redirect to GCS
app.get('/', (req, res) => {
    res.redirect(`${GCS_BASE_URL}/index.html`);
});

// Serve story pages - Redirect to GCS
app.get('/story/:id.html', (req, res) => {
    res.redirect(`${GCS_BASE_URL}/story/${req.params.id}.html`);
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

// Serve other static files (CSS, JS, images) - Redirect to GCS
// We keep local serving for API-related assets if needed, but for the site we use GCS
app.get('/styles.css', (req, res) => res.redirect(`${GCS_BASE_URL}/styles.css`));
app.get('/script.js', (req, res) => res.redirect(`${GCS_BASE_URL}/script.js`));

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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 NewsWatch API server running on http://0.0.0.0:${PORT}`);
    console.log(`📊 Health check: http://0.0.0.0:${PORT}/health`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}\n`);

    // Initialize scheduler
    initializeScheduler();
});

module.exports = app;
