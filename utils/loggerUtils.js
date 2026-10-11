
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

export function createLogger(testInfo, page, { enabled = true } = {}) {
    if (!enabled) {
        return {
            info() {},
            warn() {},
            error() {},
            api() {},
            close() {},
        };
    }

    fs.mkdirSync(logDir, { recursive: true });

    const date = new Date();
    const dateTime = date.toISOString().replace(/[:.]/g, '-');

    const fileName =
        `${safeFileName(testInfo.title)}_${dateTime}.log`;

    const filePath = path.join(logDir, fileName);

    function write(level, message) {
        const line = `[${timestamp()}] [${level}] ${message}\n`;

        fs.appendFileSync(filePath, line, 'utf8');
        console.log(line.trim());
    }

    write('INFO', `TEST STARTED: ${testInfo.title}`);

    // Log API responses and their HTTP status codes.
    const onResponse = (response) => {
        const request = response.request();

        write(
            'API',
            `${request.method()} ${response.status()} ${response.url()}`
        );
    };

    // Log failed network requests.
    const onRequestFailed = (request) => {
        write(
            'ERROR',
            `REQUEST FAILED: ${request.method()} ${request.url()} | ${request.failure()?.errorText ?? 'Unknown error'}`
        );
    };

    page.on('response', onResponse);
    page.on('requestfailed', onRequestFailed);

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
            page.off('response', onResponse);
            page.off('requestfailed', onRequestFailed);
            write('INFO', 'LOGGER CLOSED');
        },

        filePath,
    };
}
