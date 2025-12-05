const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const fs = require('fs').promises;
const { stories } = require('./database/firestore');
const { Storage } = require('@google-cloud/storage');

const OUTPUT_DIR = path.join(__dirname, '../public');
const BUCKET_NAME = 'newswatch-479605-public';
let storage;
let bucket;

// Initialize Storage with conditional credentials
try {
  storage = new Storage();
  bucket = storage.bucket(BUCKET_NAME);
} catch (err) {
  console.warn('⚠️ Google Cloud Storage could not be initialized. Production uploads will fail unless credentials are provided.');
}

const IS_DEV = process.env.NODE_ENV !== 'production';

/**
 * Save file to either local filesystem or GCS based on environment.
 */
async function saveFile(filename, content, contentType = 'text/html') {
  if (IS_DEV) {
    // Local generation
    const filePath = path.join(OUTPUT_DIR, filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
    console.log(`✓ Wrote local: ${filename}`);
  } else {
    // Production GCS upload
    if (!bucket) {
      throw new Error('Google Cloud Storage not initialized. Cannot upload to production.');
    }
    try {
      const file = bucket.file(filename);
      await file.save(content, {
        metadata: {
          contentType,
          cacheControl: 'public, max-age=3600',
        },
      });
      console.log(`✓ Uploaded GCS: gs://${BUCKET_NAME}/${filename}`);
    } catch (error) {
      console.error(`❌ Failed to upload ${filename}:`, error.message);
      throw error;
    }
  }
}

/**
 * Generate the static site: index page and individual story pages.
 */
async function generateStaticSite() {
  console.log(`🏗️  Starting static site generation (${IS_DEV ? 'DEV - Local' : 'PROD - GCS'})...`);

  // Fetch top stories
  try {
    const storyList = await stories.getTopStories({ limit: 25 });
    console.log(`✓ Fetched ${storyList.length} stories from Firestore`);

    if (storyList.length === 0) {
      console.warn('⚠️ No stories found. Site might be empty.');
    }

    // Generate and Save Index Page
    const indexHtml = generateIndexHtml(storyList);
    await saveFile('index.html', indexHtml, 'text/html');

    // Generate and Save Story Pages
    for (const story of storyList) {
      const storyHtml = generateStoryHtml(story);
      await saveFile(`story/${story.id}.html`, storyHtml, 'text/html');
    }
    console.log(`✓ Processed ${storyList.length} story pages`);

    // Handle CSS (Read local, save to destination)
    try {
      const cssPath = path.join(__dirname, '../styles.css');
      const cssContent = await fs.readFile(cssPath);
      await saveFile('styles.css', cssContent, 'text/css');
    } catch (e) {
      console.warn('⚠️ Could not process styles.css', e.message);
    }

    console.log('✓ Static site generation complete!');

  } catch (err) {
    console.error('Error generating site:', err);
    throw err;
  }
}

/**
 * Create the index page HTML.
 */
function generateIndexHtml(stories) {
  const date = new Date().toLocaleDateString('en-US');
  const storiesHtml = stories.map(story => {
    // Build teaser from summary (first 1‑2 sentences)
    let teaser = story.summary || '';
    if (!teaser || teaser.trim() === 'Comments' || teaser.length < 20) {
      teaser = 'Read the full story for details.';
    } else if (teaser.length > 150) {
      const firstSentenceEnd = teaser.indexOf('.', 50);
      if (firstSentenceEnd !== -1 && firstSentenceEnd < 200) {
        teaser = teaser.substring(0, firstSentenceEnd + 1);
      } else {
        teaser = teaser.substring(0, 150) + '...';
      }
    }
    return `
      <article class="story">
        <h2 class="headline"><a href="story/${story.id}.html">${story.headline}</a></h2>
        <div class="meta">
          <span class="source-badge">${story.source || 'Unknown Source'}</span>
          <span class="separator">•</span>
          <span>${new Date(story.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="summary">${teaser}<a href="story/${story.id}.html" class="read-more">[Read Full Story]</a></div>
      </article>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NewsWatch - Daily Software Economy Brief</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Chomsky&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Playfair+Display:wght@400;700;900&family=UnifrakturMaguntia&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="newspaper">
    <header class="masthead">
      <div class="ears">
        <div class="ear-left">VOL. CLXXII... No. 42<br>NEW YORK, SATURDAY</div>
        <div class="title-wrapper">
          <h1 class="paper-title">NewsWatch</h1>
          <div class="paper-subtitle">Daily Software Economy Brief</div>
        </div>
        <div class="ear-right"><span id="current-date">${date}</span></div>
      </div>
    </header>
    <main class="content">
      <div id="stories-container" class="story-grid">
        ${storiesHtml}
      </div>
    </main>
    <footer class="footer">
      <div class="separator-line-single"></div>
      <p>© ${new Date().getFullYear()} NewsWatch. All rights reserved.</p>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Create the HTML for a single story page.
 */
function generateStoryHtml(story) {
  const peAnalysis = story.pe_analysis || {};
  const impactBox = story.pe_impact_score ? `
    <div class="impact-box" style="border: 3px double #333; padding: 15px; margin-bottom: 25px; background-color: rgba(0,0,0,0.05);">
      <h3 style="font-family: 'Playfair Display', serif; margin-top: 0;">Private Equity Analysis</h3>
      <p><strong>Impact Score:</strong> ${story.pe_impact_score}/10</p>
      <ul style="font-family: 'Times New Roman', serif;">
        ${(peAnalysis.key_insights || []).map(i => `<li>${i}</li>`).join('')}
      </ul>
    </div>` : '';

  const bodyContent = story.content
    ? story.content.split('\n').map(p => `<p>${p}</p>`).join('')
    : `<p>${story.summary}</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${story.headline} - NewsWatch</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Chomsky&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Playfair+Display:wght@400;700;900&family=UnifrakturMaguntia&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../styles.css">
</head>
<body>
  <div class="newspaper">
    <header class="masthead">
      <div class="ears">
        <div class="ear-left">NewsWatch</div>
        <div class="title-wrapper">
          <h1 class="paper-title" style="font-size: 3rem; margin: 0;"><a href="../index.html" style="text-decoration: none; color: inherit;">NewsWatch</a></h1>
        </div>
        <div class="ear-right"><a href="../index.html">Back to Front Page</a></div>
      </div>
    </header>
    <main class="content">
      <div class="story-detail" style="max-width: 800px; margin: 0 auto; padding: 20px;">
        <h1 class="headline" style="font-size: 2.5rem; text-align: center; margin-bottom: 20px;">${story.headline}</h1>
        <div class="meta" style="text-align: center; margin-bottom: 30px; border-bottom: 1px solid #333; padding-bottom: 10px;">
          <span class="source-badge">${story.source || 'Unknown Source'}</span>
          <span class="separator">•</span>
          <span>${new Date(story.published_at).toLocaleString()}</span>
        </div>
        ${impactBox}
        <div class="story-body" style="font-family: 'Times New Roman', serif; font-size: 1.1rem; line-height: 1.6; text-align: justify;">
          ${bodyContent}
        </div>
        <div class="original-link" style="margin-top: 40px; text-align: center;">
          <a href="${story.url}" target="_blank" style="font-family: 'Times New Roman', serif; font-style: italic;">Read original article at ${story.source} →</a>
        </div>
      </div>
    </main>
    <footer class="footer">
      <div class="separator-line-single"></div>
      <p>© ${new Date().getFullYear()} NewsWatch. All rights reserved.</p>
    </footer>
  </div>
</body>
</html>`;
}

if (require.main === module) {
  generateStaticSite()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { generateStaticSite };
