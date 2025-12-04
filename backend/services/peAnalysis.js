const { stories } = require('../database/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

// PE Analysis Prompt Template
const PE_ANALYSIS_PROMPT = `You are a financial analyst specializing in private equity investments. Analyze this news article for its impact on PE investors.

Title: {{HEADLINE}}

Content: {{CONTENT}}

Provide a structured analysis:
1. Investment Opportunity Score (0-10): How relevant is this to PE investment opportunities?
2. Deal Impact Score (0-10): Does this affect M&A or deal dynamics?
3. Portfolio Impact Score (0-10): Does this affect existing portfolio companies?
4. Categories: Select 1-3 categories that best describe this story. Choose from:
   - Business Models: SaaS, Platform, Marketplace, Infrastructure, API/Developer Tools, Open Source
   - Verticals: FinTech, HealthTech, EdTech, PropTech, LegalTech, Supply Chain, Cybersecurity, Media/Content, Gaming
   - Technology: AI/ML, Cloud Computing, Blockchain/Crypto, DevOps/Infrastructure, Data/Analytics, IoT, AR/VR
   - Activity Type: M&A/Acquisition, Funding Round, IPO/Public Markets, Product Launch, Partnership, Regulatory/Policy
   - Customer Segment: Enterprise, SMB, Consumer, Developer Tools
5. Insights: Provide exactly 2 bullet points:
   - Opportunity: [One sentence describing the specific opportunity for PE investors]
   - Threat: [One sentence describing the specific threat or risk to PE portfolios/deals]

Focus on:
- Investment opportunities (new markets, technologies, companies)
- M&A implications and deal dynamics
- Valuation trends and multiples
- Portfolio company impacts
- Category-specific developments
- Regulatory or market changes affecting deals

Format your response to include a line starting with "Categories:" followed by the 1-3 selected categories.`;

/**
 * Analyze a story for PE investor impact
 * Uses OpenAI API or Gemini API if available, otherwise returns mock analysis
 */
async function analyzePEImpact(story) {
    try {
        let analysis;

        // Use Shared AI Service
        if (process.env.AI_PROVIDER === 'gemini' || process.env.OPENAI_API_KEY) {
            try {
                analysis = await analyzeWithAI(story);
            } catch (error) {
                console.log(`    AI analysis failed, using mock: ${error.message}`);
                analysis = generateMockAnalysis(story);
            }
        }
        // Fallback to mock analysis
        else {
            analysis = generateMockAnalysis(story);
        }

        // Save analysis to Firestore
        await stories.update(story.id, {
            pe_impact_score: analysis.overall_score,
            relevance_score: analysis.relevance_score,
            pe_analysis: analysis
        });

        return analysis;

    } catch (error) {
        console.error('Error analyzing story:', error);
        throw error;
    }
}

// Analyze using Shared AI Service
async function analyzeWithAI(story) {
    const aiService = require('./ai-service');

    // Fetch unified user guidance
    const feedbackGuidance = await getFeedbackGuidance();

    let prompt = PE_ANALYSIS_PROMPT
        .replace('{{HEADLINE}}', story.headline)
        .replace('{{CONTENT}}', (story.content || story.summary || '').substring(0, 2000));

    if (feedbackGuidance) {
        prompt += `\n\nIMPORTANT USER GUIDANCE:\n${feedbackGuidance}\n\nPlease adjust your analysis to align with this feedback.`;
    }

    const result = await aiService.generateContent(prompt, { temperature: 0.7 });
    const text = result.text;

    // Parse the response
    const scores = calculateScores(text);

    // Extract insights (Opportunity and Threat)
    const insights = [];
    const lines = text.split('\n');
    let opportunity = '';
    let threat = '';

    for (const line of lines) {
        if (line.toLowerCase().includes('opportunity:') && !line.toLowerCase().includes('score')) {
            opportunity = line.replace(/.*Opportunity:\s*/i, '').trim();
        }
        if (line.toLowerCase().includes('threat:') && !line.toLowerCase().includes('score')) {
            threat = line.replace(/.*Threat:\s*/i, '').trim();
        }
    }

    if (opportunity) insights.push(`<b>Opportunity:</b> ${opportunity}`);
    if (threat) insights.push(`<b>Threat:</b> ${threat}`);

    // Fallback if structured parsing fails but we have bullet points
    if (insights.length === 0) {
        const bullets = text.split('\n')
            .filter(line => line.trim().startsWith('-'))
            .map(line => line.trim().replace(/^-\s*/, ''))
            .map(line => line.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'))
            .filter(line => line.length > 5 && !line.match(/^-+$/))
            .slice(0, 2);
        insights.push(...bullets);
    }

    return {
        overall_score: scores.overall,
        relevance_score: scores.relevance,
        investment_score: scores.investment,
        deal_score: scores.deal,
        portfolio_score: scores.portfolio,
        categories: extractCategories(text),
        insights: insights,
        explanation: text,
        raw_analysis: text,
        analyzed_at: new Date().toISOString(),
        usage: result.usage
    };
}

// Generate mock PE analysis for development/testing
function generateMockAnalysis(story) {
    const text = story.content || story.summary || story.headline;
    const result = calculateScoresWithExplanation(text);

    const insights = [];
    if (result.scores.investment >= 5) {
        insights.push(`<b>Opportunity:</b> Potential investment target in ${extractSectors(text)[0] || 'tech'} sector.`);
    } else {
        insights.push(`<b>Opportunity:</b> Limited direct investment opportunity, monitor for market trends.`);
    }

    if (result.scores.deal >= 5) {
        insights.push(`<b>Threat:</b> Increased competition for deals in this space.`);
    } else {
        insights.push(`<b>Threat:</b> No immediate threats to existing portfolio companies.`);
    }

    return {
        overall_score: result.scores.overall,
        relevance_score: result.scores.relevance,
        investment_score: result.scores.investment,
        deal_score: result.scores.deal,
        portfolio_score: result.scores.portfolio,
        categories: extractCategories(text),
        insights: insights,
        explanation: result.explanation,
        keywords_found: result.keywordsFound,
        raw_analysis: 'Mock analysis based on keyword matching',
        analyzed_at: new Date().toISOString(),
        is_mock: true
    };
}

function calculateScores(text) {
    const result = calculateScoresWithExplanation(text);
    return result.scores;
}

function calculateScoresWithExplanation(text) {
    const lower = text.toLowerCase();

    // PE-relevant keywords
    const investmentKeywords = ['investment', 'funding', 'series', 'raise', 'capital', 'valuation', 'startup', 'venture'];
    const dealKeywords = ['acquisition', 'merger', 'buyout', 'deal', 'exit', 'ipo', 'spac', 'sale'];
    const portfolioKeywords = ['growth', 'expansion', 'market', 'revenue', 'saas', 'platform', 'technology'];

    const foundInvestment = investmentKeywords.filter(kw => lower.includes(kw));
    const foundDeal = dealKeywords.filter(kw => lower.includes(kw));
    const foundPortfolio = portfolioKeywords.filter(kw => lower.includes(kw));

    const investmentScore = Math.min(10, foundInvestment.length * 1.5);
    const dealScore = Math.min(10, foundDeal.length * 1.5);
    const portfolioScore = Math.min(10, foundPortfolio.length * 1.5);

    const overall = Number(((investmentScore + dealScore + portfolioScore) / 3).toFixed(2));
    const relevance = Number((Math.max(investmentScore, dealScore, portfolioScore)).toFixed(2));

    // Generate explanation
    let explanation = [];

    if (investmentScore > 0) {
        explanation.push(`Investment Score (${investmentScore}/10): Found ${foundInvestment.length} investment-related keywords: ${foundInvestment.join(', ')}`);
    } else {
        explanation.push(`Investment Score (0/10): No direct investment or funding keywords detected`);
    }

    if (dealScore > 0) {
        explanation.push(`Deal Score (${dealScore}/10): Found ${foundDeal.length} M&A/deal keywords: ${foundDeal.join(', ')}`);
    } else {
        explanation.push(`Deal Score (0/10): No merger, acquisition, or exit keywords detected`);
    }

    if (portfolioScore > 0) {
        explanation.push(`Portfolio Score (${portfolioScore}/10): Found ${foundPortfolio.length} growth/market keywords: ${foundPortfolio.join(', ')}`);
    } else {
        explanation.push(`Portfolio Score (0/10): No portfolio company or market expansion keywords detected`);
    }

    explanation.push(`Overall PE Impact: ${overall}/10 (average of all scores)`);
    explanation.push(`Relevance: ${relevance}/10 (highest individual score)`);

    return {
        scores: { investment: investmentScore, deal: dealScore, portfolio: portfolioScore, overall, relevance },
        explanation: explanation.join('\n'),
        keywordsFound: {
            investment: foundInvestment,
            deal: foundDeal,
            portfolio: foundPortfolio
        }
    };
}

function getScoreLevel(score, type = 'standard') {
    if (score >= 7) return type === 'relevance' ? 'High Relevance' : 'Critical';
    if (score >= 5) return type === 'relevance' ? 'Medium Relevance' : 'Important';
    if (score >= 3) return type === 'relevance' ? 'Low Relevance' : 'Notable';
    return type === 'relevance' ? 'Not Relevant' : 'Minimal';
}

function getRelevanceLevel(score) {
    if (score >= 8) return 'Must Read';
    if (score >= 6) return 'Recommended';
    if (score >= 4) return 'FYI';
    return 'Optional';
}

// Extract categories from AI response or text
function extractCategories(text) {
    // First, try to parse categories from AI response
    const lines = text.split('\n');
    for (const line of lines) {
        if (line.toLowerCase().includes('categories:')) {
            // Extract categories after "Categories:"
            const categoriesStr = line.replace(/.*Categories:\s*/i, '').trim();
            // Split by common separators (comma, semicolon, pipe)
            const categories = categoriesStr
                .split(/[,;|]/)
                .map(cat => cat.trim())
                .filter(cat => cat.length > 0)
                .slice(0, 3);
            if (categories.length > 0) {
                return categories;
            }
        }
    }

    // Fallback: Use improved keyword matching with better categorization
    const categoryKeywords = {
        'AI/ML': /\b(ai|artificial intelligence|machine learning|ml|neural network|deep learning)\b/i,
        'SaaS': /\b(saas|software as a service|subscription software)\b/i,
        'FinTech': /\b(fintech|financial technology|payments?|banking|crypto exchange|wallet)\b/i,
        'HealthTech': /\b(healthtech|health tech|medical|biotech|pharma|healthcare)\b/i,
        'Cloud Computing': /\b(cloud|aws|azure|gcp|infrastructure as a service|paas)\b/i,
        'Cybersecurity': /\b(security|cybersecurity|encryption|breach|vulnerability)\b/i,
        'M&A/Acquisition': /\b(acquisition|merger|buyout|acquires?|acquired)\b/i,
        'Funding Round': /\b(series [a-z]|seed round|funding|raise[ds]?|investment round)\b/i,
        'Enterprise': /\b(enterprise|b2b|business software)\b/i,
        'Blockchain/Crypto': /\b(blockchain|cryptocurrency|bitcoin|ethereum|web3|defi)\b/i,
        'E-commerce': /\b(ecommerce|e-commerce|retail|marketplace|shopify)\b/i,
        'Platform': /\b(platform|ecosystem|marketplace platform)\b/i,
        'Developer Tools': /\b(developer tools?|api|sdk|devops|github|gitlab)\b/i
    };

    const categories = [];
    for (const [category, regex] of Object.entries(categoryKeywords)) {
        if (regex.test(text)) categories.push(category);
    }

    // Return up to 3 categories, or a default if none found
    return categories.length > 0 ? categories.slice(0, 3) : ['Technology'];
}

// Generate action items based on scores
function generateActionItems(investmentScore, dealScore, portfolioScore) {
    const items = [];

    if (investmentScore >= 7) {
        items.push('Monitor for potential direct investment opportunity');
    }
    if (dealScore >= 7) {
        items.push('Review for M&A or exit strategy implications');
    }
    if (portfolioScore >= 7) {
        items.push('Assess impact on existing portfolio companies');
    }
    if (items.length === 0) {
        items.push('File for future reference');
    }

    return items;
}

/**
 * Fetch unified feedback guidance
 */
async function getFeedbackGuidance() {
    try {
        const guidanceService = require('./guidance-service');
        return await guidanceService.getCurrentGuidance();
    } catch (error) {
        console.error('Error fetching feedback guidance:', error);
        return null;
    }
}

module.exports = {
    analyzePEImpact,
    PE_ANALYSIS_PROMPT,
    getFeedbackGuidance
};
