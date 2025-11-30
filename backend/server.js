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

// Serve static content from Firestore
const { db } = require('./database/firestore');

// Serve index page
app.get('/', async (req, res) => {
    try {
        const doc = await db.collection('static_site').doc('index').get();
        if (doc.exists) {
            res.send(doc.data().html);
        } else {
            // Fallback to loading message or trigger generation
            res.send('<html><body><h1>Site is generating... please refresh in a minute.</h1></body></html>');
        }
    } catch (error) {
        console.error('Error serving index:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Serve story pages
app.get('/story/:id.html', async (req, res) => {
    try {
        const doc = await db.collection('static_site').doc(`story_${req.params.id}`).get();
        if (doc.exists) {
            res.send(doc.data().html);
        } else {
            res.status(404).send('Story not found');
        }
    } catch (error) {
        console.error('Error serving story:', error);
        res.status(500).send('Internal Server Error');
    }
});

// API route to trigger generation (for Cloud Scheduler)
app.post('/api/generate-site', async (req, res) => {
    try {
        const { generateStaticSite } = require('./generate-site');
        // Run asynchronously to avoid timeout
        generateStaticSite().catch(err => console.error('Generation failed:', err));
        res.json({ status: 'started', message: 'Site generation triggered' });
    } catch (error) {
        console.error('Error triggering generation:', error);
        res.status(500).json({ error: 'Failed to trigger generation' });
    }
});

// Serve other static files (CSS, JS, images) from public directory
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
