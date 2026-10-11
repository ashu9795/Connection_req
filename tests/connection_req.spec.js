
import { test, expect } from '@playwright/test';
import { shouldKeepBrowserOpen } from '../utils/isCloseBrowser.js';
const KEEP_BROWSER_OPEN = false; 

test('open Google Chrome', async ({ page }) => {
    await page.goto('https://www.google.com');

    await expect(page).toHaveTitle(/Google/);
    if (shouldKeepBrowserOpen(KEEP_BROWSER_OPEN)) {
        await page.pause();
    }
});
