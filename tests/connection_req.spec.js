
import { test } from '@playwright/test';
import { openLinkedIn } from '../utils/loginUtils.js';

test('Open LinkedIn', async ({ page }, testInfo) => {
    await openLinkedIn(page, testInfo);
});
