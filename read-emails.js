const { google } = require('googleapis');
const { OAuth2 } = google.auth;
require('dotenv').config({ path: require('path').resolve(__dirname, 'backend/.env') });

/**
 * Read sent NewsWatch newsletters
 */
async function readEmails() {
    try {
        // Check for Gmail credentials
        if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
            console.log('⚠️  Gmail credentials not found in backend/.env');
            console.log('Looking for credentials in GCP Secret Manager...\n');

            // Try to get from GCP
            const { execSync } = require('child_process');
            try {
                const clientId = execSync('gcloud secrets versions access latest --secret=gmail-client-id 2>/dev/null', { encoding: 'utf8' }).trim();
                const clientSecret = execSync('gcloud secrets versions access latest --secret=gmail-client-secret 2>/dev/null', { encoding: 'utf8' }).trim();
                const refreshToken = execSync('gcloud secrets versions access latest --secret=gmail-refresh-token 2>/dev/null', { encoding: 'utf8' }).trim();

                process.env.GMAIL_CLIENT_ID = clientId;
                process.env.GMAIL_CLIENT_SECRET = clientSecret;
                process.env.GMAIL_REFRESH_TOKEN = refreshToken;

                console.log('✓ Retrieved Gmail credentials from GCP Secret Manager\n');
            } catch (err) {
                console.error('❌ Could not retrieve Gmail credentials from GCP Secret Manager');
                console.error('Please ensure you have the credentials set up.');
                return;
            }
        }

        const oauth2Client = new OAuth2(
            process.env.GMAIL_CLIENT_ID,
            process.env.GMAIL_CLIENT_SECRET,
            "https://developers.google.com/oauthplayground"
        );

        oauth2Client.setCredentials({
            refresh_token: process.env.GMAIL_REFRESH_TOKEN
        });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        console.log('📧 Searching for sent NewsWatch newsletters...\n');

        // Search for sent NewsWatch newsletters
        const res = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 10,
            q: 'in:sent subject:"NewsWatch Daily Brief"' // Search sent folder for newsletters
        });

        const messages = res.data.messages || [];


        if (messages.length === 0) {
            console.log('No NewsWatch newsletters found in sent folder.');
            return;
        }

        console.log(`Found ${messages.length} sent newsletters:\n`);
        console.log('='.repeat(80));

        for (const msg of messages) {
            const email = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id,
                format: 'full'
            });

            const headers = email.data.payload.headers;
            const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
            const to = headers.find(h => h.name === 'To')?.value || '(Unknown)';
            const date = headers.find(h => h.name === 'Date')?.value || '';
            const body = extractBody(email.data.payload);

            console.log(`\nDate: ${date}`);
            console.log(`To: ${to}`);
            console.log(`Subject: ${subject}`);
            console.log(`\nNewsletter Content:`);
            console.log('-'.repeat(80));

            // For HTML newsletters, show a preview
            if (body.includes('<html>')) {
                // Extract text content from HTML for preview
                const textPreview = body
                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();

                console.log('HTML Newsletter (text preview):');
                console.log(textPreview.substring(0, 1000));
                if (textPreview.length > 1000) {
                    console.log(`\n... (${textPreview.length - 1000} more characters)`);
                }

                // Save full HTML to file
                const fs = require('fs');
                const filename = `newsletter-${msg.id}.html`;
                fs.writeFileSync(filename, body);
                console.log(`\n✓ Full HTML saved to: ${filename}`);
            } else {
                console.log(body.substring(0, 1000));
                if (body.length > 1000) {
                    console.log(`\n... (${body.length - 1000} more characters)`);
                }
            }
            console.log('='.repeat(80));
        }

        console.log(`\n✅ Displayed ${messages.length} newsletters\n`);

    } catch (error) {
        console.error('❌ Error reading emails:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

// Helper function to extract email body
function extractBody(payload) {
    let body = '';

    if (payload.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/html' && part.body.data) {
                body = Buffer.from(part.body.data, 'base64').toString();
                break;
            } else if (part.mimeType === 'text/plain' && part.body.data && !body) {
                body = Buffer.from(part.body.data, 'base64').toString();
            } else if (part.parts) {
                // Recursively search nested parts
                const nestedBody = extractBody(part);
                if (nestedBody) body = nestedBody;
            }
        }
    } else if (payload.body && payload.body.data) {
        body = Buffer.from(payload.body.data, 'base64').toString();
    }

    return body;
}

// Run the script
readEmails();
