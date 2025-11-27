const { stories, subscribers, invitations } = require('./firestore');
const { analyzePEImpact } = require('../services/peAnalysis');

// Sample stories for development/testing
const SAMPLE_STORIES = [
    {
        headline: "OpenAI Announces GPT-5 with Breakthrough Reasoning Capabilities",
        source: "TechCrunch",
        author: "Sarah Johnson",
        url: "https://techcrunch.com/2025/11/26/openai-gpt-5",
        content: "OpenAI unveiled GPT-5 this morning, marking what CEO Sam Altman calls 'the most significant leap in AI reasoning since GPT-4.' The new model demonstrates unprecedented performance in complex problem-solving, mathematical reasoning, and long-form planning tasks. Early benchmarks show GPT-5 achieving 95% accuracy on graduate-level mathematics problems, compared to GPT-4's 78%. The model also demonstrates improved factual accuracy and reduced hallucinations, addressing key criticisms of previous versions. Pricing remains unchanged at $20/month for ChatGPT Plus subscribers, with API access starting at $0.03 per 1K tokens. Enterprise customers will gain access to fine-tuning capabilities in Q1 2026.",
        summary: "OpenAI unveiled GPT-5 this morning, marking what CEO Sam Altman calls 'the most significant leap in AI reasoning since GPT-4.' Early benchmarks show 95% accuracy on graduate-level mathematics...",
        published_at: new Date()
    },
    {
        headline: "Stripe Acquires Fintech Startup Lemon for $850M",
        source: "Bloomberg",
        author: "Michael Chen",
        url: "https://bloomberg.com/news/stripe-lemon-acquisition",
        content: "Payment giant Stripe announced the acquisition of Lemon, a Y Combinator-backed fintech startup specializing in embedded banking solutions for SaaS companies. The deal values Lemon at $850 million, marking Stripe's largest acquisition since 2021. Lemon's technology enables software companies to offer banking services directly within their applications, including checking accounts, debit cards, and lending products. The startup serves over 500 SaaS companies and processes $2 billion in annual transaction volume.",
        summary: "Payment giant Stripe announced the acquisition of Lemon, a Y Combinator-backed fintech startup specializing in embedded banking solutions for SaaS companies...",
        published_at: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
    },
    {
        headline: "AWS Launches New AI Chip to Compete with NVIDIA",
        source: "The Information",
        author: "David Park",
        url: "https://theinformation.com/aws-trainium2",
        content: "Amazon Web Services introduced Trainium2, its latest custom AI training chip, claiming 40% better performance per dollar compared to NVIDIA's H100 GPUs. The announcement comes as cloud providers seek to reduce dependence on NVIDIA's dominant hardware. Trainium2 chips are now available in AWS's EC2 instances, with major AI companies including Anthropic and Stability AI already committed to using the new hardware.",
        summary: "Amazon Web Services introduced Trainium2, its latest custom AI training chip, claiming 40% better performance per dollar compared to NVIDIA's H100 GPUs...",
        published_at: new Date(Date.now() - 4 * 60 * 60 * 1000) // 4 hours ago
    },
    {
        headline: "Databricks Eyes $55B Valuation in New Funding Round",
        source: "WSJ",
        author: "Emily Rodriguez",
        url: "https://wsj.com/databricks-funding",
        content: "Data analytics platform Databricks is in advanced talks to raise $1.5 billion at a $55 billion valuation, making it one of the most valuable private software companies. The funding round represents a 50% increase from the company's previous $38 billion valuation in 2023. The company reported $1.6 billion in annual recurring revenue, up 60% year-over-year, with profitability expected by mid-2026.",
        summary: "Data analytics platform Databricks is in advanced talks to raise $1.5 billion at a $55 billion valuation, making it one of the most valuable private software companies...",
        published_at: new Date(Date.now() - 6 * 60 * 60 * 1000)
    },
    {
        headline: "SaaS Valuations Rebound to 8.2x Revenue Multiple",
        source: "WSJ",
        author: "Robert Kim",
        url: "https://wsj.com/saas-valuations-2025",
        content: "Software-as-a-Service companies saw median valuations rise to 8.2x revenue in Q4 2025, up from 6.1x a year ago, signaling renewed investor confidence in the sector. The recovery follows two years of compressed multiples after the 2022 market correction. High-growth companies with strong unit economics are commanding premium valuations, with some AI-focused SaaS companies trading above 15x revenue.",
        summary: "Software-as-a-Service companies saw median valuations rise to 8.2x revenue in Q4 2025, up from 6.1x a year ago, signaling renewed investor confidence...",
        published_at: new Date(Date.now() - 8 * 60 * 60 * 1000)
    },
    {
        headline: "Wiz Raises $300M at $12B Valuation",
        source: "TechCrunch",
        author: "Lisa Wang",
        url: "https://techcrunch.com/wiz-series-d",
        content: "Cloud security platform Wiz closed a $300 million Series D funding round led by Sequoia Capital, valuing the four-year-old company at $12 billion. The round makes Wiz one of the fastest-growing enterprise software companies in history. Wiz reported $350 million in ARR, up 150% year-over-year, with over 40% of Fortune 100 companies as customers.",
        summary: "Cloud security platform Wiz closed a $300 million Series D funding round led by Sequoia Capital, valuing the four-year-old company at $12 billion...",
        published_at: new Date(Date.now() - 10 * 60 * 60 * 1000)
    }
];

/**
 * Seed database with sample stories
 */
async function seedDatabase() {
    console.log('\n🌱 Seeding database with sample stories...\n');

    try {
        let inserted = 0;

        for (const story of SAMPLE_STORIES) {
            // Check if story already exists
            const existing = await stories.getByUrl(story.url);

            if (existing) {
                console.log(`  ⏭️  Skipping: ${story.headline.substring(0, 60)}... (already exists)`);
                continue;
            }

            // Insert story
            const insertedStory = await stories.create({
                headline: story.headline,
                source: story.source,
                author: story.author,
                url: story.url,
                content: story.content,
                summary: story.summary,
                published_at: story.published_at
            });

            inserted++;

            console.log(`  ✓ Inserted: ${story.headline.substring(0, 60)}...`);

            // Analyze for PE impact
            await analyzePEImpact(insertedStory);
            console.log(`    📊 PE Impact Score: ${insertedStory.pe_impact_score || 'analyzing...'}`);
        }

        console.log(`\n✅ Database seeded: ${inserted} stories inserted\n`);

        // Add admin/test subscriber
        const testEmail = 'laird@popk.in'; // User's personal email
        const subscriber = await subscribers.create({
            email: testEmail,
            name: 'Laird'
        });

        if (subscriber) {
            console.log(`✓ Added test subscriber: ${testEmail}`);
        } else {
            console.log(`✓ Test subscriber already exists: ${testEmail}`);
        }

        // Generate some invitation codes
        const codes = ['WELCOME2025', 'PE_INSIDER', 'ALPHA_TEST'];
        for (const code of codes) {
            const existingInvite = await invitations.getByCode(code);
            if (!existingInvite) {
                await invitations.create(code);
            }
        }
        console.log(`✓ Generated invitation codes: ${codes.join(', ')}\n`);

    } catch (error) {
        console.error('❌ Error seeding database:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    seedDatabase()
        .then(() => {
            console.log('Done!');
            process.exit(0);
        })
        .catch(err => {
            console.error('Failed:', err);
            process.exit(1);
        });
}

module.exports = { seedDatabase, SAMPLE_STORIES };
