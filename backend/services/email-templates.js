/**
 * Email Templates
 * Reusable email templates for NewsWatch
 */

/**
 * Generate a feedback acknowledgment email
 * @param {Object} options - Template options
 * @param {string} options.userName - User's name (extracted from email)
 * @param {string} options.userGuidance - User's text-based AI guidance
 * @param {Object} options.preferences - User's preference data
 * @param {Array} options.preferences.topSources - Top sources with positive weights
 * @param {Array} options.preferences.topCategories - Top categories with positive weights
 * @returns {Object} Email object with subject and html
 */
function generateFeedbackAcknowledgmentEmail({ userName, userGuidance, preferences }) {
    const { topSources = [], topCategories = [] } = preferences || {};

    // Format user guidance
    const guidanceHTML = userGuidance
        ? `<div style="background: #f0f8ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #4a90e2;">
            <h3 style="color: #4a90e2; font-size: 16px; margin-top: 0; margin-bottom: 10px;">🎯 Your Personalization</h3>
            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #333; font-style: italic;">"${userGuidance}"</p>
            <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">This guidance is used by AI to personalize your news selection.</p>
           </div>`
        : '';

    // Format sources list
    const sourcesHTML = topSources.length > 0
        ? `<ul style="margin: 10px 0; padding-left: 20px;">${topSources.map(s => `<li>${s.name} (${s.weight > 0 ? '+' : ''}${s.weight})</li>`).join('')}</ul>`
        : `<p style="margin: 10px 0; color: #666;">No source preferences yet. Keep voting to build your profile!</p>`;

    // Format categories list
    const categoriesHTML = topCategories.length > 0
        ? `<ul style="margin: 10px 0; padding-left: 20px;">${topCategories.map(c => `<li>${c.name} (${c.weight > 0 ? '+' : ''}${c.weight})</li>`).join('')}</ul>`
        : `<p style="margin: 10px 0; color: #666;">No category preferences yet. Keep voting to build your profile!</p>`;

    const subject = "Thanks for your feedback!";

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">NewsWatch</h1>
    </div>
    
    <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="font-size: 18px; margin-top: 0;">Hi ${userName},</p>
        
        <p>Thanks for taking the time to share your thoughts with NewsWatch!</p>
        
        <p>Your feedback has been recorded and will help us tailor future recommendations to your interests.</p>
        
        ${guidanceHTML}
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #667eea;">
            <h2 style="margin-top: 0; color: #667eea; font-size: 20px;">Your Voting Preferences</h2>
            
            <h3 style="color: #555; font-size: 16px; margin-bottom: 5px;">📰 Sources you like:</h3>
            ${sourcesHTML}
            
            <h3 style="color: #555; font-size: 16px; margin-bottom: 5px; margin-top: 20px;">🏢 Categories you like:</h3>
            ${categoriesHTML}
        </div>
        
        <p style="color: #666; font-size: 14px;">
            <em>Keep the feedback coming! Every 👍 or 👎 helps us understand what matters to you.</em>
        </p>
        
        <p style="margin-bottom: 0;">Best,<br><strong>NewsWatch Team</strong></p>
    </div>
    
    <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
        <p>NewsWatch - Curated news for PE investors</p>
    </div>
    
</body>
</html>
    `.trim();

    return { subject, html };
}

/**
 * Extract user name from email address
 * @param {string} email - Email address (may be in "Name <email>" format)
 * @returns {string} User's name or email username
 */
function extractUserName(email) {
    if (!email) return 'there';

    // Check for "Name <email>" format
    const nameMatch = email.match(/^([^<]+)\s*</);
    if (nameMatch) {
        return nameMatch[1].trim();
    }

    // Extract username from email address
    const emailMatch = email.match(/^([^@]+)/);
    if (emailMatch) {
        // Capitalize first letter
        const username = emailMatch[1];
        return username.charAt(0).toUpperCase() + username.slice(1);
    }

    return 'there';
}

module.exports = {
    generateFeedbackAcknowledgmentEmail,
    extractUserName
};
