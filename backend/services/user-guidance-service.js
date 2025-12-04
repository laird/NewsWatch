const { getDoc, setDoc, updateDoc, serverTimestamp } = require('../database/db-firestore');
const aiService = require('./ai-service');

const DEFAULT_USER_GUIDANCE = `Focus on software and technology stories relevant to private equity analysis.`;

/**
 * Service to manage Per-User Feedback Guidance
 * Each user has their own guidance built from their feedback text
 */
class UserGuidanceService {

    /**
     * Get a user's current guidance
     * @param {string} email - User's email address
     * @returns {Promise<string>} User's guidance text
     */
    async getUserGuidance(email) {
        try {
            const { queryDocs } = require('../database/db-firestore');
            const users = await queryDocs('subscribers', [
                { field: 'email', op: '==', value: email }
            ]);

            if (users.length > 0 && users[0].user_guidance) {
                return users[0].user_guidance;
            }

            return DEFAULT_USER_GUIDANCE;
        } catch (error) {
            console.error(`Error fetching user guidance for ${email}:`, error);
            return DEFAULT_USER_GUIDANCE;
        }
    }

    /**
     * Update a user's guidance by merging new feedback
     * @param {string} email - User's email address
     * @param {string} newFeedbackText - New feedback to integrate
     * @returns {Promise<string>} Updated guidance text
     */
    async updateUserGuidance(email, newFeedbackText) {
        console.log(`🧠 Updating guidance for ${email}...`);

        try {
            const currentGuidance = await this.getUserGuidance(email);

            const prompt = `
You are managing personalized content guidance for a news reader.

CURRENT USER GUIDANCE:
"""
${currentGuidance}
"""

NEW USER FEEDBACK:
"""
${newFeedbackText}
"""

TASK:
1. Analyze the new feedback to understand the user's interests and preferences.
2. Merge it into the current guidance, creating a coherent set of instructions.
3. If the feedback contradicts existing guidance, update the guidance to reflect the latest preference.
4. Keep the guidance concise, clear, and actionable for an AI filtering news stories.
5. Focus on topics, industries, company types, and analysis preferences.
6. Output ONLY the updated guidance text. No conversational filler.

Example guidance format:
"Prioritize stories about [specific topics/industries]. Focus on [types of analysis]. Avoid [unwanted content]. Special interest in [specific areas]."
`;

            const result = await aiService.generateContent(prompt, { temperature: 0.3 });
            const newGuidance = result.text.trim();

            // Update subscriber record
            const { queryDocs, updateDoc } = require('../database/db-firestore');
            const users = await queryDocs('subscribers', [
                { field: 'email', op: '==', value: email }
            ]);

            if (users.length > 0) {
                await updateDoc('subscribers', users[0].id, {
                    user_guidance: newGuidance,
                    guidance_updated_at: serverTimestamp()
                });
                console.log(`✅ Updated guidance for ${email}`);
            } else {
                console.warn(`⚠️ User ${email} not found in subscribers`);
            }

            return newGuidance;

        } catch (error) {
            console.error(`❌ Failed to update user guidance for ${email}:`, error);
            throw error;
        }
    }
}

module.exports = new UserGuidanceService();
