const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const fs = require('fs').promises;
const db = require('./database/db');

const OUTPUT_DIR = path.join(__dirname, '../public');

/**
 * Generate the static site: index page and individual story pages.
 */
async function generateStaticSite() {
    console.log('🏗️  Starting static site generation...');

    // Ensure output directories exist
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.mkdir(path.join(OUTPUT_DIR, 'story'), { recursive: true });

    // Fetch top stories
    try {
        const { rows: stories } = await db.query(`
        SELECT id, headline, source, author, url, summary, content, published_at,
               pe_impact_score, pe_analysis
        FROM stories
        ORDER BY pe_impact_score DESC NULLS LAST, ingested_at DESC
        LIMIT 25
      `);
        console.log('✓ Connected to database');
        console.log(`✓ Fetched ${stories.length} stories for the front page`);

        // Write index.html
        const indexHtml = generateIndexHtml(stories);
        await fs.writeFile(path.join(OUTPUT_DIR, 'index.html'), indexHtml);
        console.log('✓ Generated public/index.html');

        // Write individual story pages
        for (const story of stories) {
            const storyHtml = generateStoryHtml(story);
            await fs.writeFile(path.join(OUTPUT_DIR, 'story', `${story.id}.html`), storyHtml);
        }
        console.log(`✓ Generated ${stories.length} individual story pages`);

        // Copy CSS
        try {
            await fs.copyFile(path.join(__dirname, '../styles.css'), path.join(OUTPUT_DIR, 'styles.css'));
            console.log('✓ Copied styles.css');
        } catch (e) {
            console.warn('⚠️ Could not copy styles.css', e.message);
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
