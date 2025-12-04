const { Storage } = require('@google-cloud/storage');
const { stories, db } = require('./database/firestore');
const { ingestNews } = require('./services/newsIngestion');
const fs = require('fs').promises;
const path = require('path');

const storage = new Storage();
const BUCKET_NAME = 'newswatch-479605-public';
const bucket = storage.bucket(BUCKET_NAME);

const IS_DEV = process.env.NODE_ENV !== 'production';
const PUBLIC_DIR = path.join(__dirname, '../public');

async function writeToLocal(filename, content) {
    const filePath = path.join(PUBLIC_DIR, filename);
    const dir = path.dirname(filePath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(filePath, content);
    console.log(`✓ Wrote ${filePath}`);
}

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

async function saveFile(filename, content, contentType = 'text/html') {
    if (IS_DEV) {
        await writeToLocal(filename, content);
    } else {
        await uploadToGCS(filename, content, contentType);
    }
}

async function generateStaticSite() {
    console.log(`🏗️  Starting static site generation (${IS_DEV ? 'Local' : 'GCS'})...`);

    // 1. Check if we need to ingest news (skip if run within last hour)
    const metadataRef = db.collection('system_metadata').doc('ingestion');
    const metadataDoc = await metadataRef.get();
    const lastIngestion = metadataDoc.exists ? metadataDoc.data().last_run : null;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    if (!lastIngestion || lastIngestion.toDate() < oneHourAgo) {
        console.log('🔄 Ingesting latest news... (SKIPPED FOR VERIFICATION)');
        // await ingestNews();
        // await metadataRef.set({ last_run: new Date() });
    } else {
        console.log('⏭️  Skipping ingestion (last run was less than 1 hour ago)');
    }

    // 2. Fetch top stories
    const storyList = await stories.getTopStories({ limit: 12 });

    // 3. Generate Index Page (Cover)
    const indexHtml = generateIndexHtml(storyList);
    await saveFile('index.html', indexHtml);

    // 4. Generate Story Detail Pages
    for (const story of storyList) {
        const storyHtml = generateStoryHtml(story);
        await saveFile(`story/${story.id}.html`, storyHtml);
    }
    console.log(`✓ Generated and uploaded ${storyList.length} story pages`);

    // 5. Upload Assets (CSS/JS) - Read from local source
    const cssContent = await fs.readFile(path.join(__dirname, '../styles.css'));
    await saveFile('styles.css', cssContent, 'text/css');

    const jsContent = await fs.readFile(path.join(__dirname, '../script.js'));
    await saveFile('script.js', jsContent, 'application/javascript');

    // 6. Generate Archive Page
    const archiveHtml = await generateArchiveHtml();
    await saveFile('archive.html', archiveHtml);

    console.log('\n✅ Static site generation complete!');
}

async function generateArchiveHtml() {
    const date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Read index.json from editions directory
    let archives = [];
    try {
        if (process.env.NODE_ENV === 'production' && process.env.GCP_PROJECT_ID) {
            const { Storage } = require('@google-cloud/storage');
            const storage = new Storage();
            const bucketName = `${process.env.GCP_PROJECT_ID}-public`;
            const bucket = storage.bucket(bucketName);
            const file = bucket.file('editions/index.json');

            const [exists] = await file.exists();
            if (exists) {
                const [content] = await file.download();
                archives = JSON.parse(content.toString('utf8'));
                console.log('✓ Downloaded index.json from GCS for archive generation');
            } else {
                console.warn('⚠️ editions/index.json does not exist in GCS');
            }
        } else {
            // Local development
            const indexPath = path.join(__dirname, '../public/editions/index.json');
            const indexContent = await fs.readFile(indexPath, 'utf8');
            archives = JSON.parse(indexContent);
        }
    } catch (err) {
        console.warn('⚠️ Could not read editions/index.json for archive generation:', err.message);
    }

    const archiveListHtml = archives.map(item => {
        const itemDate = new Date(item.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });

        // Use local path for dev, GCS URL for prod (or relative if we are on the same domain)
        // Since we are generating a static site, relative links are best if files are in editions/
        // But editions are in a subdirectory.
        // item.url is the public URL (GCS). We can use that.

        return `
        <div class="archive-item" style="padding: 15px; border-bottom: 1px solid #eee; margin-bottom: 10px;">
            <div style="font-size: 14px; color: #666;">${itemDate}</div>
            <h3 style="margin: 5px 0;">
                <a href="${item.url}" target="_blank" style="color: #1a1a1a; text-decoration: none;">${item.filename}</a>
            </h3>
            <div style="font-size: 12px; color: #999;">
                ${item.recipientCount ? `${item.recipientCount} Recipients` : ''} 
                ${item.storyCount ? `| ${item.storyCount} Stories` : ''}
            </div>
        </div>
        `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NewsWatch - Archive</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="newspaper">
        <header class="masthead">
            <div class="edition-info">
                <a href="index.html" style="text-decoration: none; color: #666;">&larr; Back to Today's Edition</a>
            </div>
            <h1 class="title">NewsWatch Archive</h1>
            <div class="tagline">Past Editions</div>
        </header>
        <main class="content">
            <div class="archive-list" style="max-width: 800px; margin: 0 auto;">
                ${archives.length > 0 ? archiveListHtml : '<p style="text-align: center; color: #666;">No archives found.</p>'}
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

function generateIndexHtml(storyList) {
    const date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Helper to safely format dates from Firestore Timestamps or strings
    const formatDate = (dateObj, options = {}) => {
        if (!dateObj) return '';
        let date;
        // Handle Firestore Timestamp
        if (dateObj && typeof dateObj.toDate === 'function') {
            date = dateObj.toDate();
        } else {
            date = new Date(dateObj);
        }

        if (isNaN(date.getTime())) return '';
        return date.toLocaleString('en-US', options);
    };

    // Helper to format time only
    const formatTime = (dateObj) => formatDate(dateObj, { hour: 'numeric', minute: '2-digit' });

    const storiesHtml = storyList.map(story => {
        const peAnalysis = story.pe_analysis || {};

        // Format insights as italicized bullet points
        const insightsHTML = peAnalysis.key_insights && peAnalysis.key_insights.length > 0 ? `
            <div class="pe-insights">
                <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
                    ${peAnalysis.key_insights.slice(0, 2).map(insight => `<li><i>${insight}</i></li>`).join('')}
                </ul>
            </div>
        ` : '';

        return `
    <a href="story/${story.id}.html" class="story-compact" data-story-id="${story.id}">
        <div class="feedback-buttons">
            <button class="thumb-btn thumb-up" onclick="handleThumb('${story.id}', 'up', event)" title="Relevant">
                <svg class="thumb-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1.91l-.01-.01L23 10z"/></svg>
            </button>
            <button class="thumb-btn thumb-down" onclick="handleThumb('${story.id}', 'down', event)" title="Not Relevant">
                <svg class="thumb-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14-.47-.14-.73v1.91l.01.01L1 14c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>
            </button>
        </div>
        <div class="story-content-wrapper">
            <h3 class="headline">${story.headline}</h3>
            <div class="story-meta">
                <span class="byline">${story.source || 'Unknown Source'} | ${formatTime(story.published_at)}</span>
            </div>
            ${insightsHTML}
            <p class="story-preview">${story.summary || ''}</p>
        </div>
    </a>
  `;
    }).join('');

    return `< !DOCTYPE html >
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
                                    <div style="text-align: center; margin-top: 30px; padding: 20px;">
                                        <a href="archive.html" style="display: inline-block; padding: 10px 20px; background-color: #1a1a1a; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">View Full Archive</a>
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
    // Helper to safely format dates (duplicated for scope, or could be shared)
    const formatDate = (dateObj, options = {}) => {
        if (!dateObj) return '';
        let date;
        if (dateObj && typeof dateObj.toDate === 'function') {
            date = dateObj.toDate();
        } else {
            date = new Date(dateObj);
        }
        if (isNaN(date.getTime())) return '';
        return date.toLocaleString('en-US', options);
    };

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
                                                        <span class="time">${formatDate(story.published_at)}</span>
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
