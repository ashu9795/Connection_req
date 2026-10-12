
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import config from '../config/configuration.json' with { type: 'json' };
import { cleanupOldLogs } from './cleanupLogsUtils.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.resolve(currentDir, '../logger');
const REDACTED = '[REDACTED]';

export function prepareLoggerDirectory() {
    if (!config.ENABLE_LOGGER) {
        return;
    }

    fs.mkdirSync(logDir, { recursive: true });
    cleanupOldLogs(logDir, config.MAX_LOG_FILES);
}

function timestamp() {
    return new Date().toISOString();
}

function safeFileName(name) {
    return String(name)
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 100);
}

/**
 * Mask non-empty environment variable values in log messages.
 */
function redactSecrets(message) {
    let result = String(message);

    const secrets = Object.entries(process.env)
        .filter(([key, value]) =>
            /PASSWORD|PASSWD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|CLIENT_SECRET|AUTH/i.test(key)
            && typeof value === 'string'
            && value.length >= 3
        )
        .map(([, value]) => value)
        .sort((a, b) => b.length - a.length);

    for (const secret of secrets) {
        const variants = new Set([secret]);

        try {
            variants.add(encodeURIComponent(secret));
        } catch {
            // Keep the original secret if encoding fails.
        }

        for (const variant of variants) {
            result = result.split(variant).join(REDACTED);
        }
    }

    return result;
}

export function createLogger(testInfo, page) {
    if (!config.ENABLE_LOGGER) {
        return {
            info() {},
            warn() {},
            error() {},
            api() {},
            close() {},
        };
    }

    if (!testInfo?.title) {
        throw new Error(
            'createLogger requires valid Playwright testInfo.'
        );
    }

    prepareLoggerDirectory();

    const dateTime = new Date()
        .toISOString()
        .replace(/[:.]/g, '-');

    const fileName =
        `${safeFileName(testInfo.title)}_${dateTime}.log`;

    const filePath = path.join(logDir, fileName);

    let closed = false;

    function write(level, message) {
        if (closed) {
            return;
        }

        const safeMessage = redactSecrets(message);
        const line =
            `[${timestamp()}] [${level}] ${safeMessage}\n`;

        fs.appendFileSync(filePath, line, 'utf8');
        console.log(line.trim());
    }

    write('INFO', `TEST STARTED: ${testInfo.title}`);

    const isApiRequest = (request) =>
        ['xhr', 'fetch'].includes(request.resourceType());

    const onResponse = (response) => {
        const request = response.request();

        if (!isApiRequest(request)) {
            return;
        }

        write(
            'API',
            `${request.method()} ${response.status()} ${response.url()}`
        );
    };

    const onRequestFailed = (request) => {
        if (!isApiRequest(request)) {
            return;
        }

        write(
            'API',
            `REQUEST FAILED: ${request.method()} ${request.url()} | ${
                request.failure()?.errorText ?? 'Unknown error'
            }`
        );
    };

    const apiLoggingEnabled =
        Boolean(config.API_CALL_LOGGER) &&
        Boolean(page?.on) &&
        Boolean(page?.off);

    if (apiLoggingEnabled) {
        page.on('response', onResponse);
        page.on('requestfailed', onRequestFailed);
    }

    return {
        info(message) {
            write('INFO', message);
        },

        warn(message) {
            write('WARN', message);
        },

        error(message) {
            write('ERROR', message);
        },

        api(message) {
            write('API', message);
        },

        close() {
            if (closed) {
                return;
            }

            if (apiLoggingEnabled) {
                page.off('response', onResponse);
                page.off('requestfailed', onRequestFailed);
            }

            write('INFO', 'LOGGER CLOSED');
            closed = true;
        },

        filePath,
    };
}
