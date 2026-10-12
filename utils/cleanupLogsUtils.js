
import fs from 'node:fs';
import path from 'node:path';

/**
 * Retains the newest log files and deletes older ones.
 *
 * @param {string} logDir - Directory containing log files.
 * @param {number} maxLogFiles - Maximum number of log files to retain.
 */
export function cleanupOldLogs(logDir, maxLogFiles) {
    if (!Number.isInteger(maxLogFiles) || maxLogFiles < 1) {
        throw new Error('maxLogFiles must be a positive integer.');
    }

    if (!fs.existsSync(logDir)) {
        return;
    }

    const logFiles = fs.readdirSync(logDir, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.endsWith('.log'))
        .map(entry => {
            const filePath = path.join(logDir, entry.name);

            return {
                path: filePath,
                modifiedAt: fs.statSync(filePath).mtimeMs
            };
        })
        .sort((a, b) => b.modifiedAt - a.modifiedAt);


    const filesToDelete = logFiles.slice(maxLogFiles - 1);

    for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
    }
}
