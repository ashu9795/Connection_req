import { sendConnectionRequests } from './sendConnectionRequests.js';
import { exportToExcel } from './exportToExcel.js';

export async function discoverPeople(page, logger, companyName, maxCandidates) {
    if (typeof companyName !== 'string' || !companyName.trim()) {
        throw new Error('Please provide a valid company name.');
    }

    if (!Number.isInteger(maxCandidates) || maxCandidates < 1) {
        throw new Error('MAX_CONNECTIONS_TO_REVIEW must be a positive integer.');
    }

    const company = companyName.trim();

    logger.info(`Starting people discovery: ${company}`);

    await page.goto(
        `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(company)}`,
        { waitUntil: 'domcontentloaded' }
    );

    logger.info('People search opened');

    const inviteLinks = page.getByRole('link', {
        name: /^Invite .+ to connect$/i,
    });

    await inviteLinks
        .first()
        .waitFor({ state: 'visible', timeout: 15000 })
        .catch(() => {});

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
        logger.warn(`No candidates found for ${company}. Nothing to send.`);
        return { candidates: [], sent: [], skipped: [], limitReached: false };
    }

    logger.info('Sending connection requests...');

    const { sent, skipped, limitReached } = await sendConnectionRequests(
        page,
        logger,
        results
    );

    await exportToExcel({
        rows: sent.map((name) => ({ name, company })),
        columns: [
            { header: 'Name', key: 'name', width: 30 },
            { header: 'Company', key: 'company', width: 30 },
        ],
        fileName: 'connection_requests.xlsx',
        sheetName: 'Connection Requests',
        uniqueKeys: ['name', 'company'],
        logger,
    });

    return { candidates: results, sent, skipped, limitReached };
}