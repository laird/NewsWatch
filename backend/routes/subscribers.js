const express = require('express');
const router = express.Router();
const { subscribers, invitations } = require('../database/firestore');

// Register with invitation code
router.post('/register', async (req, res) => {
    try {
        const { email, name, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ error: 'Email and invitation code are required' });
        }

        // 1. Verify invitation code
        const invite = await invitations.getByCode(code);

        if (!invite) {
            return res.status(400).json({ error: 'Invalid or used invitation code' });
        }

        // 2. Create subscriber
        const subscriber = await subscribers.create({
            email,
            name: name || email.split('@')[0]
        });

        if (!subscriber) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // 3. Mark invitation as used
        await invitations.markUsed(invite.id, email);

        console.log(`✓ New subscriber registered: ${email} (Code: ${code})`);

        res.status(201).json({
            success: true,
            subscriber
        });

    } catch (error) {
        console.error('Error registering subscriber:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Generate invitation codes (Admin only - TODO: Add auth)
router.post('/invite/generate', async (req, res) => {
    try {
        const { count = 1 } = req.body;
        const codes = [];

        for (let i = 0; i < count; i++) {
            // Generate random 8-char code
            const code = Math.random().toString(36).substring(2, 10).toUpperCase();

            await invitations.create(code);
            codes.push(code);
        }

        res.json({ success: true, codes });

    } catch (error) {
        console.error('Error generating invites:', error);
        res.status(500).json({ error: 'Failed to generate invites' });
    }
});

module.exports = router;
