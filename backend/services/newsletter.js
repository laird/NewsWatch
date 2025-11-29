const db = require('../database/db');
const fs = require('fs').promises;
const path = require('path');

/**
 * Convert markdown to HTML for email rendering
 * Handles common markdown patterns: bold, italic, code, line breaks
 */
function convertMarkdownToHTML(text) {
  if (!text) return text;

  return text
    // Bold: **text** or __text__ -> <strong>text</strong>
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic: *text* or _text_ -> <em>text</em>
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Inline code: `text` -> <code>text</code>
    .replace(/`(.+?)`/g, '<code style="background-color: #f4f4f4; padding: 2px 4px; border-radius: 3px; font-family: monospace;">$1</code>')
    // Line breaks: \n -> <br>
    .replace(/\n/g, '<br>');
}

/**
 * Generate and send newsletter
 */
async function generateAndSendNewsletter() {
  console.log('\n📰 Starting newsletter generation...');

  try {
    // 1. Fetch top stories from last 24 hours
    const storiesResult = await db.query(`
      SELECT id, headline, source, author, url, summary, published_at,
             pe_impact_score, pe_analysis, relevance_score
      FROM stories
      WHERE ingested_at > NOW() - INTERVAL '24 hours'
      ORDER BY pe_impact_score DESC NULLS LAST, relevance_score DESC NULLS LAST
      LIMIT 12
    `);

    const stories = storiesResult.rows;
    console.log(`✓ Found ${stories.length} stories for newsletter`);

    if (stories.length === 0) {
      console.log('⚠️  No stories found for newsletter');
      return {
        recipientCount: 0,
        storyCount: 0,
        sentAt: new Date()
      };
    }

    // 2. Generate newsletter HTML
    const html = await generateNewsletterHTML(stories);

    // 3. Get active subscribers
    const subscribersResult = await db.query(
      'SELECT email, name FROM subscribers WHERE is_active = true'
    );

    const subscribers = subscribersResult.rows;
    console.log(`✓ Found ${subscribers.length} active subscribers`);

    // 4. Send emails
    const subject = `NewsWatch Daily Brief - ${new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}`;

    if (subscribers.length > 0) {
      await sendBulkEmail({
        to: subscribers.map(s => s.email),
        subject,
        html
      });
      console.log(`✓ Newsletter sent to ${subscribers.length} subscribers`);
    } else {
      console.log('⚠️  No active subscribers, skipping email send');
      console.log('📄 Newsletter HTML generated (would be sent to subscribers)');
    }

    // 5. Record newsletter send
    await db.query(`
      INSERT INTO newsletters (date, subject, sent_at, recipient_count, story_ids)
      VALUES ($1, $2, NOW(), $3, $4)
    `, [
      new Date(),
      subject,
      subscribers.length,
      stories.map(s => s.id)
    ]);

    console.log('✅ Newsletter generation complete\n');

    return {
      recipientCount: subscribers.length,
      storyCount: stories.length,
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
async function generateNewsletterHTML(stories) {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const storiesHTML = stories.map((story, index) => {
    const peScore = story.pe_impact_score || 0;
    const peAnalysis = story.pe_analysis || {};

    return `
      <div style="margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #e0e0e0;">
        <h3 style="margin: 0 0 10px 0; font-size: 18px; line-height: 1.3;">
          <a href="${story.url || '#'}" style="color: #1a1a1a; text-decoration: none;">
            ${story.headline}
          </a>
        </h3>
        <div style="font-size: 12px; color: #999; margin-bottom: 10px; text-transform: uppercase;">
          ${story.source || 'Unknown Source'} ${story.published_at ? '| ' + new Date(story.published_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}
        </div>
        ${peScore >= 7 ? `
          <div style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-bottom: 10px;">
            📊 PE Impact: ${peScore}/10
          </div>
        ` : ''}
        <p style="margin: 10px 0; font-size: 15px; line-height: 1.6; color: #333;">
          ${story.summary || 'Click to read the full story...'}
        </p>
        ${peAnalysis.key_insights && peAnalysis.key_insights.length > 0 ? `
          <div style="background-color: #f0f4ff; border-left: 4px solid #667eea; padding: 12px; margin-top: 10px; font-size: 13px;">
            <strong style="color: #667eea;">PE Investor Insights:</strong>
            <ul style="margin: 8px 0 0 0; padding-left: 20px;">
              ${peAnalysis.key_insights.slice(0, 2).map(insight => `<li style="margin-bottom: 4px;">${convertMarkdownToHTML(insight)}</li>`).join('')}
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
          <p style="margin: 0; font-size: 11px; color: #999;">© ${new Date().getFullYear()} NewsWatch. All rights reserved.</p>
          <p style="margin: 10px 0 0 0; font-size: 11px;">
            <a href="#" style="color: #666; text-decoration: none;">Unsubscribe</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send bulk email
 * Uses email service if configured, otherwise logs to console
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

  } else {
    // Development mode - log to console and save to file
    console.log('\n📧 EMAIL PREVIEW (No email service configured)');
    console.log(`To: ${to.join(', ')}`);
    console.log(`Subject: ${subject}`);
    console.log(`HTML Length: ${html.length} characters`);

    // Save to file for preview
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
