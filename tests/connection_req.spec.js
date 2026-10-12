import { test, expect } from '@playwright/test';
import { openLinkedIn } from '../utils/loginUtils.js';
import { discoverPeople } from '../functions/discoverPeople.js';


test('Discover LinkedIn candidates and send requests', async ({ page }, testInfo) => {
    test.setTimeout(300000);

    await openLinkedIn(page, testInfo);
    await page.waitForTimeout(5000);

    const { candidates, sent, skipped } = await discoverPeople(
        page,
        testInfo,
        'Oracle'
    );

    expect(Array.isArray(candidates)).toBe(true);

    console.log(`Candidates: ${candidates.length}`);
    console.log(`Sent: ${sent.length}`, sent);
    console.log(`Skipped: ${skipped.length}`, skipped);
});
// test('Open LinkedIn in existing Chrome', async () => {
//     const { page } = await connectToExistingChrome();

//     await page.goto(linkedinUrl, {
//         waitUntil: 'domcontentloaded',
//     });

//     await expect(page).toHaveURL(/linkedin\.com/);
// });