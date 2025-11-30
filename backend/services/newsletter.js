const { stories, subscribers, newsletters } = require('../database/firestore');
const fs = require('fs').promises;
const path = require('path');

/**
 * Generate and send newsletter
 */
async function generateAndSendNewsletter() {
  console.log('\n📰 Starting newsletter generation...');

  try {
    // 1. Fetch top stories from last 24 hours
    const storyList = await stories.getTopForNewsletter({ hours: 24, limit: 12 });

    console.log(`✓ Found ${storyList.length} stories for newsletter`);

    if (storyList.length === 0) {
      console.log('⚠️  No stories found for newsletter');
      return {
        recipientCount: 0,
        storyCount: 0,
        sentAt: new Date()
      };
    }

    // 2. Get active subscribers
    const subscriberList = await subscribers.getActive();
    console.log(`✓ Found ${subscriberList.length} active subscribers`);

    // 3. Split into test and regular users
    const testUsers = subscriberList.filter(s => s.is_test_user);
    const regularUsers = subscriberList.filter(s => !s.is_test_user);

    console.log(`  - Test users: ${testUsers.length}`);
    console.log(`  - Regular users: ${regularUsers.length}`);

    // 4. Generate and send newsletters
    const subject = `NewsWatch Daily Brief - ${new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}`;

    // Send to test users (with guidance)
    if (testUsers.length > 0) {
      const htmlWithGuidance = await generateNewsletterHTML(storyList, { includeGuidance: true });
      await sendBulkEmail({
        to: testUsers.map(s => s.email),
        subject,
        html: htmlWithGuidance
      });
      console.log(`✓ Sent newsletter (with guidance) to ${testUsers.length} test users`);
    }

    // Send to regular users (without guidance)
    if (regularUsers.length > 0) {
      const htmlWithoutGuidance = await generateNewsletterHTML(storyList, { includeGuidance: false });
      await sendBulkEmail({
        to: regularUsers.map(s => s.email),
        subject,
        html: htmlWithoutGuidance
      });
      console.log(`✓ Sent newsletter (no guidance) to ${regularUsers.length} regular users`);
    }

    if (subscriberList.length === 0) {
      console.log('⚠️  No active subscribers, skipping email send');
      // Generate preview with guidance for logging/debugging
      const html = await generateNewsletterHTML(storyList, { includeGuidance: true });
      console.log('📄 Newsletter HTML generated (would be sent to subscribers)');
    }

    // 5. Record newsletter send
    await newsletters.create({
      date: new Date(),
      subject,
      sent_at: new Date(),
      recipient_count: subscriberList.length,
      story_ids: storyList.map(s => s.id)
    });

    console.log('✅ Newsletter generation complete\n');

    return {
      recipientCount: subscriberList.length,
      storyCount: storyList.length,
      sentAt: new Date()
    };

  } catch (error) {
    console.error('❌ Newsletter generation failed:', error);
    throw error;
  }
}

/**
 * Generate newsletter HTML from stories
 */
