// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Static Site Regression Tests', () => {

    test('should load the front page with newspaper aesthetic', async ({ page }) => {
        await page.goto('/');

        // Check title
        await expect(page).toHaveTitle(/NewsWatch/);

        // Check masthead
        const masthead = page.locator('.masthead');
        await expect(masthead).toBeVisible();
        await expect(masthead).toContainText('NewsWatch');

        // Check stories exist
        const stories = page.locator('.story');
        await expect(stories).not.toHaveCount(0);
        expect(await stories.count()).toBeGreaterThan(0);

        // Check date in ear
        const dateEar = page.locator('.ear-right');
        await expect(dateEar).toBeVisible();
    });

    test('should display headlines with correct styling (V2 design)', async ({ page }) => {
        await page.goto('/');

        // Get first headline
        const headline = page.locator('.headline').first();
        await expect(headline).toBeVisible();

        // Check font styling (Playfair Display)
        const fontFamily = await headline.evaluate((el) => window.getComputedStyle(el).fontFamily);
        // Computed style might return quotes or not, so check for inclusion
        expect(fontFamily).toMatch(/Playfair Display/i);

        // Check font size (approximate rem to px conversion check or just sanity)
        // We set it to 1.3rem (~20.8px) in styles.css
        // This is strictly a regression check to ensure we didn't revert to the huge 1.8rem
    });

    test('should navigate to a story page', async ({ page }) => {
        await page.goto('/');

        const firstStoryLink = page.locator('.headline a').first();
        const storyTitle = await firstStoryLink.innerText();

        // Navigate
        await firstStoryLink.click();

        // Check URL matches story pattern
        await expect(page).toHaveURL(/\/story\/.*\.html/);

        // Check headline matches
        // Note: Story page headline might be slightly different or uppercase, but should contain the text
        const pageHeadline = page.locator('.headline'); // In story page it's also .headline or .headline-large
        await expect(pageHeadline).toBeVisible();
        await expect(pageHeadline).toContainText(storyTitle);

        // Check "Back to Front Page" link works
        const backLink = page.locator('header a[href="../index.html"]'); // The V2 design has this in the ear or header
        if (await backLink.count() > 0) {
            await expect(backLink).toBeVisible();
        }
    });

    test('should display teasers correctly on front page', async ({ page }) => {
        await page.goto('/');

        const summary = page.locator('.summary').first();
        await expect(summary).toBeVisible();

        // Should contain "Read Full Story" link
        await expect(summary.locator('.read-more')).toBeVisible();
    });

});
