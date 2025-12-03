const { google } = require('googleapis');
const { OAuth2 } = google.auth;
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

/**
 * Gmail Client for sending and receiving emails
 */
class GmailClient {
    constructor() {
        this.oauth2Client = new OAuth2(
            process.env.GMAIL_CLIENT_ID,
            process.env.GMAIL_CLIENT_SECRET,
            "https://developers.google.com/oauthplayground" // Redirect URL
        );

        if (process.env.GMAIL_REFRESH_TOKEN) {
            this.oauth2Client.setCredentials({
                refresh_token: process.env.GMAIL_REFRESH_TOKEN
            });
        }

        this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    }

    /**
     * Send an email via Gmail API
     */
    async sendEmail({ to, subject, html }) {
        const nodemailer = require('nodemailer');

        try {
            // Create a dummy transport to generate the raw email
            const mailComposer = nodemailer.createTransport({
                streamTransport: true,
                newline: 'windows' // Force CRLF
            });

            const mailOptions = {
                to,
                subject,
                html
            };

            // Generate raw email
            const info = await mailComposer.sendMail(mailOptions);

            // Read stream to string
            const rawMessage = await new Promise((resolve, reject) => {
                const chunks = [];
                info.message.on('data', chunk => chunks.push(chunk));
                info.message.on('end', () => resolve(Buffer.concat(chunks).toString()));
                info.message.on('error', reject);
            });

            // Encode for Gmail API
            const encodedMessage = Buffer.from(rawMessage)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            const res = await this.gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedMessage,
                },
            });

            console.log(`✓ Email sent via Gmail API: ${res.data.id}`);
            return res.data;
        } catch (error) {
            console.error('❌ Gmail send failed:', error);
            throw error;
        }
    }

    /**
     * Check for recent replies (feedback)
     * Looks for unread messages in the inbox
     */
    async checkRecentReplies() {
        try {
            // List unread messages sent to our specific address
            const res = await this.gmail.users.messages.list({
                userId: 'me',
                q: 'is:unread to:laird+newswatch@popk.in',
                maxResults: 10
            });

            const messages = res.data.messages || [];
            const replies = [];

            for (const msg of messages) {
                const email = await this.gmail.users.messages.get({
                    userId: 'me',
                    id: msg.id
                });

                const headers = email.data.payload.headers;
                const subject = headers.find(h => h.name === 'Subject')?.value || '';
                const from = headers.find(h => h.name === 'From')?.value || '';

                // Only process if it looks like a reply to our newsletter
                if (subject.toLowerCase().includes('newswatch') || subject.toLowerCase().includes('re:')) {
                    const body = this.extractBody(email.data.payload);

                    replies.push({
                        id: msg.id,
                        from,
                        subject,
                        body,
                        receivedAt: new Date(parseInt(email.data.internalDate))
                    });

                    // Mark as read so we don't process again
                    await this.gmail.users.messages.modify({
                        userId: 'me',
                        id: msg.id,
                        requestBody: {
                            removeLabelIds: ['UNREAD']
                        }
                    });
                }
            }

            return replies;

        } catch (error) {
            console.error('❌ Failed to check replies:', error);
            return [];
        }
    }

    extractBody(payload) {
        let body = '';
        if (payload.parts) {
            for (const part of payload.parts) {
                if (part.mimeType === 'text/plain') {
                    body = Buffer.from(part.body.data, 'base64').toString();
                    break;
                }
            }
        } else if (payload.body && payload.body.data) {
            body = Buffer.from(payload.body.data, 'base64').toString();
        }
        return body;
    }
}

module.exports = new GmailClient();
