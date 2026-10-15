import { sendConnectionRequests } from './sendConnectionRequests.js';
import { exportToExcel } from './exportToExcel.js';

async function loadMoreResults(page, inviteLinks) {
    const before = await inviteLinks.count();

    if (before > 0) {
        await inviteLinks.last().scrollIntoViewIfNeeded().catch(() => {});
    }

    await page.mouse.move(640, 400);
    await page.mouse.wheel(0, 1200);

    const deadline = Date.now() + 5000;

    while (Date.now() < deadline) {
        await page.waitForTimeout(500);

        if ((await inviteLinks.count()) > before) {
            return true;
        }

        await page.mouse.wheel(0, 600);
    }

    return false;
}

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
    const maxScrollRounds = 12;
    let staleRounds = 0;

    for (let round = 0; round < maxScrollRounds; round++) {
        const linkCount = await inviteLinks.count();

        logger.info(`Search results round ${round + 1}: ${linkCount} invitation links`);

        for (let i = 0; i < linkCount; i++) {
            const label = await inviteLinks
                .nth(i)
                .getAttribute('aria-label', { timeout: 2000 })
                .catch(() => null);

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

        const loadedMore = await loadMoreResults(page, inviteLinks);

        if (!loadedMore) {
            staleRounds++;

            if (staleRounds >= 2) {
                logger.info('No more results are loading. Stopping.');
                break;
            }
        } else {
            staleRounds = 0;
        }
    }

    const results = [...candidates].slice(0, maxCandidates);

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