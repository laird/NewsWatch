const { google } = require('googleapis');
const readline = require('readline');
const http = require('http');
const url = require('url');
const opn = require('open'); // You might need to install this: npm install open
const destroyer = require('server-destroy'); // You might need to install this: npm install server-destroy
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'backend/.env') });

/**
 * Script to generate OAuth2 Refresh Token for Gmail API
 */

const SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify'
];

async function getRefreshToken() {
    let clientId = process.env.GMAIL_CLIENT_ID;
    let clientSecret = process.env.GMAIL_CLIENT_SECRET;

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    if (!clientId || !clientSecret) {
        console.log('⚠️  GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET not found in backend/.env');
        console.log('Please enter them manually (you can get these from Google Cloud Console):\n');

        if (!clientId) {
            clientId = await new Promise(resolve => {
                rl.question('Enter Client ID: ', answer => resolve(answer.trim()));
            });
        }

        if (!clientSecret) {
            clientSecret = await new Promise(resolve => {
                rl.question('Enter Client Secret: ', answer => resolve(answer.trim()));
            });
        }
    }

    if (!clientId || !clientSecret) {
        console.error('❌ Error: Client ID and Client Secret are required.');
        process.exit(1);
    }

    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'http://localhost:8081/oauth2callback'
    );

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent' // Force refresh token generation
    });

    console.log('\n🔐 Authenticating with Google...');
    console.log('Opening browser to authorize access...');

    // Create a temporary server to handle the callback

    const server = http.createServer(async (req, res) => {
        try {
            if (req.url.startsWith('/oauth2callback')) {
                const qs = new url.URL(req.url, 'http://localhost:8081').searchParams;
                const code = qs.get('code');

                res.end('Authentication successful! You can close this window and check your terminal.');
                server.destroy();
                rl.close();

                await exchangeCode(code, oauth2Client);
            }
        } catch (e) {
            console.error(e);
            res.end('Authentication failed');
            server.destroy();
        }
    }).listen(8081, () => {
        // Open the browser to the auth url
        console.log(`\nIf browser doesn't open, visit this URL manually:\n${authUrl}\n`);
        console.log('Waiting for authentication...');
        console.log('If the automatic callback fails, copy the "code" parameter from the URL after you log in and paste it here:');

        // Try to open using 'open' package if available, otherwise just log
        import('open').then(open => open.default(authUrl)).catch(() => { });
    });

    destroyer(server);

    // Handle manual input
    rl.question('> ', async (code) => {
        if (code && code.trim()) {
            console.log('Processing manual code...');
            server.destroy();
            rl.close();
            await exchangeCode(code.trim(), oauth2Client);
        }
    });
}

async function exchangeCode(code, oauth2Client) {
    try {
        const { tokens } = await oauth2Client.getToken(code);

        console.log('\n✅ Authentication successful!');
        console.log('\nAdd this to your backend/.env file:');
        console.log('----------------------------------------');
        console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
        console.log('----------------------------------------');

        if (!tokens.refresh_token) {
            console.warn('⚠️  No refresh token returned. Did you forget to set prompt: "consent"?');
        }
        process.exit(0);
    } catch (error) {
        console.error('Error exchanging code:', error.message);
        process.exit(1);
    }
}

getRefreshToken();
