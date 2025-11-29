const { getDoc, setDoc, updateDoc, serverTimestamp } = require('../database/db-firestore');
const aiService = require('./ai-service');

const GUIDANCE_COLLECTION = 'system_settings';
const GUIDANCE_DOC_ID = 'pe_analysis_guidance';

/**
 * Service to manage Unified Feedback Guidance
 */
class GuidanceService {

    /**
     * Get the current unified guidance
     */
    async getCurrentGuidance() {
        try {
            const doc = await getDoc(GUIDANCE_COLLECTION, GUIDANCE_DOC_ID);
            return doc ? doc.current_guidance : null;
        } catch (error) {
            console.error('Error fetching guidance:', error);
            return null;
        }
    }

    /**
     * Update guidance by merging new feedback
     * @param {string} newFeedbackText 
     */
    async updateGuidance(newFeedbackText) {
        console.log('🧠 Merging new feedback into Unified Guidance...');

        try {
            const currentGuidance = await this.getCurrentGuidance() || "No specific guidance yet. Follow standard PE analysis best practices.";

            const prompt = `
You are the "Guidance Manager" for an AI financial analyst. 
Your goal is to maintain a single, coherent set of instructions (Guidance) for the analyst based on user feedback.

CURRENT GUIDANCE:
"""
${currentGuidance}
"""

NEW USER FEEDBACK:
"""
${newFeedbackText}
"""

TASK:
1. Analyze the New Feedback.
2. Merge it into the Current Guidance.
3. If the new feedback contradicts old guidance, try to reconcile the contradiction. Remember that people will not all agree, and that's fine.
4. Consolidate similar points.
5. Remove any obsolete or conflicting instructions.
6. Keep the tone professional and instructional.
7. Output ONLY the new Unified Guidance text. Do not add conversational filler.
`;

            const result = await aiService.generateContent(prompt, { temperature: 0.3 });
            const newGuidance = result.text.trim();

            // Save to Firestore
            await setDoc(GUIDANCE_COLLECTION, GUIDANCE_DOC_ID, {
                current_guidance: newGuidance,
                last_updated: serverTimestamp(),
                last_feedback_integrated: newFeedbackText
            });

            console.log('✅ Unified Guidance updated.');
            return newGuidance;

        } catch (error) {
            console.error('❌ Failed to update guidance:', error);
            throw error;
        }
    }
}

module.exports = new GuidanceService();
