const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

/**
 * Shared AI Service for interacting with LLMs (OpenAI / Gemini)
 */

class AIService {
    constructor() {
        this.provider = process.env.AI_PROVIDER || 'openai';

        if (this.provider === 'gemini') {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        } else {
            this.openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
                baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
            });
        }
    }

    /**
     * Generate content based on a prompt
     * @param {string} prompt 
     * @param {object} options - { temperature, maxTokens, jsonMode }
     */
    async generateContent(prompt, options = {}) {
        console.log(`[AI-SERVICE] Generating content. Provider: ${this.provider}, NODE_ENV: ${process.env.NODE_ENV}`);
        try {
            if (this.provider === 'gemini') {
                return await this._generateWithGemini(prompt);
            } else {
                return await this._generateWithOpenAI(prompt, options);
            }
        } catch (error) {
            console.error('AI Generation Error:', error.message);
            // Fallback for testing/development if AI is unavailable
            if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
                console.log('⚠️ Using mock AI response due to error');
                return {
                    text: "This is a mock AI response because the AI service is unavailable. [MOCK GUIDANCE] Focus on high-growth SaaS and ignore crypto.",
                    usage: { total_tokens: 0 }
                };
            }
            throw error;
        }
    }

    async _generateWithGemini(prompt) {
        const result = await this.model.generateContent(prompt);
        const response = result.response;
        return {
            text: response.text(),
            usage: null // Gemini doesn't always return usage in the same way
        };
    }

    async _generateWithOpenAI(prompt, options) {
        const completion = await this.openai.chat.completions.create({
            model: process.env.AI_MODEL || 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
            temperature: options.temperature || 0.7,
            max_completion_tokens: options.maxTokens || 1000,
            response_format: options.jsonMode ? { type: "json_object" } : undefined
        });

        return {
            text: completion.choices[0].message.content,
            usage: completion.usage
        };
    }
}

module.exports = new AIService();
