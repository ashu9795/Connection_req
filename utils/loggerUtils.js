
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../config/configuration.json' with { type: 'json' };

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.resolve(currentDir, '../logger');

function timestamp() {
    return new Date().toISOString();
}

function safeFileName(name) {
    return name
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 100);
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

    fs.mkdirSync(logDir, { recursive: true });

    const dateTime = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${safeFileName(testInfo.title)}_${dateTime}.log`;
    const filePath = path.join(logDir, fileName);

    function write(level, message) {
        const line = `[${timestamp()}] [${level}] ${message}\n`;

        fs.appendFileSync(filePath, line, 'utf8');
        console.log(line.trim());
    }

    write('INFO', `TEST STARTED: ${testInfo.title}`);

    const isApiRequest = (request) =>
        ['xhr', 'fetch'].includes(request.resourceType());

    const onResponse = (response) => {
        const request = response.request();

        if (!isApiRequest(request)) return;

        write(
            'API',
            `${request.method()} ${response.status()} ${response.url()}`
        );
    };

    const onRequestFailed = (request) => {
        if (!isApiRequest(request)) return;

        write(
            'API',
            `REQUEST FAILED: ${request.method()} ${request.url()} | ${
                request.failure()?.errorText ?? 'Unknown error'
            }`
        );
    };

    if (config.API_CALL_LOGGER) {
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
            if (config.API_CALL_LOGGER) {
                page.off('response', onResponse);
                page.off('requestfailed', onRequestFailed);
            }

            write('INFO', 'LOGGER CLOSED');
        },

        filePath,
    };
}
