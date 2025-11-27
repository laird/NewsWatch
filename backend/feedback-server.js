const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database/db');
const feedbackRoutes = require('./routes/feedback');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow all origins for now (needed for file:// access)
app.use(bodyParser.json());

// Routes
app.use('/api/feedback', feedbackRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'NewsWatch Feedback Server' });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 Feedback Server running on http://localhost:${PORT}`);
    console.log(`   Accepting feedback for static site`);
});
