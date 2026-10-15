const randomDelay = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

async function sendOne(page, name, logger) {
    const inviteLink = page.getByRole('link', {
        name: `Invite ${name} to connect`,
        exact: true,
    });

    if (!(await inviteLink.isVisible().catch(() => false))) {
        logger.warn(`Invite link not found for: ${name}`);
        return 'skipped';
    }

    await inviteLink.scrollIntoViewIfNeeded();
    await inviteLink.click();

    const limitDialog = page.getByText(/weekly invitation limit/i);
    const sendBtn = page.getByRole('button', { name: 'Send without a note' });

    const result = await Promise.race([
        sendBtn.waitFor({ state: 'visible', timeout: 8000 }).then(() => 'modal'),
        limitDialog.waitFor({ state: 'visible', timeout: 8000 }).then(() => 'limit'),
    ]).catch(() => 'none');

    if (result === 'limit') {
        logger.error('Weekly invitation limit reached. Stopping.');
        await page.keyboard.press('Escape');
        return 'limit';
    }

    if (result === 'none') {
        logger.warn(`No "Send without a note" button for: ${name}. Skipping.`);
        await page.keyboard.press('Escape');
        return 'skipped';
    }

    await sendBtn.click();
    await sendBtn.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});

    logger.info(`Connection request sent: ${name}`);
    return 'sent';
}

export async function sendConnectionRequests(page, logger, names) {
    const summary = { sent: [], skipped: [], limitReached: false };

    for (const name of names) {
        let status;

        try {
            status = await sendOne(page, name, logger);
        } catch (error) {
            logger.error(
                `Failed to send to ${name}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            await page.keyboard.press('Escape').catch(() => {});
            status = 'skipped';
        }

        if (status === 'limit') {
            summary.limitReached = true;
            break;
        }

        if (status === 'sent') summary.sent.push(name);
        else summary.skipped.push(name);

        await page.waitForTimeout(randomDelay(3000, 8000));
    }

    logger.info(
        `Done. Sent: ${summary.sent.length}, Skipped: ${summary.skipped.length}`
    );

    return summary;
}