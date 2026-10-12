import 'dotenv/config';
import config from '../config/configuration.json' with { type: 'json' };
import { createLogger } from '../utils/loggerUtils.js';
import { sendConnectionRequests } from './sendConnectionRequests.js';
import { exportToExcel } from './exportToExcel.js';

export async function discoverPeople(page, testInfo, companyName) {
    const logger = createLogger(testInfo, page);
   

    try {
        if (typeof companyName !== 'string' || !companyName.trim()) {
            throw new Error('Please provide a valid company name.');
        }

        const maxCandidates = config.MAX_CONNECTIONS_TO_REVIEW;

        if (!Number.isInteger(maxCandidates) || maxCandidates < 1) {
            throw new Error('MAX_CONNECTIONS_TO_REVIEW must be a positive integer.');
        }

        logger.info(`Starting people discovery: ${companyName}`);

        const searchInput = page.getByTestId('typeahead-input');

        await searchInput.waitFor({ state: 'visible', timeout: 15000 });
        await searchInput.fill(companyName.trim());
        await searchInput.press('Enter');

        logger.info('Company search submitted');

        const peopleFilter = page.getByRole('radio', {
            name: 'Filter by People',
        });

        await peopleFilter.waitFor({ state: 'visible', timeout: 15000 });
        await peopleFilter.click();

        logger.info('People filter selected');

        await page.waitForTimeout(2000);

        const inviteLinks = page.getByRole('link', {
            name: /^Invite .+ to connect$/i,
        });

        const candidates = new Set();
        const maxScrollRounds = 8;
        let staleRounds = 0;

        for (let round = 0; round < maxScrollRounds; round++) {
            const linkCount = await inviteLinks.count();
            const sizeBefore = candidates.size;

            logger.info(`Search results round ${round + 1}: ${linkCount} invitation links`);

            for (let i = 0; i < linkCount; i++) {
                const link = inviteLinks.nth(i);

                if (!(await link.isVisible().catch(() => false))) {
                    continue;
                }

                const label = await link.getAttribute('aria-label');

                if (label) {
                    const name = label
                        .replace(/^Invite\s+/i, '')
                        .replace(/\s+to connect$/i, '')
                        .trim();

                    if (name) candidates.add(name);
                }

                if (candidates.size >= maxCandidates) {
                    break;
                }
            }

            logger.info(`Candidates discovered: ${candidates.size}/${maxCandidates}`);

            if (candidates.size >= maxCandidates) {
                break;
            }

            if (candidates.size === sizeBefore) {
                staleRounds++;
                if (staleRounds >= 2) {
                    logger.info('No new candidates after scrolling. Stopping.');
                    break;
                }
            } else {
                staleRounds = 0;
            }

            await page.evaluate(() => {
                window.scrollBy({
                    top: Math.floor(window.innerHeight * 0.75),
                    behavior: 'instant',
                });
            });

            await page.waitForTimeout(1000);
        }

        const results = [...candidates];

        logger.info(`Discovery completed: ${results.length} candidates`);

        results.forEach((candidate, index) => {
            logger.info(`Candidate ${index + 1}: ${candidate}`);
        });

        if (results.length === 0) {
            logger.warn('No candidates found. Nothing to send.');
            return { candidates: [], sent: [], skipped: [] };
        }

        logger.info('Sending connection requests...');

        const { sent, skipped } = await sendConnectionRequests(
            page,
            logger,
            results
        );

        await exportToExcel({
    rows: sent.map((name) => ({ name, company: companyName })),
    columns: [
        { header: 'Name', key: 'name', width: 30 },
        { header: 'Company', key: 'company', width: 30 },
    ],
    fileName: 'connection_requests.xlsx',
    sheetName: 'Connection Requests',
    uniqueKeys: ['name', 'company'],
    logger,
});

        return { candidates: results, sent, skipped };
    } catch (error) {
        logger.error(
            `People discovery failed: ${
                error instanceof Error ? error.message : String(error)
            }`
        );

        throw error;
    } finally {
        logger.close();
    }
}