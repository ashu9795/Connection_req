
import { test } from '@playwright/test';
import 'dotenv/config';
import { openLinkedIn } from '../utils/loginUtils.js';
import { connectToExistingChrome } from '../functions/connectToExistingChrome.js';
import { createLogger } from '../utils/loggerUtils.js';
const linkedinUrl = process.env.LINKEDIN_URL_LOGIN;




test('Open LinkedIn', async ({ page }, testInfo) => {
    await openLinkedIn(page, testInfo);
});


// test('Open LinkedIn in existing Chrome', async () => {
//     const { page } = await connectToExistingChrome();

//     await page.goto(linkedinUrl, {
//         waitUntil: 'domcontentloaded',
//     });

//     await expect(page).toHaveURL(/linkedin\.com/);
// });