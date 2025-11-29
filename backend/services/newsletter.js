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
    const peAnalysis = story.pe_analysis || {};
    const score = peAnalysis.overall_pe_impact_score || 5;
    const impactIcon = getImpactIcon(score);

    return `
      <div class="story">
        <div class="headline">
          <a href="${story.url}">${story.headline}</a>
        </div>
        <div class="meta">${story.source} • ${new Date(story.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        
        ${peAnalysis.key_insights && peAnalysis.key_insights.length > 0 ? `
          <div class="impact-row">
            <div class="icon-wrapper" style="background-color: ${impactIcon.bgColor}; color: ${impactIcon.color};">
              ${impactIcon.svg}
            </div>
            <div>
              <span class="impact-label">M&A Impact:</span>
              ${convertMarkdownToHTML(peAnalysis.key_insights[0])}
            </div>
          </div>
        ` : ''}

        <div class="summary">
          ${story.summary}
        </div>
      </div>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>NewsWatch Daily Brief</title>
      <style>
        /* Base Styles */
        body { font-family: 'Georgia', serif; background-color: #f5f5f7; margin: 0; padding: 0; color: #1a1a1a; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background-color: #1a1a1a; color: #ffffff; padding: 30px 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 300; letter-spacing: 1px; }
        .date { color: #9ca3af; font-size: 14px; margin-top: 8px; text-transform: uppercase; letter-spacing: 1px; }
        
        /* Story Card */
        .story { padding: 24px 20px; border-bottom: 1px solid #e5e7eb; }
        .headline { font-size: 22px; font-weight: 700; margin: 0 0 8px 0; line-height: 1.3; }
        .headline a { color: #1a1a1a; text-decoration: none; }
        .headline a:hover { color: #2563eb; }
        .meta { font-family: Arial, sans-serif; font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 16px; }
        .summary { font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 16px; }
        
        /* Impact Section */
        .impact-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background-color: #f9fafb;
          padding: 12px;
          border-radius: 6px;
          font-family: Arial, sans-serif;
          font-size: 14px;
          line-height: 1.5;
          color: #374151;
          margin-bottom: 16px;
        }
        
        .icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: -2px;
        }
        
        .impact-label { font-weight: 700; color: #111; margin-right: 4px; }
        
        /* Footer */
        .footer { background-color: #f5f5f7; padding: 30px 20px; text-align: center; font-size: 12px; color: #6b7280; font-family: Arial, sans-serif; }
        .footer a { color: #6b7280; text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>NewsWatch</h1>
          <div class="date">${date}</div>
        </div>

        ${storiesHTML}

        <div class="footer">
          <p>Sent to ${stories.length} subscribers</p>
          <p>
            <a href="#">Unsubscribe</a> • <a href="#">Manage Preferences</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return html;
}

/**
 * Get impact icon and colors based on score (1-10)
 */
function getImpactIcon(score) {
  // Strong Negative (1-2)
  if (score <= 2) {
    return {
      bgColor: '#fee2e2', // Red 100
      color: '#b91c1c',   // Red 700
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>` // Down
    };
  }
  // Weak Negative (3-4)
  else if (score <= 4) {
    return {
      bgColor: '#fef2f2', // Red 50
      color: '#dc2626',   // Red 600
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><line x1="7" y1="7" x2="17" y2="17"></line><polyline points="17 7 17 17 7 17"></polyline></svg>` // Down-Right
    };
  }
  // Neutral (5-6)
  else if (score <= 6) {
    return {
      bgColor: '#f3f4f6', // Gray 100
      color: '#6b7280',   // Gray 500
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>` // Right
    };
  }
  // Weak Positive (7-8)
  else if (score <= 8) {
    return {
      bgColor: '#f0fdf4', // Green 50
      color: '#16a34a',   // Green 600
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>` // Up-Right
    };
  }
  // Strong Positive (9-10)
  else {
    return {
      bgColor: '#ecfdf5', // Emerald 50
      color: '#059669',   // Emerald 600
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>` // Up
    };
  }
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
