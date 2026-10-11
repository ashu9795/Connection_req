
import { test, expect } from '@playwright/test';
import { shouldKeepBrowserOpen } from '../utils/isCloseBrowser.js';
import { createLogger } from '../utils/loggerUtils.js';
import config from '../config/configuration.json' with { type: 'json' };

test('open Google Chrome', async ({ page }, testInfo) => {
    const logger = createLogger(testInfo, page, {
        enabled: config.ENABLE_LOGGER,
    });

    try {
        logger.info('Opening Google Chrome');

        await page.goto('https://www.google.com');

        logger.info('Navigated to Google');

        await expect(page).toHaveTitle(/Google/);

        logger.info('Page title verified successfully');

        if (shouldKeepBrowserOpen(config.KEEP_BROWSER_OPEN)) {
            logger.info('Pausing browser for inspection');
            await page.pause();
        }
    } catch (error) {
        logger.error(`Test failed: ${error.message}`);
        throw error;
    } finally {
        logger.close();
    }
});
