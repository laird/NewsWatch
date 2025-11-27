const db = require('../database/db');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

// PE Analysis Prompt Template
const PE_ANALYSIS_PROMPT = `You are an expert private equity analyst. Analyze the following news story for its relevance and impact on PE investors.

Story Headline: {headline}
Story Content: {content}
Source: {source}

Provide analysis in the following JSON format:
{
  "investment_opportunity_score": 0-10,
  "deal_impact_score": 0-10,
  "portfolio_relevance_score": 0-10,
  "overall_pe_impact_score": 0-10,
  "key_insights": [
    "Insight 1",
    "Insight 2",
    "Insight 3"
  ],
  "investment_implications": "Brief summary of what this means for PE investors",
  "sectors_affected": ["SaaS", "FinTech", etc.],
  "action_items": [
    "Potential action 1",
    "Potential action 2"
  ],
  "risk_level": "low" | "medium" | "high"
}

Focus on:
- Investment opportunities (new markets, technologies, companies)
- M&A implications and deal dynamics
- Valuation trends and multiples
- Portfolio company impacts
- Sector-specific developments
- Regulatory or market changes affecting deals`;

/**
 * Analyze a story for PE investor impact
 * Uses OpenAI API or Gemini API if available, otherwise returns mock analysis
 */
async function analyzePEImpact(story) {
    try {
        const provider = process.env.AI_PROVIDER || 'auto';

        if (provider === 'gemini' || (provider === 'auto' && process.env.GEMINI_API_KEY)) {
            return await analyzeWithGemini(story);
        } else if (provider === 'openai' || (provider === 'auto' && (process.env.OPENAI_API_KEY || process.env.OPENAI_BASE_URL))) {
            return await analyzeWithOpenAI(story);
        } else {
            console.log('⚠️  No AI configuration found, using mock analysis');
            return generateMockAnalysis(story);
        }
    } catch (error) {
        console.error('Error in PE analysis:', error);
        // Fallback to mock analysis on error
        return generateMockAnalysis(story);
    }
}

/**
 * Analyze using Google Gemini API
 */
async function analyzeWithGemini(story) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = PE_ANALYSIS_PROMPT
            .replace('{headline}', story.headline)
            .replace('{content}', story.content || story.summary || '')
            .replace('{source}', story.source || 'Unknown');

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown code blocks if present
        const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
        const analysis = JSON.parse(jsonStr);

        // Store analysis in database
        await db.query(
            'UPDATE stories SET pe_analysis = $1, pe_impact_score = $2 WHERE id = $3',
            [analysis, analysis.overall_pe_impact_score, story.id]
        );

        return analysis;
    } catch (error) {
        console.error('Error calling Gemini service:', error);
        throw error;
    }
}

/**
 * Analyze using OpenAI API (or compatible local LLM like LM Studio)
 */
