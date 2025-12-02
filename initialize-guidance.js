require('dotenv').config({ path: require('path').resolve(__dirname, 'backend/.env') });
const { setDoc, serverTimestamp } = require('./backend/database/db-firestore');

async function initializeGuidance() {
    const initialGuidance = `Prioritize valuation and analysis of enterprise and SMB software and SaaS (Software-as-a-Service) businesses with ARR > $10M, applying standard private equity analysis best practices (e.g., unit economics, retention/cohort analysis, revenue quality, growth sustainability, margin structure, and cash flow conversion).
Also report on major software industry developments that affect such valuations.
Maintain active coverage of:
- Crypto infrastructure businesses (e.g., exchanges, custody, compliance, developer tooling, infrastructure providers), but ignore analysis of coins/tokens themselves unless their characteristics have a direct, material impact on the underlying infrastructure businesses.
- Healthcare rollup strategies and platforms, with attention to acquisition economics, integration risk, payer mix, regulatory exposure, and scalability of the rollup model.
- AI and machine learning companies, with attention to the impact of regulatory and ethical concerns on their business models and growth prospects.
- Software companies that are not software companies, with attention to the impact of regulatory and ethical concerns on their business models and growth prospects.`;

    try {
        await setDoc('system_settings', 'pe_analysis_guidance', {
            current_guidance: initialGuidance,
            last_updated: serverTimestamp(),
            last_feedback_integrated: 'Initial guidance'
        });

        console.log('✅ Initial guidance created successfully!');
        console.log('\nGuidance content:');
        console.log(initialGuidance);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating guidance:', error);
        process.exit(1);
    }
}

initializeGuidance();