async function generateNewsletterHTML(stories, options = {}) {
  const { includeGuidance = false } = options;
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Helper function to format dates (handles Firestore Timestamps)
  const formatDate = (dateValue, options = {}) => {
    if (!dateValue) return '';

    let dateObj;
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
      // Firestore Timestamp
      dateObj = dateValue.toDate();
    } else if (dateValue instanceof Date) {
      dateObj = dateValue;
    } else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
      dateObj = new Date(dateValue);
    } else {
      return '';
    }

    return dateObj.toLocaleTimeString('en-US', options);
  };

  // Get current AI guidance if requested
  let guidanceHTML = '';
  if (includeGuidance) {
    const guidanceService = require('./guidance-service');
    let currentGuidance = await guidanceService.getCurrentGuidance();

    // Fallback to default guidance if none exists
    if (!currentGuidance) {
      currentGuidance = `Prioritize valuation and analysis of enterprise SaaS (Software-as-a-Service) businesses with ARR > $10M, applying standard private equity analysis best practices (e.g., unit economics, retention/cohort analysis, revenue quality, growth sustainability, margin structure, and cash flow conversion).

Ignore consumer apps.

Maintain active coverage of:
- Crypto infrastructure businesses (e.g., exchanges, custody, compliance, developer tooling, infrastructure providers), but ignore analysis of coins/tokens themselves unless their characteristics have a direct, material impact on the underlying infrastructure businesses.
- Healthcare rollup strategies and platforms, with attention to acquisition economics, integration risk, payer mix, regulatory exposure, and scalability of the rollup model.`;
    }

    if (currentGuidance) {
      guidanceHTML = `
        <!-- AI Guidance Section -->
        <div style="border-top: 3px solid #667eea; padding: 20px 30px; background-color: #f0f4ff; font-family: Arial, sans-serif; font-size: 13px; color: #333; margin-top: 20px;">
          <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #667eea;">🤖 Current AI Instructions</h3>
          <div style="background-color: white; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea;">
            <p style="margin: 0; line-height: 1.6; white-space: pre-wrap;">${currentGuidance}</p>
          </div>
          <p style="margin: 15px 0 0 0; font-size: 11px; color: #666;">
            <em>Based on your feedback, here is what I'm currently focusing on.</em>
          </p>
        </div>
      `;
    }
  }

  const storiesHTML = stories.map((story, index) => {
    const peScore = story.pe_impact_score || 0;
    const peAnalysis = story.pe_analysis || {};

    // Determine arrow and color based on PE impact score
    let arrow, bgGradient;
    if (peScore >= 8) {
      arrow = '↗'; // Up 45 degrees (high impact)
      bgGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    } else if (peScore >= 6) {
      arrow = '↑'; // Straight up (moderate-high impact)
      bgGradient = 'linear-gradient(135deg, #4c9aff 0%, #5b7fc7 100%)';
    } else if (peScore >= 4) {
      arrow = '→'; // Level/right (neutral impact)
      bgGradient = 'linear-gradient(135deg, #999 0%, #777 100%)';
    } else if (peScore >= 2) {
      arrow = '↓'; // Straight down (low impact)
      bgGradient = 'linear-gradient(135deg, #888 0%, #666 100%)';
    } else {
      arrow = '↘'; // Down 45 degrees (very low impact)
      bgGradient = 'linear-gradient(135deg, #777 0%, #555 100%)';
    }

    return `
      <div style="margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #e0e0e0;">
        <h3 style="margin: 0 0 10px 0; font-size: 18px; line-height: 1.3;">
          <a href="${story.url || '#'}" style="color: #1a1a1a; text-decoration: none;">
            ${story.headline}
          </a>
        </h3>
        <div style="font-size: 12px; color: #999; margin-bottom: 10px; text-transform: uppercase;">
          ${story.source || 'Unknown Source'} ${story.published_at ? '| ' + formatDate(story.published_at, { hour: 'numeric', minute: '2-digit' }) : ''}
        </div>
        <div style="display: inline-block; background: ${bgGradient}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-bottom: 10px;">
          ${arrow} PE Impact: ${peScore}/10
        </div>
        <p style="margin: 10px 0; font-size: 15px; line-height: 1.6; color: #333;">
          ${story.summary || 'Click to read the full story...'}
        </p>
        ${peAnalysis.key_insights && peAnalysis.key_insights.length > 0 ? `
          <div style="background-color: #f0f4ff; border-left: 4px solid #667eea; padding: 12px; margin-top: 10px; font-size: 13px;">
            <strong style="color: #667eea;">PE Investor Insights:</strong>
            <ul style="margin: 8px 0 0 0; padding-left: 20px;">
              ${peAnalysis.key_insights.slice(0, 2).map(insight => `<li style="margin-bottom: 4px;">${insight}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>NewsWatch Daily Brief</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Georgia, 'Times New Roman', serif; background-color: #f5f5f0;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 0 30px rgba(0, 0, 0, 0.1);">
        <!-- Masthead -->
        <div style="border-bottom: 4px solid #1a1a1a; padding: 30px 30px 20px; text-align: center; background: linear-gradient(to bottom, #ffffff 0%, #f9f9f9 100%);">
          <div style="font-family: Arial, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 10px;">
            ${date}
          </div>
          <h1 style="font-size: 42px; font-weight: bold; letter-spacing: -2px; margin: 10px 0; text-transform: uppercase; color: #1a1a1a;">
            NewsWatch
          </h1>
          <div style="font-family: Arial, sans-serif; font-size: 12px; font-style: italic; color: #666; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; padding: 8px 0; margin-top: 10px;">
            Daily Software Economy Brief for Private Equity Investors
          </div>
        </div>

        <!-- Stories -->
        <div style="padding: 30px;">
          ${storiesHTML}
        </div>

        <!-- Footer -->
        <div style="border-top: 3px solid #1a1a1a; padding: 20px 30px; text-align: center; background-color: #f9f9f9; font-family: Arial, sans-serif; font-size: 12px; color: #666;">
          <p style="margin: 0 0 10px 0;">NewsWatch delivers curated software economy news daily.</p>
          <p style="margin: 0 0 10px 0; font-size: 13px; color: #333;">
            <strong>📧 Send Feedback:</strong> <em>Reply to this email with your thoughts to help improve the analysis!</em>
          </p>
          <p style="margin: 0; font-size: 11px; color: #999;">© ${new Date().getFullYear()} NewsWatch. All rights reserved.</p>
          <p style="margin: 10px 0 0 0; font-size: 11px;">
            <a href="#" style="color: #666; text-decoration: none;">Unsubscribe</a>
          </p>
        </div>
        
        ${guidanceHTML}
      </div>
    </body>
    </html>
  `;
}

/**
 * Send bulk email
 * Uses SendGrid if configured, Gmail if available, otherwise logs to console
 */
async function sendBulkEmail({ to, subject, html }) {
  if (process.env.SENDGRID_API_KEY) {
    // Use SendGrid
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to,
      from: process.env.EMAIL_FROM || 'newsletter@newswatch.local',
      subject,
      html
    };

    await sgMail.sendMultiple(msg);
    console.log(`✓ Sent via SendGrid to ${to.length} recipients`);

  } else if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN) {
    // Use Gmail API
    const { google } = require('googleapis');
    const OAuth2 = google.auth.OAuth2;

    const oauth2Client = new OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      "http://localhost:8081/oauth2callback"
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Gmail API requires emails to be sent individually
    const fromEmail = process.env.EMAIL_FROM || process.env.ADMIN_EMAIL || 'laird@popk.in';

    for (const recipient of to) {
      // Create email in RFC 2822 format
      const email = [
        `From: NewsWatch <${fromEmail}>`,
        `To: ${recipient}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        html
      ].join('\n');

      // Encode email in base64url format
      const encodedEmail = Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      try {
        await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: encodedEmail
          }
        });
        console.log(`✓ Sent to ${recipient}`);
      } catch (error) {
        console.error(`✗ Failed to send to ${recipient}:`, error.message);
        throw error;
      }
    }

    console.log(`✅ Sent via Gmail API to ${to.length} recipients`);

  } else {
    // Development mode - log to console and save to file
    console.log('\n📧 EMAIL PREVIEW (No email service configured)');
    console.log(`To: ${to.join(', ')}`);
    console.log(`Subject: ${subject}`);
    console.log(`HTML Length: ${html.length} characters`);

    // Save to file for preview
    const path = require('path');
    const fs = require('fs').promises;
    const outputPath = path.join(__dirname, '../../newsletter-preview.html');
    await fs.writeFile(outputPath, html);
    console.log(`✓ Newsletter saved to: ${outputPath}`);
    console.log('  Open this file in a browser to preview\n');
  }
}

module.exports = {
  generateAndSendNewsletter,
  generateNewsletterHTML,
  sendBulkEmail
};
