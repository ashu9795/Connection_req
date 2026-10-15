import { test, expect } from '@playwright/test';
import path from 'node:path';

import config from '../config/configuration.json' with { type: 'json' };
import { createLogger } from '../utils/loggerUtils.js';
import { openLinkedIn } from '../utils/loginUtils.js';
import { discoverPeople } from '../functions/discoverPeople.js';
import { readExcelColumn } from '../utils/excelUtils.js';

const randomDelay = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

const errorMessage = (error) =>
    error instanceof Error ? error.message : String(error);

test('Send LinkedIn connection requests by company', async ({ page }, testInfo) => {
    const logger = createLogger(testInfo, page, {
        enabled: config.ENABLE_LOGGER,
    });

    try {
        const excelPath = path.resolve(process.cwd(), 'asset', 'company_name.xlsx');
        const companyNames = readExcelColumn(excelPath, 'name');

        if (companyNames.length === 0) {
            throw new Error('No company names found in company_name.xlsx.');
        }

        const maxCandidates = config.MAX_CONNECTIONS_TO_REVIEW;

        test.setTimeout(
            120000 + companyNames.length * (maxCandidates * 15000 + 30000)
        );

        logger.info(`Companies loaded: ${companyNames.length}`);
        logger.info(`Maximum candidates per company: ${maxCandidates}`);

        await openLinkedIn(page, testInfo, logger);
        await page.waitForTimeout(5000);

        const allResults = [];

        for (const companyName of companyNames) {
            logger.info(`Processing company: ${companyName}`);

            let result;

            try {
                result = await discoverPeople(
                    page,
                    logger,
                    companyName,
                    maxCandidates
                );
            } catch (error) {
                logger.error(`Company failed: ${companyName} - ${errorMessage(error)}`);

                allResults.push({
                    company: companyName,
                    candidates: [],
                    sent: [],
                    skipped: [],
                    limitReached: false,
                    failed: true,
                });

                continue;
            }

            allResults.push({ company: companyName, failed: false, ...result });

            console.log(`${companyName}: ${result.candidates.length} candidates`);
            logger.info(`Finished processing: ${companyName}`);

            if (result.limitReached) {
                logger.warn('Weekly invitation limit reached. Stopping all companies.');
                break;
            }

            await page.waitForTimeout(randomDelay(5000, 10000));
        }

        console.log('\nFinal summary:');

        for (const result of allResults) {
            const line =
                `${result.company} | Candidates: ${result.candidates.length}` +
                ` | Sent: ${result.sent.length}` +
                ` | Skipped: ${result.skipped.length}` +
                (result.failed ? ' | FAILED' : '');

            console.log(line);
            logger.info(line);
        }

        expect(allResults.some((result) => !result.failed)).toBe(true);
    } catch (error) {
        logger.error(`Workflow failed: ${errorMessage(error)}`);
        throw error;
    } finally {
        logger.close();
    }
});




// test('Open LinkedIn in existing Chrome', async () => {
//     const { page } = await connectToExistingChrome();

//     await page.goto(linkedinUrl, {
//         waitUntil: 'domcontentloaded',
//     });

//     await expect(page).toHaveURL(/linkedin\.com/);
// });