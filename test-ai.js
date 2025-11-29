require('dotenv').config({ path: 'backend/.env' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
    console.log('Listing models...');
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Access the model directly or via a manager if available, but the library structure is specific.
        // Actually, the library doesn't expose listModels directly on the main class easily in all versions.
        // Let's try a simple generation with 'gemini-pro' which is usually available.
        console.log('Trying gemini-pro...');
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent("Hello");
        console.log('✅ gemini-pro works:', await result.response.text());
    } catch (error) {
        console.error('❌ gemini-pro failed:', error.message);
    }
}

listModels();
