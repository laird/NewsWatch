const { getDoc, setDoc, updateDoc, serverTimestamp } = require('../database/db-firestore');
const aiService = require('./ai-service');

const GUIDANCE_COLLECTION = 'system_settings';
const GUIDANCE_DOC_ID = 'pe_analysis_guidance';

const DEFAULT_GUIDANCE = `Prioritize valuation and analysis of enterprise and SMB software and SaaS (Software-as-a-Service) businesses with ARR > $10M, applying standard private equity analysis best practices (e.g., unit economics, retention/cohort analysis, revenue quality, growth sustainability, margin structure, and cash flow conversion).
Also report on major software industry developments that affect such valuations.
Maintain active coverage of:
- Crypto infrastructure businesses (e.g., exchanges, custody, compliance, developer tooling, infrastructure providers), but ignore analysis of coins/tokens themselves unless their characteristics have a direct, material impact on the underlying infrastructure businesses.
- Healthcare rollup strategies and platforms, with attention to acquisition economics, integration risk, payer mix, regulatory exposure, and scalability of the rollup model.
- AI and machine learning companies, with attention to the impact of regulatory and ethical concerns on their business models and growth prospects.
- Software companies that are not software companies, with attention to the impact of regulatory and ethical concerns on their business models and growth prospects.`;

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
            return doc ? doc.current_guidance : DEFAULT_GUIDANCE;
        } catch (error) {
            console.error('Error fetching guidance:', error);
            return DEFAULT_GUIDANCE;
        }
    }

    /**
     * Update guidance by merging new feedback
     * @param {string} newFeedbackText 
     */
    async updateGuidance(newFeedbackText) {
        console.log('🧠 Merging new feedback into Unified Guidance...');

        try {
            const currentGuidance = await this.getCurrentGuidance() || DEFAULT_GUIDANCE;

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
