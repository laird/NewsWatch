// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Admin Page E2E Tests', () => {
    // Use a known password or fallback to 'admin' if not set in env
    // Note: In a real scenario, we should ensure the server uses this password
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'newswatch2024';

    test.beforeEach(async ({ page }) => {
        await page.goto('/admin');
    });

    test('should show login screen initially', async ({ page }) => {
        await expect(page.locator('#auth-card')).toBeVisible();
        await expect(page.locator('#admin-panel')).toBeHidden();
    });

    test('should login successfully with correct password', async ({ page }) => {
        // Fill password
        await page.fill('#auth-password', ADMIN_PASSWORD);
        await page.click('button:has-text("Unlock Admin Panel")');

        // Verify admin panel is visible
        await expect(page.locator('#admin-panel')).toBeVisible();
        await expect(page.locator('#auth-card')).toBeHidden();
    });

    test('should show error with incorrect password', async ({ page }) => {
        await page.fill('#auth-password', 'wrong_password');
        await page.click('button:has-text("Unlock Admin Panel")');

        await expect(page.locator('#auth-status')).toContainText('Invalid password');
        await expect(page.locator('#admin-panel')).toBeHidden();
    });

    test.describe('Authenticated Tests', () => {
        test.beforeEach(async ({ page }) => {
            // Capture console logs
            page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));

            // Login before each test
            await page.fill('#auth-password', ADMIN_PASSWORD);
            await page.click('button:has-text("Unlock Admin Panel")');
            await expect(page.locator('#admin-panel')).toBeVisible();
        });

        test('should view prompt/guidance', async ({ page }) => {
            // Wait for guidance to load
            const guidanceTextarea = page.locator('#guidance-text');
            await expect(guidanceTextarea).toBeVisible();

            // We don't strictly require it to be non-empty as it might be fresh
            // But we can check if the char counter matches
            const charCount = page.locator('#char-count');
            await expect(charCount).toBeVisible();
        });

        test('should edit and save prompt', async ({ page }) => {
            const guidanceTextarea = page.locator('#guidance-text');
            const originalText = await guidanceTextarea.inputValue();
            const newText = (originalText || 'Initial guidance') + ' [TEST EDIT]';

            // Edit text
            await guidanceTextarea.fill(newText);

            // Save
            await page.click('button:has-text("Save Guidance")');

            // Verify success message
            await expect(page.locator('#guidance-status')).toContainText('Guidance updated successfully', { timeout: 30000 });

            // Reload page and verify persistence
            await page.reload();
            await page.fill('#auth-password', ADMIN_PASSWORD);
            await page.click('button:has-text("Unlock Admin Panel")');

            // Wait for guidance to load again
            await expect(page.locator('#guidance-text')).toHaveValue(newText);

            // Cleanup: Revert changes (only if there was original text)
            if (originalText) {
                await page.locator('#guidance-text').fill(originalText);
                await page.click('button:has-text("Save Guidance")');
                await expect(page.locator('#guidance-status')).toContainText('Guidance updated successfully');
            }
        });

        test('should send newsletter', async ({ page }) => {
            // Click send button
            // Note: This might take a while, so we increase timeout
            test.setTimeout(60000);

            await page.click('button:has-text("Generate & Send Test Newsletter")');

            // Verify status message
            const statusDiv = page.locator('#newsletter-status');
            await expect(statusDiv).toContainText('Newsletter sent to', { timeout: 30000 });
            await expect(statusDiv).toContainText('test users', { timeout: 30000 });
        });

        test('should view newsletter in archive', async ({ page }) => {
            // Wait for archives to load
            const archiveList = page.locator('#archive-list');
            await expect(archiveList).toBeVisible();

            // Check if there are items
            const items = archiveList.locator('.archive-item');
            // We expect at least one item since we just sent one in the previous test (or if previous tests ran)
            // But since tests run in parallel or order isn't guaranteed, we can't strictly depend on previous test.
            // However, we can check if the list is not showing "No archives found" or "Loading..."

            // Wait for loading to finish - check first item only
            await expect(page.locator('#archive-list li').first()).not.toHaveText('Loading archives...', { timeout: 30000 });

            // If we have archives, check the first one
            if (await items.count() > 0) {
                const firstItem = items.first();
                await expect(firstItem).toBeVisible();
                await expect(firstItem.locator('.archive-link')).toBeVisible();
            }
        });
    });
});
