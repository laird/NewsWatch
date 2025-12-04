const { stories, subscribers, newsletters } = require('../database/firestore');
const scoring = require('./scoring');
const fs = require('fs').promises;
const path = require('path');

/**
 * Generate and send newsletter
 */
async function generateAndSendNewsletter() {
  console.log('\n📰 Starting newsletter generation...');

  try {
    // 1. Fetch candidate stories (fetch more to allow for filtering/scoring)
    const candidateStories = await stories.getTopForNewsletter({ hours: 24, limit: 50 });

    console.log(`✓ Found ${candidateStories.length} candidate stories for newsletter`);

    if (candidateStories.length === 0) {
      console.log('⚠️  No stories found for newsletter');
      return {
        recipientCount: 0,
        storyCount: 0,
        sentAt: new Date()
      };
    }

    // 2. Score for Community (Base + Community Feedback)
    const communityStories = await scoring.scoreStoriesForCommunity(candidateStories);

    // Sort by community score
    communityStories.sort((a, b) => (b.community_score || b.pe_impact_score) - (a.community_score || a.pe_impact_score));

    // Select top 12 for Community Top Picks
    const communityTopPicks = communityStories.slice(0, 12);

    // 3. Get active subscribers
    const subscriberList = await subscribers.getActive();
    console.log(`✓ Found ${subscriberList.length} active subscribers`);

    // 4. Generate and send newsletters
    const subject = `NewsWatch Daily Brief - ${new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}`;

    // Helper to process user list
    const processUsers = async (users, isTest = false) => {
      for (const user of users) {
        try {
          // Score for User
          const userStories = await scoring.scoreStoriesForUser(user, candidateStories);

          // Sort by personal score
          userStories.sort((a, b) => (b.personal_score || 0) - (a.personal_score || 0));

          // Select top personal recommendations that are NOT in community top picks
          const communityIds = new Set(communityTopPicks.map(s => s.id));
          const personalRecs = userStories
            .filter(s => !communityIds.has(s.id))
            .slice(0, 5); // Top 5 personal recs

          // Generate HTML with sections
          const html = await generateNewsletterHTML({
            communityStories: communityTopPicks,
            personalStories: personalRecs,
            user
          }, { includeGuidance: isTest });

          await sendBulkEmail({
            to: [user.email],
            subject,
            html
          });
          console.log(`✓ Sent personalized newsletter to ${user.email}`);
        } catch (err) {
          console.error(`✗ Failed to send to ${user.email}:`, err.message);
        }
      }
    };

    // Split into test and regular users
    const testUsers = subscriberList.filter(s => s.is_test_user);
    const regularUsers = subscriberList.filter(s => !s.is_test_user);

    if (testUsers.length > 0) {
      await processUsers(testUsers, true);
    }

    if (regularUsers.length > 0) {
      await processUsers(regularUsers, false);
    }

    // 5. Save Archive (Community Version Only)
    // We generate a generic version using just the community top picks
    const archiveHtml = await generateNewsletterHTML({
      communityStories: communityTopPicks,
      personalStories: []
    }, { includeGuidance: false }); // Archive typically doesn't show test guidance? Or maybe it should? 
    // Requirement: "Only the community news should be in the archive." -> personalStories: []

    if (subscriberList.length === 0) {
      console.log('⚠️  No active subscribers, skipping email send');
      // Save preview
      const path = require('path');
      const outputPath = path.join(__dirname, '../../newsletter-preview.html');
      await fs.writeFile(outputPath, archiveHtml);
      console.log(`✓ Newsletter preview saved to: ${outputPath}`);
    }

    // 6. Record newsletter send
    await newsletters.create({
      date: new Date(),
      subject,
      sent_at: new Date(),
      recipient_count: subscriberList.length,
      story_ids: communityTopPicks.map(s => s.id)
    });

    console.log('✅ Newsletter generation complete\n');

    return {
      recipientCount: subscriberList.length,
      storyCount: communityTopPicks.length,
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
/**
 * Generate newsletter HTML from stories
 * Supports sections: Community Top Picks and Personal Recommendations
 */
async function generateNewsletterHTML(data, options = {}) {
  // Handle legacy call signature (stories array)
  let communityStories = [];
  let personalStories = [];
  let user = null;

  if (Array.isArray(data)) {
    communityStories = data;
  } else {
    communityStories = data.communityStories || [];
    personalStories = data.personalStories || [];
    user = data.user;
  }

  const { includeGuidance = false, tokenCost = 0 } = options;
  const tokenTracker = require('../utils/token-tracker');

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
        <div style="border: 3px solid #1a1a1a; padding: 20px; background-color: #fffef0; font-family: Georgia, serif; margin-top: 30px;">
          <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #1a1a1a; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #1a1a1a; padding-bottom: 8px;">📰 Editor's Guidance</h3>
          <div style="background-color: white; padding: 15px; border: 1px solid #ddd;">
            <p style="margin: 0; line-height: 1.8; white-space: pre-wrap; font-size: 13px; color: #333;">${currentGuidance}</p>
          </div>
          <p style="margin: 15px 0 0 0; font-size: 11px; color: #666; font-style: italic; font-family: Arial, sans-serif;">
            Based on your feedback, this is what we're currently focusing on.
          </p>
        </div>
      `;
    }
  }

  // Format token cost for banner
  const costDisplay = tokenTracker.formatTokenCost(tokenCost || tokenTracker.getTokenCount());

  // Helper to render a list of stories
  const renderStories = (storyList) => {
    if (!storyList || storyList.length === 0) return '';

    return storyList.map((story, index) => {
      const peScore = story.pe_impact_score || 0;
      const peAnalysis = story.pe_analysis || {};
      const thumbsUpCount = story.thumbs_up_count || 0;
      const thumbsDownCount = story.thumbs_down_count || 0;

      // Extract all tags: categories, location, companies
      const categories = peAnalysis.categories || peAnalysis.sectors || [];
      const location = peAnalysis.location || '';
      const companies = peAnalysis.companies || [];

      // Helper function to clean and shorten tag text
      const cleanTag = (text) => {
        if (!text) return '';
        // Remove markdown bold formatting
        text = text.replace(/\*\*/g, '').trim();

        // Shorten common long category names
        const shortenings = {
          'M&A/Acquisition': 'M&A',
          'Funding Round': 'Funding',
          'IPO/Public Markets': 'IPO',
          'Product Launch': 'Launch',
          'Regulatory/Policy': 'Regulatory',
          'Cloud Computing': 'Cloud',
          'Blockchain/Crypto': 'Crypto',
          'DevOps/Infrastructure': 'DevOps',
          'Data/Analytics': 'Data',
          'Developer Tools': 'Dev Tools'
        };

        return shortenings[text] || text;
      };

      // Build tag HTML for all dimensions
      const allTags = [];
      categories.forEach(cat => {
        const cleaned = cleanTag(cat);
        if (cleaned) allTags.push({ text: cleaned, type: 'category' });
      });
      if (location && location !== 'Unspecified' && location !== 'Global') {
        const cleaned = cleanTag(location);
        if (cleaned) allTags.push({ text: cleaned, type: 'location' });
      }
      companies.forEach(company => {
        const cleaned = cleanTag(company);
        if (cleaned) allTags.push({ text: cleaned, type: 'company' });
      });

      const tagsHTML = allTags.map(tag =>
        `<span style="display: inline-block; background-color: #eee; color: #555; font-size: 10px; padding: 2px 6px; border-radius: 3px; margin-left: 4px; margin-bottom: 4px; vertical-align: middle; text-transform: uppercase; letter-spacing: 0.5px;">${tag.text}</span>`
      ).join('');

      // Format insights as italicized bullet points
      const insightsHTML = peAnalysis.key_insights && peAnalysis.key_insights.length > 0 ? `
        <ul style="margin: 10px 0 10px 20px; padding: 0; list-style-type: disc; font-size: 13px; color: #444; line-height: 1.6;">
          ${peAnalysis.key_insights.slice(0, 2).map(insight => `<li><i>${insight}</i></li>`).join('')}
        </ul>
      ` : '';

      // Display all sources if story has multiple sources
      let sourcesHTML = '';
      if (story.sources && Array.isArray(story.sources) && story.sources.length > 0) {
        // Story has been merged from multiple sources
        const sourcesList = story.sources.map(src => {
          const srcName = src.name || 'Unknown Source';
          const srcUrl = src.url || '#';
          const srcDate = src.published_at ? formatDate(src.published_at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
          return `<a href="${srcUrl}" style="color: #666; text-decoration: none;">${srcName}</a>${srcDate ? ` (${srcDate})` : ''}`;
        }).join(' • ');

        sourcesHTML = `
          <div style="font-size: 11px; color: #666; margin-bottom: 8px; font-family: Arial, sans-serif;">
            ${story.sources.length > 1 ? `<strong>${story.sources.length} sources:</strong> ` : ''}${sourcesList}
          </div>
        `;
      } else {
        // Single source story
        const sourceHTML = story.url ?
          `<a href="${story.url}" style="color: #666; text-decoration: none; text-transform: uppercase;">${story.source || 'Unknown Source'}</a>` :
          `${story.source || 'Unknown Source'}`;

        sourcesHTML = `
          <div style="font-size: 11px; color: #666; margin-bottom: 8px; font-family: Arial, sans-serif;">
            ${sourceHTML} ${story.published_at ? '| ' + formatDate(story.published_at, { hour: 'numeric', minute: '2-digit' }) : ''}
          </div>
        `;
      }

      return `
        <div class="story-item" style="break-inside: avoid; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 2px solid #ddd;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; line-height: 1.3; font-weight: bold;">
            <a href="${story.url || '#'}" style="color: #1a1a1a; text-decoration: none;">
              ${story.headline}
            </a>
          </h3>
          <div style="margin: 4px 0 8px 0;">
            ${tagsHTML}
          </div>
          
          <!-- Thumbs up/down -->
          <div style="margin: 8px 0; font-size: 18px;">
            <span class="thumb-up" style="cursor: pointer; margin-right: 12px; display: inline-flex; align-items: center; gap: 4px;" title="More like this" onclick="handleThumb('${story.id}', 'up', event)">
              <svg width="16" height="16" viewBox="0 0 24 24" style="fill: #333;"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1.91l-.01-.01L23 10z"/></svg>
              ${thumbsUpCount > 0 ? `<small style="font-size: 11px; color: #666;">${thumbsUpCount}</small>` : ''}
            </span>
            <span class="thumb-down" style="cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Less like this" onclick="handleThumb('${story.id}', 'down', event)">
              <svg width="16" height="16" viewBox="0 0 24 24" style="fill: #333;"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v1.91l.01.01L1 14c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>
              ${thumbsDownCount > 0 ? `<small style="font-size: 11px; color: #666;">${thumbsDownCount}</small>` : ''}
            </span>
          </div>
          
          <!-- Source(s) and date -->${sourcesHTML}
          
          ${insightsHTML}
          
          <!-- Teaser/Summary -->
          <p style="margin: 8px 0 0 0; font-size: 14px; line-height: 1.6; color: #333;">
            ${story.summary || 'Click to read the full story...'}
          </p>
        </div>
      `;
    }).join('');
  };

  const communityHTML = renderStories(communityStories);
  const personalHTML = renderStories(personalStories);

  let contentHTML = '';

  if (personalStories.length > 0) {
    contentHTML += `
        <div style="margin-bottom: 40px;">
            <h2 style="font-size: 18px; text-transform: uppercase; border-bottom: 2px solid #1a1a1a; padding-bottom: 10px; margin-bottom: 20px;">
                Recommended for You
            </h2>
            <div class="stories-grid">
                ${personalHTML}
            </div>
        </div>
      `;
  }

  if (communityStories.length > 0) {
    contentHTML += `
        <div>
            <h2 style="font-size: 18px; text-transform: uppercase; border-bottom: 2px solid #1a1a1a; padding-bottom: 10px; margin-bottom: 20px;">
                Community Top Picks
            </h2>
            <div class="stories-grid">
                ${communityHTML}
            </div>
        </div>
      `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>NewsWatch Daily Brief</title>
      <style>
        /* Responsive column layout */
        @media (min-width: 1400px) {
          .stories-grid { column-count: 6; }
        }
        @media (min-width: 1100px) and (max-width: 1399px) {
          .stories-grid { column-count: 5; }
        }
        @media (min-width: 900px) and (max-width: 1099px) {
          .stories-grid { column-count: 4; }
        }
        @media (min-width: 700px) and (max-width: 899px) {
          .stories-grid { column-count: 3; }
        }
        @media (min-width: 500px) and (max-width: 699px) {
          .stories-grid { column-count: 2; }
        }
        @media (max-width: 499px) {
          .stories-grid { column-count: 1; }
        }
        .stories-grid {
          column-gap: 20px;
          column-rule: 1px solid #ddd;
        }
        /* Active vote button styling */
        .thumb-up[data-active="true"] svg,
        .thumb-down[data-active="true"] svg {
          fill: #0066cc !important;
        }
      </style>
      <script>
        // Vote handler for newsletter
        async function handleThumb(storyId, rating, event) {
          if (event) {
            event.stopPropagation();
            event.preventDefault();
          }
          
          const clickedBtn = event.currentTarget;
          const container = clickedBtn.parentElement;
          const thumbUpBtn = container.querySelector('.thumb-up');
          const thumbDownBtn = container.querySelector('.thumb-down');
          
          // Initialize feedback data
          if (!window.feedbackData) {
            window.feedbackData = {};
          }
          
          if (!window.feedbackData[storyId]) {
            window.feedbackData[storyId] = {
              rating: null,
              timestamp: new Date().toISOString()
            };
          }
          
          // Toggle the clicked button
          const wasActive = clickedBtn.dataset.active === 'true';
          
          // Reset both buttons
          thumbUpBtn.dataset.active = 'false';
          thumbDownBtn.dataset.active = 'false';
          
          if (!wasActive) {
            // Activate the clicked button
            clickedBtn.dataset.active = 'true';
            window.feedbackData[storyId].rating = rating;
            
            // Send to API
            try {
              const response = await fetch('https://newswatch.popk.in/api/feedback', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  storyId: storyId,
                  rating: rating
                })
              });
              
              if (response.ok) {
                console.log('Vote recorded:', rating, 'for story', storyId);
              } else {
                console.error('Failed to record vote:', await response.text());
              }
            } catch (err) {
              console.error('Error sending vote:', err);
            }
          } else {
            // Deactivate
            window.feedbackData[storyId].rating = null;
          }
          
          // Store in localStorage
          localStorage.setItem('newswatch_feedback', JSON.stringify(window.feedbackData));
        }
        
        // Load feedback state on page load
        function loadFeedbackState() {
          const stored = localStorage.getItem('newswatch_feedback');
          if (stored) {
            window.feedbackData = JSON.parse(stored);
            
            // Restore button states
            Object.keys(window.feedbackData).forEach(storyId => {
              const feedback = window.feedbackData[storyId];
              if (feedback.rating) {
                const buttons = document.querySelectorAll('.thumb-up, .thumb-down');
                buttons.forEach(btn => {
                  if (btn.onclick && btn.onclick.toString().includes(storyId) && btn.className.includes(feedback.rating)) {
                    btn.dataset.active = 'true';
                  }
                });
              }
            });
          }
        }
        
        // Initialize on page load
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', loadFeedbackState);
        } else {
          loadFeedbackState();
        }
      </script>
    </head>
    <body style="margin: 0; padding: 0; font-family: Georgia, 'Times New Roman', serif; background-color: #f5f5f0;">
      <div style="max-width: 1200px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);">
        
        <!-- Banner / Masthead -->
        <div style="border-bottom: 4px solid #1a1a1a; padding: 20px 30px; background: #ffffff;">
          <!-- Top line: Date | Title | Cost -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; flex-wrap: wrap;">
            <div style="font-family: Arial, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; min-width: 150px;">
              ${date}
            </div>
            <div style="flex: 1; text-align: center; min-width: 200px;">
              <h1 style="font-size: 48px; font-weight: bold; letter-spacing: -2px; margin: 0; text-transform: uppercase; color: #1a1a1a;">
                NEWSWATCH
              </h1>
            </div>
            <div style="font-family: Arial, sans-serif; font-size: 11px; text-align: right; color: #666; min-width: 150px;">
              PRICE: ${costDisplay}
            </div>
          </div>
          
          <!-- Subtitle -->
          <div style="font-family: Arial, sans-serif; font-size: 12px; font-style: italic; color: #666; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; padding: 8px 0; text-align: center;">
            Daily Software Economy Brief for Private Equity Investors
          </div>
        </div>

        <!-- Stories in newspaper columns -->
        <div style="padding: 30px;">
          ${contentHTML}
        </div>

        <!-- Footer -->
        <div style="border-top: 3px solid #1a1a1a; padding: 20px 30px; background-color: #f9f9f9; font-family: Arial, sans-serif; font-size: 12px; color: #666;">
          <p style="margin: 0 0 10px 0; text-align: center;">NewsWatch delivers curated software economy news daily.</p>
          <p style="margin: 0 0 10px 0; font-size: 13px; color: #333; text-align: center;">
            <strong>📧 Share Your Thoughts:</strong> <em>Reply to this email with suggestions on sources, story coverage, or anything else you'd like to see!</em>
          </p>
          <div style="text-align: center; margin-top: 15px; font-size: 11px; color: #999;">
            <p style="margin: 5px 0;">© ${new Date().getFullYear()} NewsWatch. All rights reserved.</p>
            <p style="margin: 5px 0;">
              <a href="#" style="color: #666; text-decoration: none;">Unsubscribe</a>
            </p>
          </div>
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

/**
 * Generate and send newsletter to test users only
 * Used by admin panel for testing
 */
async function generateAndSendTestNewsletter() {
  console.log('\n📧 Starting TEST newsletter generation...');

  try {
    // 1. Fetch top stories from last 24 hours
    const storyList = await stories.getTopForNewsletter({ hours: 24, limit: 12 });

    console.log(`✓ Found ${storyList.length} stories for newsletter`);

    if (storyList.length === 0) {
      throw new Error('No stories found for newsletter');
    }

    // 2. Get test subscribers only
    const subscriberList = await subscribers.getActive();
    const testUsers = subscriberList.filter(s => s.is_test_user);

    console.log(`✓ Found ${testUsers.length} test users`);

    if (testUsers.length === 0) {
      throw new Error('No test users found');
    }

    // 3. Generate newsletter with guidance
    // 3. Generate newsletter with guidance (Community only for test/archive)
    // For test newsletter, we might want to simulate a user? 
    // Or just show the community version.
    // Let's show community version for now as the "Test" output.
    const html = await generateNewsletterHTML({
      communityStories: storyList,
      personalStories: []
    }, { includeGuidance: true });

    // 4. Save to archive
    const archiveResult = await saveNewsletterToArchive(html, {
      isTest: true,
      recipientCount: testUsers.length,
      storyCount: storyList.length
    });

    // 5. Send to test users
    const subject = `NewsWatch Daily Brief - ${new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })} [TEST]`;

    await sendBulkEmail({
      to: testUsers.map(s => s.email),
      subject,
      html
    });

    console.log(`✓ Sent test newsletter to ${testUsers.length} test users`);

    // 6. Record newsletter send
    await newsletters.create({
      date: new Date(),
      subject,
      sent_at: new Date(),
      recipient_count: testUsers.length,
      story_ids: storyList.map(s => s.id),
      is_test: true,
      archive_url: archiveResult.publicUrl
    });

    console.log('✅ Test newsletter generation complete\n');

    return {
      recipientCount: testUsers.length,
      storyCount: storyList.length,
      archiveUrl: archiveResult.publicUrl,
      archivePath: archiveResult.filePath
    };

  } catch (error) {
    console.error('❌ Test newsletter generation failed:', error);
    throw error;
  }
}

/**
 * Save newsletter to archive
 * Saves to public/editions/ and uploads to GCS
 */
async function saveNewsletterToArchive(html, metadata = {}) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, ''); // HHmmss
  const filename = `${dateStr}-${timeStr}.html`;

  // Local path
  const editionsDir = path.join(__dirname, '../../public/editions');
  const filePath = path.join(editionsDir, filename);

  try {
    // Ensure editions directory exists
    await fs.mkdir(editionsDir, { recursive: true });

    // Save HTML file
    await fs.writeFile(filePath, html, 'utf8');
    console.log(`✓ Saved newsletter to ${filePath}`);

    // Upload to GCS if configured
    let publicUrl = `/editions/${filename}`; // Local fallback URL

    if (process.env.GCP_PROJECT_ID && process.env.NODE_ENV === 'production') {
      const { Storage } = require('@google-cloud/storage');
      const storage = new Storage();
      const bucketName = `${process.env.GCP_PROJECT_ID}-public`;
      const bucket = storage.bucket(bucketName);

      const destination = `editions/${filename}`;
      await bucket.upload(filePath, {
        destination,
        metadata: {
          contentType: 'text/html',
          cacheControl: 'public, max-age=3600',
        },
      });

      publicUrl = `https://storage.googleapis.com/${bucketName}/${destination}`;
      console.log(`✓ Uploaded to GCS: ${publicUrl}`);
    }

    // Update index.json
    const indexPath = path.join(editionsDir, 'index.json');
    let index = [];
    try {
      const indexContent = await fs.readFile(indexPath, 'utf8');
      index = JSON.parse(indexContent);
    } catch (err) {
      // File doesn't exist yet, start fresh
      console.log('Creating new index.json');
    }

    index.unshift({
      filename,
      date: now.toISOString(),
      url: publicUrl,
      ...metadata
    });

    // Keep only last 100 entries
    index = index.slice(0, 100);

    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
    console.log('✓ Updated index.json');

    // Upload index.json to GCS
    if (process.env.GCP_PROJECT_ID && process.env.NODE_ENV === 'production') {
      const { Storage } = require('@google-cloud/storage');
      const storage = new Storage();
      const bucketName = `${process.env.GCP_PROJECT_ID}-public`;
      const bucket = storage.bucket(bucketName);

      await bucket.upload(indexPath, {
        destination: 'editions/index.json',
        metadata: {
          contentType: 'application/json',
          cacheControl: 'public, max-age=3600',
        },
      });
      console.log('✓ Uploaded index.json to GCS');
    }

    return {
      filePath,
      publicUrl,
      filename
    };

  } catch (error) {
    console.error('❌ Failed to save newsletter to archive:', error);
    throw error;
  }
}

module.exports = {
  generateAndSendNewsletter,
  generateAndSendTestNewsletter,
  generateNewsletterHTML,
  sendBulkEmail,
  saveNewsletterToArchive
};
