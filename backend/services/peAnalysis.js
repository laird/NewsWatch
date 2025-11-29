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
        const response = result.response;
        const text = response.text();

        // Clean up markdown code blocks if present
        const jsonStr = text.replaceAll(/```json\n?|\n?```/g, '').trim();
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

    const { investmentScore, dealScore, portfolioScore } = calculateScores(text);
    const overallScore = ((investmentScore + dealScore + portfolioScore) / 3).toFixed(1);

    const analysis = {
        investment_opportunity_score: investmentScore,
        deal_impact_score: dealScore,
        portfolio_relevance_score: portfolioScore,
        overall_pe_impact_score: Number.parseFloat(overallScore),
        key_insights: generateInsights(text, story.headline, dealScore, investmentScore, portfolioScore),
        investment_implications: `This ${getRelevanceLevel(overallScore)} development should be monitored for potential PE implications.`,
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

function calculateScores(text) {
    let investmentScore = 5;
    let dealScore = 5;
    let portfolioScore = 5;

    // Boost scores based on keywords
    if (/\b(acqui|merger|m&a|acquisition|bought)\b/.test(text)) dealScore += 3;
    if (/\b(valuation|funding|raised|investment|billion|million)\b/.test(text)) investmentScore += 2;
    if (/\b(saas|software|cloud|ai|fintech)\b/.test(text)) portfolioScore += 2;
    if (/\b(ipo|public|listing)\b/.test(text)) dealScore += 2;
    if (/\b(growth|revenue|arr|earnings)\b/.test(text)) portfolioScore += 1;

    return {
        investmentScore: Math.min(10, investmentScore),
        dealScore: Math.min(10, dealScore),
        portfolioScore: Math.min(10, portfolioScore)
    };
}

function getScoreLevel(score, type = 'standard') {
    if (score >= 7) {
        if (type === 'investment') return 'Strong';
        if (type === 'impact') return 'Significant';
        return 'High';
    }
    if (score >= 5) {
        return 'Moderate';
    }
    if (type === 'investment') return 'Limited';
    if (type === 'impact') return 'Minimal';
    return 'Low';
}

function getRelevanceLevel(score) {
    if (score >= 7) return 'highly relevant';
    if (score >= 5) return 'moderately relevant';
    return 'less critical';
}

/**
 * Extract sectors from text
 */
function extractSectors(text) {
    const sectors = [];
    if (/\b(saas|software)\b/.test(text)) sectors.push('SaaS');
    if (/\b(fintech|payment|banking)\b/.test(text)) sectors.push('FinTech');
    if (/\b(ai|artificial intelligence|machine learning)\b/.test(text)) sectors.push('AI/ML');
    if (/\b(cloud|aws|azure|gcp)\b/.test(text)) sectors.push('Cloud Infrastructure');
    if (/\b(cyber|security)\b/.test(text)) sectors.push('Cybersecurity');
    if (/\b(data|analytics)\b/.test(text)) sectors.push('Data & Analytics');

    return sectors.length > 0 ? sectors : ['Technology'];
}

/**
 * Generate context-aware insights with directional arrows
 */
function generateInsights(text, headline, dealScore, investmentScore, portfolioScore) {
    const insights = [];

    // Determine arrow based on overall score
    const getArrow = (score) => {
        if (score >= 8) return '↑';
        if (score >= 6) return '↗';
        if (score >= 4) return '→';
        if (score >= 2) return '↘';
        return '↓';
    };

    // M&A/Deal Activity Insight
    if (/\b(acqui|merger|m&a|acquisition|bought|deal|buyout)\b/.test(text)) {
        if (dealScore >= 7) {
            insights.push(`${getArrow(dealScore)} Significant M&A activity signals potential sector consolidation and increased deal flow`);
        } else if (dealScore >= 5) {
            insights.push(`${getArrow(dealScore)} Notable transaction activity may indicate emerging opportunities in adjacent markets`);
        } else {
            insights.push(`${getArrow(dealScore)} Limited direct M&A implications but worth monitoring for sector trends`);
        }
    } else if (/\b(ipo|public|listing|spac)\b/.test(text)) {
        insights.push(`${getArrow(dealScore)} Public market activity could affect private valuations and create exit opportunities`);
    } else if (/\b(valuation|funding|raised|investment)\b/.test(text)) {
        insights.push(`${getArrow(dealScore)} Valuation trends may impact future deal pricing and investor appetite`);
    } else {
        insights.push(`${getArrow(dealScore)} Moderate relevance to M&A strategy; monitor for indirect market effects`);
    }

    // Investment Opportunity Insight
    if (/\b(growth|expansion|scale|revenue|arr)\b/.test(text)) {
        if (investmentScore >= 7) {
            insights.push(`${getArrow(investmentScore)} Strong growth indicators suggest attractive investment targets in this space`);
        } else {
            insights.push(`${getArrow(investmentScore)} Some growth signals present; evaluate sector momentum before committing capital`);
        }
    } else if (/\b(disruption|innovation|technology|ai|platform)\b/.test(text)) {
        insights.push(`${getArrow(investmentScore)} Technology shift creates opportunities for early-stage investments and roll-ups`);
    } else if (/\b(decline|layoff|restructur|bankruptcy|shutdown)\b/.test(text)) {
        insights.push(`${getArrow(investmentScore)} Market stress may create distressed asset opportunities or portfolio risks`);
    }

    // Portfolio Company Impact Insight  
    if (/\b(saas|software|cloud)\b/.test(text)) {
        if (portfolioScore >= 7) {
            insights.push(`${getArrow(portfolioScore)} Direct impact on software portfolio companies; assess competitive positioning immediately`);
        } else {
            insights.push(`${getArrow(portfolioScore)} Tangential effect on tech portfolios; consider for next quarterly review`);
        }
    } else if (/\b(regulation|compliance|policy|law)\b/.test(text)) {
        insights.push(`${getArrow(portfolioScore)} Regulatory changes may affect portfolio operations and require compliance reviews`);
    } else if (/\b(market|sector|industry)\b/.test(text)) {
        insights.push(`${getArrow(portfolioScore)} Broader market trends could influence portfolio company performance and valuations`);
    }

    // Ensure we always have at least one insight
    if (insights.length === 0) {
        const avgScore = (dealScore + investmentScore + portfolioScore) / 3;
        insights.push(`${getArrow(avgScore)} Monitor this development for potential portfolio and deal implications`);
    }

    // Return top 3 insights (or fewer if less available)
    return insights.slice(0, 3);
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
