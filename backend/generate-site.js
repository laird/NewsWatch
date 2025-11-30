const { Storage } = require('@google-cloud/storage');
const { stories, db } = require('./database/firestore');
const { ingestNews } = require('./services/newsIngestion');

const storage = new Storage();
const BUCKET_NAME = 'newswatch-479605-public';
const bucket = storage.bucket(BUCKET_NAME);

async function uploadToGCS(filename, content, contentType = 'text/html') {
    const file = bucket.file(filename);
    await file.save(content, {
        metadata: {
            contentType,
            cacheControl: 'public, max-age=3600',
        },
    });
    console.log(`✓ Uploaded gs://${BUCKET_NAME}/${filename}`);
}

async function generateStaticSite() {
    console.log('🏗️  Starting static site generation (GCS)...');

    // 1. Check if we need to ingest news (skip if run within last hour)
    const metadataRef = db.collection('system_metadata').doc('ingestion');
    const metadataDoc = await metadataRef.get();
    const lastIngestion = metadataDoc.exists ? metadataDoc.data().last_run : null;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    if (!lastIngestion || lastIngestion.toDate() < oneHourAgo) {
        console.log('🔄 Ingesting latest news...');
        await ingestNews();
        await metadataRef.set({ last_run: new Date() });
    } else {
        console.log('⏭️  Skipping ingestion (last run was less than 1 hour ago)');
    }

    // 2. Fetch top stories
    const storyList = await stories.getTopStories({ limit: 12 });

    // 3. Generate Index Page (Cover)
    const indexHtml = generateIndexHtml(storyList);
    await uploadToGCS('index.html', indexHtml);

    // 4. Generate Story Detail Pages
    for (const story of storyList) {
        const storyHtml = generateStoryHtml(story);
        await uploadToGCS(`story/${story.id}.html`, storyHtml);
    }
    console.log(`✓ Generated and uploaded ${storyList.length} story pages`);

    // 5. Upload Assets (CSS/JS) - Read from local source
    const fs = require('fs').promises;
    const path = require('path');

    const cssContent = await fs.readFile(path.join(__dirname, '../styles.css'));
    await uploadToGCS('styles.css', cssContent, 'text/css');

    const jsContent = await fs.readFile(path.join(__dirname, '../script.js'));
    await uploadToGCS('script.js', jsContent, 'application/javascript');

    console.log('\n✅ Static site generation complete!');
}

function generateIndexHtml(storyList) {
    const date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const storiesHtml = storyList.map(story => `
    <a href="story/${story.id}.html" class="story-compact" data-story-id="${story.id}">
        <div class="feedback-buttons">
            <button class="thumb-btn thumb-up" onclick="handleThumb('${story.id}', 'up', event)" title="Relevant"><span class="thumb-icon">👍</span></button>
            <button class="thumb-btn thumb-down" onclick="handleThumb('${story.id}', 'down', event)" title="Not Relevant"><span class="thumb-icon">👎</span></button>
        </div>
        <div class="story-content-wrapper">
            <h3 class="headline">${story.headline}</h3>
            <div class="story-meta">
                <span class="byline">${story.source || 'Unknown'} | ${story.published_at ? new Date(story.published_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}</span>
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
                <span class="story-count">${storyList.length} Stories</span>
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
                    <span class="time">${story.published_at ? new Date(story.published_at).toLocaleString() : ''}</span>
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