async function analyzeWithOpenAI(story) {
    // Configure for local LLM (LM Studio) or OpenAI
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || 'lm-studio', // LM Studio often accepts any key
        baseURL: process.env.OPENAI_BASE_URL || 'http://localhost:1234/v1'
    });

    const prompt = PE_ANALYSIS_PROMPT
        .replace('{headline}', story.headline)
        .replace('{content}', story.content || story.summary || '')
        .replace('{source}', story.source || 'Unknown');

    try {
        const response = await openai.chat.completions.create({
            model: process.env.AI_MODEL || 'gpt-4', // Use 'local-model' or similar for LM Studio if needed
            messages: [
                { role: 'system', content: 'You are a private equity analyst. Respond ONLY with valid JSON.' },
                { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3
        });

        const content = response.choices[0].message.content;
        const analysis = JSON.parse(content);

        // Store analysis in database
        await db.query(
            'UPDATE stories SET pe_analysis = $1, pe_impact_score = $2 WHERE id = $3',
            [analysis, analysis.overall_pe_impact_score, story.id]
        );

        return analysis;
    } catch (error) {
        console.error('Error calling AI service:', error);
        throw error;
    }
}

/**
 * Generate mock PE analysis for development/testing
 */
function generateMockAnalysis(story) {
    // Determine scores based on keywords in headline
    const headline = (story.headline || '').toLowerCase();
    const content = (story.content || story.summary || '').toLowerCase();
    const text = headline + ' ' + content;

    let investmentScore = 5;
    let dealScore = 5;
    let portfolioScore = 5;

    // Boost scores based on keywords
    if (text.match(/\b(acqui|merger|m&a|acquisition|bought)\b/)) dealScore += 3;
    if (text.match(/\b(valuation|funding|raised|investment|billion|million)\b/)) investmentScore += 2;
    if (text.match(/\b(saas|software|cloud|ai|fintech)\b/)) portfolioScore += 2;
    if (text.match(/\b(ipo|public|listing)\b/)) dealScore += 2;
    if (text.match(/\b(growth|revenue|arr|earnings)\b/)) portfolioScore += 1;

    // Cap at 10
    investmentScore = Math.min(10, investmentScore);
    dealScore = Math.min(10, dealScore);
    portfolioScore = Math.min(10, portfolioScore);

    const overallScore = ((investmentScore + dealScore + portfolioScore) / 3).toFixed(1);

    const analysis = {
        investment_opportunity_score: investmentScore,
        deal_impact_score: dealScore,
        portfolio_relevance_score: portfolioScore,
        overall_pe_impact_score: parseFloat(overallScore),
        key_insights: [
            `${dealScore >= 7 ? 'High' : dealScore >= 5 ? 'Moderate' : 'Low'} M&A activity relevance`,
            `${investmentScore >= 7 ? 'Strong' : investmentScore >= 5 ? 'Moderate' : 'Limited'} investment opportunity signals`,
            `${portfolioScore >= 7 ? 'Significant' : portfolioScore >= 5 ? 'Moderate' : 'Minimal'} portfolio company impact`
        ],
        investment_implications: `This ${overallScore >= 7 ? 'highly relevant' : overallScore >= 5 ? 'moderately relevant' : 'less critical'} development should be monitored for potential PE implications.`,
        sectors_affected: extractSectors(text),
        action_items: generateActionItems(investmentScore, dealScore, portfolioScore),
        risk_level: overallScore >= 7 ? 'medium' : 'low'
    };

    // Store in database
    db.query(
        'UPDATE stories SET pe_analysis = $1, pe_impact_score = $2 WHERE id = $3',
        [analysis, analysis.overall_pe_impact_score, story.id]
    ).catch(err => console.error('Error storing mock analysis:', err));

    return analysis;
}

/**
 * Extract sectors from text
 */
function extractSectors(text) {
    const sectors = [];
    if (text.match(/\b(saas|software)\b/)) sectors.push('SaaS');
    if (text.match(/\b(fintech|payment|banking)\b/)) sectors.push('FinTech');
    if (text.match(/\b(ai|artificial intelligence|machine learning)\b/)) sectors.push('AI/ML');
    if (text.match(/\b(cloud|aws|azure|gcp)\b/)) sectors.push('Cloud Infrastructure');
    if (text.match(/\b(cyber|security)\b/)) sectors.push('Cybersecurity');
    if (text.match(/\b(data|analytics)\b/)) sectors.push('Data & Analytics');

    return sectors.length > 0 ? sectors : ['Technology'];
}

/**
 * Generate action items based on scores
 */
function generateActionItems(investmentScore, dealScore, portfolioScore) {
    const items = [];

    if (dealScore >= 7) {
        items.push('Monitor for follow-on M&A activity in this sector');
    }
    if (investmentScore >= 7) {
        items.push('Evaluate investment opportunities in related companies');
    }
    if (portfolioScore >= 7) {
        items.push('Assess impact on existing portfolio companies');
    }
    if (items.length === 0) {
        items.push('Continue monitoring sector developments');
    }

    return items;
}

module.exports = {
    analyzePEImpact,
    PE_ANALYSIS_PROMPT
};
