import fs from 'node:fs';
import path from 'node:path';

import config from '../config/configuration.json' with { type: 'json' };

const MESSAGE_FILE = path.resolve(process.cwd(), 'asset', 'requestMesage.txt');

const randomDelay = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

function loadMessage(logger) {
    if (!fs.existsSync(MESSAGE_FILE)) {
        throw new Error(`REQUEST_MESSAGE is true but file not found: ${MESSAGE_FILE}`);
    }

    const message = fs.readFileSync(MESSAGE_FILE, 'utf8').trim();

    if (!message) {
        throw new Error('REQUEST_MESSAGE is true but requestMesage.txt is empty.');
    }

    if (message.length > 200) {
        logger.warn(
            `Message is ${message.length} characters. Free accounts allow only 200, so Send may be disabled.`
        );
    }

    return message;
}

function buildMessage(template, name) {
    const firstName = name.split(/\s+/)[0] ?? name;

    return template
        .replace(/\{firstName\}/gi, firstName)
        .replace(/\{name\}/gi, name);
}

async function waitForOutcome(page, targetButton) {
    const limitDialog = page.getByText(/weekly invitation limit/i);

    return Promise.race([
        targetButton.waitFor({ state: 'visible', timeout: 8000 }).then(() => 'modal'),
        limitDialog.waitFor({ state: 'visible', timeout: 8000 }).then(() => 'limit'),
    ]).catch(() => 'none');
}

async function sendOne(page, name, logger, messageTemplate) {
    const inviteLink = page.getByRole('link', {
        name: `Invite ${name} to connect`,
        exact: true,
    });

    if (!(await inviteLink.isVisible().catch(() => false))) {
        logger.warn(`Invite link not found for: ${name}`);
        return 'skipped';
    }

    await inviteLink.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await inviteLink.click();

    const withNote = Boolean(messageTemplate);

    const firstButton = withNote
        ? page.getByRole('button', { name: 'Add a note' })
        : page.getByRole('button', { name: 'Send without a note' });

    const result = await waitForOutcome(page, firstButton);

    if (result === 'limit') {
        logger.error('Weekly invitation limit reached. Stopping.');
        await page.keyboard.press('Escape');
        return 'limit';
    }

    if (result === 'none') {
        logger.warn(
            `No "${withNote ? 'Add a note' : 'Send without a note'}" button for: ${name}. Skipping.`
        );
        await page.keyboard.press('Escape');
        return 'skipped';
    }

    await firstButton.click();

    if (withNote) {
        const noteBox = page.getByRole('textbox', {
            name: /limit personal note/i,
        });

        await noteBox.waitFor({ state: 'visible', timeout: 8000 });
        await noteBox.click();
        await noteBox.fill(buildMessage(messageTemplate, name));

        const sendInvitation = page.getByRole('button', {
            name: /send invitation/i,
        });

        await sendInvitation.click();
        await sendInvitation.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
    } else {
        await firstButton.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
    }

    logger.info(`Connection request sent${withNote ? ' with note' : ''}: ${name}`);
    return 'sent';
}

export async function sendConnectionRequests(page, logger, names) {
    const summary = { sent: [], skipped: [], limitReached: false };

    const messageTemplate = config.REQUEST_MESSAGE === true ? loadMessage(logger) : null;

    for (const name of names) {
        let status;

        try {
            status = await sendOne(page, name, logger, messageTemplate);
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