const fs = require('fs').promises;
const path = require('path');
const db = require('./database/db');
const { ingestNews } = require('./services/newsIngestion');

const OUTPUT_DIR = path.join(__dirname, '../public');

async function generateStaticSite() {
    console.log('🏗️  Starting static site generation...');

    // 1. Ingest latest news first
    await ingestNews();

    // 2. Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.mkdir(path.join(OUTPUT_DIR, 'story'), { recursive: true });

    // 3. Fetch top stories
    const storiesResult = await db.query(`
    SELECT id, headline, source, author, url, summary, content, published_at,
           pe_impact_score, pe_analysis
    FROM stories
    ORDER BY pe_impact_score DESC NULLS LAST, ingested_at DESC
    LIMIT 12
  `);
    const stories = storiesResult.rows;

    // 4. Generate Index Page (Cover)
    const indexHtml = generateIndexHtml(stories);
    await fs.writeFile(path.join(OUTPUT_DIR, 'index.html'), indexHtml);
    console.log('✓ Generated index.html');

    // 5. Generate Story Detail Pages
    for (const story of stories) {
        const storyHtml = generateStoryHtml(story);
        await fs.writeFile(path.join(OUTPUT_DIR, 'story', `${story.id}.html`), storyHtml);
    }
    console.log(`✓ Generated ${stories.length} story pages`);

    // 6. Copy CSS and JS
    await fs.copyFile(path.join(__dirname, '../styles.css'), path.join(OUTPUT_DIR, 'styles.css'));
    await fs.copyFile(path.join(__dirname, '../script.js'), path.join(OUTPUT_DIR, 'script.js'));
    console.log('✓ Copied assets');

    console.log('\n✅ Static site generation complete!');
}

function generateIndexHtml(stories) {
    const date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const storiesHtml = stories.map(story => `
    <a href="story/${story.id}.html" class="story-compact" data-story-id="${story.id}">
        <div class="feedback-buttons">
            <button class="thumb-btn thumb-up" onclick="handleThumb('${story.id}', 'up', event)" title="Relevant"><span class="thumb-icon">👍</span></button>
            <button class="thumb-btn thumb-down" onclick="handleThumb('${story.id}', 'down', event)" title="Not Relevant"><span class="thumb-icon">👎</span></button>
        </div>
        <div class="story-content-wrapper">
            <h3 class="headline">${story.headline}</h3>
            <div class="story-meta">
                <span class="byline">${story.source || 'Unknown'} | ${new Date(story.published_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
            </div>
            <p class="story-preview">${story.summary || ''}</p>
        </div>
    </a>
  `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NewsWatch - Daily Software Economy Brief</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="newspaper">
        <header class="masthead">
            <div class="edition-info">
                <span class="date">${date}</span>
                <span class="separator">|</span>
                <span class="edition">Static Edition</span>
                <span class="separator">|</span>
                <span class="story-count">${stories.length} Stories</span>
            </div>
            <h1 class="title">NewsWatch</h1>
            <div class="tagline">Daily Software Economy Brief for Private Equity Investors</div>
        </header>
        <main class="content">
            <div class="story-grid-compact">
                ${storiesHtml}
            </div>
        </main>
        <footer class="footer">
            <p>NewsWatch delivers curated software economy news daily.</p>
            <p class="copyright">© ${new Date().getFullYear()} NewsWatch. All rights reserved.</p>
        </footer>
    </div>
    <script src="script.js"></script>
</body>
</html>`;
}

function generateStoryHtml(story) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${story.headline} - NewsWatch</title>
    <link rel="stylesheet" href="../styles.css">
</head>
<body>
    <div class="newspaper">
        <header class="masthead">
            <div class="edition-info">
                <a href="../index.html" style="text-decoration: none; color: #666;">&larr; Back to Today's Edition</a>
            </div>
        </header>
        <main class="content">
            <article class="story-detail">
                <h1 class="headline-large">${story.headline}</h1>
                <div class="story-meta-large">
                    <span class="source">${story.source}</span>
                    <span class="separator">|</span>
                    <span class="time">${new Date(story.published_at).toLocaleString()}</span>
                </div>
                
                ${story.pe_impact_score ? `
                <div class="pe-analysis-box">
                    <h3>PE Investor Analysis</h3>
                    <div class="score">Impact Score: <strong>${story.pe_impact_score}/10</strong></div>
                    <ul class="insights">
                        ${(story.pe_analysis?.key_insights || []).map(i => `<li>${i}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}

                <div class="story-body">
                    ${story.content ? story.content.split('\n').map(p => `<p>${p}</p>`).join('') : `<p>${story.summary}</p>`}
                </div>
                
                <div class="original-link">
                    <a href="${story.url}" target="_blank">Read original article at ${story.source} &rarr;</a>
                </div>
            </article>
        </main>
    </div>
    <script src="../script.js"></script>
</body>
</html>`;
}

// Run if called directly
if (require.main === module) {
    generateStaticSite()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = { generateStaticSite };
