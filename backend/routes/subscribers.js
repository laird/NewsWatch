const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Register with invitation code
router.post('/register', async (req, res) => {
    try {
        const { email, name, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ error: 'Email and invitation code are required' });
        }

        // 1. Verify invitation code
        const inviteResult = await db.query(
            'SELECT * FROM invitations WHERE code = $1 AND is_used = false',
            [code]
        );

        if (inviteResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or used invitation code' });
        }

        const invite = inviteResult.rows[0];

        // 2. Create subscriber
        const subscriberResult = await db.query(
            `INSERT INTO subscribers (email, name)
       VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING
       RETURNING *`,
            [email, name || email.split('@')[0]]
        );

        if (subscriberResult.rows.length === 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // 3. Mark invitation as used
        await db.query(
            'UPDATE invitations SET is_used = true, used_by_email = $1, used_at = NOW() WHERE id = $2',
            [email, invite.id]
        );

        console.log(`✓ New subscriber registered: ${email} (Code: ${code})`);

        res.status(201).json({
            success: true,
            subscriber: subscriberResult.rows[0]
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

            await db.query(
                'INSERT INTO invitations (code) VALUES ($1)',
                [code]
            );
            codes.push(code);
        }

        res.json({ success: true, codes });

    } catch (error) {
        console.error('Error generating invites:', error);
        res.status(500).json({ error: 'Failed to generate invites' });
    }
});

module.exports = router;
