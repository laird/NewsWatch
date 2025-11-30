require('dotenv').config({ path: require('path').resolve(__dirname, 'backend/.env') });
const { google } = require('googleapis');

async function testAuth() {
    console.log('\n🔍 Testing Gmail OAuth Configuration...\n');

    // Check environment variables
    console.log('Environment Variables:');
    console.log('  GMAIL_CLIENT_ID:', process.env.GMAIL_CLIENT_ID ? '✓ Set' : '✗ Missing');
    console.log('  GMAIL_CLIENT_SECRET:', process.env.GMAIL_CLIENT_SECRET ? '✓ Set' : '✗ Missing');
    console.log('  GMAIL_REFRESH_TOKEN:', process.env.GMAIL_REFRESH_TOKEN ? '✓ Set' : '✗ Missing');
    console.log('  ADMIN_EMAIL:', process.env.ADMIN_EMAIL || 'Not set');
    console.log();

    if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
        console.error('❌ Missing required credentials');
        process.exit(1);
    }

    try {
        const OAuth2 = google.auth.OAuth2;
        const oauth2Client = new OAuth2(
            process.env.GMAIL_CLIENT_ID,
            process.env.GMAIL_CLIENT_SECRET,
            "http://localhost:8081/oauth2callback"
        );

        oauth2Client.setCredentials({
            refresh_token: process.env.GMAIL_REFRESH_TOKEN
        });

        console.log('🔑 Attempting to get access token...');
        const accessTokenResponse = await oauth2Client.getAccessToken();
        console.log('✅ Access token obtained successfully!');
        console.log('   Token:', accessTokenResponse.token.substring(0, 20) + '...');
        console.log();

        // Try to get user info
        console.log('👤 Fetching user info...');
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        console.log('✅ User info retrieved:');
        console.log('   Email:', userInfo.data.email);
        console.log('   Verified:', userInfo.data.verified_email);
        console.log();

        if (userInfo.data.email !== process.env.ADMIN_EMAIL) {
            console.warn('⚠️  WARNING: Token email doesnt match ADMIN_EMAIL!');
            console.warn(`   Token email: ${userInfo.data.email}`);
            console.warn(`   ADMIN_EMAIL: ${process.env.ADMIN_EMAIL}`);
        }

        console.log('✅ OAuth configuration is valid!\n');

    } catch (error) {
        console.error('❌ OAuth test failed:', error.message);
        if (error.response) {
            console.error('   Response:', error.response.data);
        }
        process.exit(1);
    }
}

testAuth();
