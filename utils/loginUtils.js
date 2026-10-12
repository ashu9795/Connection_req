
import 'dotenv/config';
import { shouldKeepBrowserOpen } from './isCloseBrowser.js';
import { createLogger } from './loggerUtils.js';
import config from '../config/configuration.json' with { type: 'json' };

const username = process.env.USER_NAME;
const linkedinLoginUrl = process.env.LINKEDIN_URL_LOGIN;
const password = process.env.USER_PASSWORD;

export async function openLinkedIn(page, testInfo) {
    const keepBrowserOpen = shouldKeepBrowserOpen(
        config.KEEP_BROWSER_OPEN
    );

    if (keepBrowserOpen) {
        testInfo.setTimeout(0);
    }

    const logger = createLogger(testInfo, page, {
        enabled: config.ENABLE_LOGGER,
    });

    try {
        if (!username || !password || !linkedinLoginUrl) {
            throw new Error(
                'Missing required environment variables: ' +
                'USER_NAME, USER_PASSWORD, or LINKEDIN_URL_LOGIN'
            );
        }

        logger.info('Opening LinkedIn');

        await page.goto(linkedinLoginUrl, {
            waitUntil: 'domcontentloaded',
        });

        logger.info('LinkedIn page opened');

        const emailInput = page.getByRole('textbox', {
            name: 'Email or phone',
        });

        await emailInput.waitFor({
            state: 'visible',
            timeout: 15000,
        });

        await emailInput.fill(username);

        const passwordInput = page.getByRole('textbox', {
            name: 'Password',
        });

        await passwordInput.waitFor({
            state: 'visible',
            timeout: 10000,
        });

        await passwordInput.fill(password);

        logger.info('Login credentials entered');

        await passwordInput.press('Enter');

        logger.info('Login form submitted');

        await page.waitForLoadState('domcontentloaded', {
            timeout: 15000,
        }).catch(() => {
            logger.info('No additional document navigation detected');
        });

        if (page.url().includes('/checkpoint/')) {
            logger.warn?.(
                'LinkedIn security checkpoint detected; manual action may be required'
            );
        }

        if (keepBrowserOpen) {
            logger.info('Pausing browser for inspection');
            await page.pause();
        }
    } catch (error) {
        logger.error(`LinkedIn operation failed: ${error.message}`);

        if (keepBrowserOpen && !page.isClosed()) {
            logger.info('Pausing browser to inspect the failure');
            await page.pause();
        }

        throw error;
    } finally {
        logger.close();
    }
}
