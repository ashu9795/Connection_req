
import XLSX from 'xlsx';
import path from 'node:path';

export function readExcel(filePath, options = {}) {
    const resolvedPath = path.resolve(filePath);
    const workbook = XLSX.readFile(resolvedPath);

    const sheetName = options.sheetName ?? workbook.SheetNames[0];

    if (!sheetName || !workbook.Sheets[sheetName]) {
        throw new Error(
            `Worksheet not found: ${sheetName ?? '(none)'}`
        );
    }

    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        defval: '',
        raw: false,
    });
}

export function readExcelColumn(filePath, columnName, options = {}) {
    if (!columnName?.trim()) {
        throw new Error('A column name is required.');
    }

    const rows = readExcel(filePath, options);

    const actualColumn = Object.keys(rows[0] ?? {}).find(
        (key) =>
            key.trim().toLowerCase() === columnName.trim().toLowerCase()
    );

    if (!actualColumn) {
        throw new Error(
            `Column "${columnName}" was not found in ${filePath}.`
        );
    }

    return [
        ...new Set(
            rows
                .map((row) => String(row[actualColumn] ?? '').trim())
                .filter(Boolean)
        ),
    ];
}
