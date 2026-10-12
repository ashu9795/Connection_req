import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

export async function exportToExcel({
    rows,
    columns,
    fileName = 'export.xlsx',
    sheetName = 'Sheet1',
    outputDir = 'output',
    uniqueKeys = [],
    logger = console,
}) {
    const dir = path.resolve(outputDir);
    const filePath = path.join(dir, fileName);

    if (!Array.isArray(rows) || rows.length === 0) {
        logger.info('No rows to export.');
        return { filePath, added: 0, skipped: 0 };
    }

    if (!Array.isArray(columns) || columns.length === 0) {
        throw new Error('columns is required, e.g. [{ header: "Name", key: "name" }]');
    }

    fs.mkdirSync(dir, { recursive: true });

    const workbook = new ExcelJS.Workbook();

    if (fs.existsSync(filePath)) {
        await workbook.xlsx.readFile(filePath);
    }

    let sheet = workbook.getWorksheet(sheetName);

    if (!sheet) {
        sheet = workbook.addWorksheet(sheetName);
    }

    const headerRow = sheet.getRow(1);
    const colIndex = {};

    headerRow.eachCell((cell, colNumber) => {
        colIndex[String(cell.value ?? '').trim()] = colNumber;
    });

    for (const col of columns) {
        if (!colIndex[col.header]) {
            const used = Object.values(colIndex);
            const next = used.length > 0 ? Math.max(...used) + 1 : 1;

            const cell = headerRow.getCell(next);
            cell.value = col.header;
            cell.font = { bold: true };

            sheet.getColumn(next).width = col.width ?? 25;
            colIndex[col.header] = next;
        }
    }

    headerRow.commit();

    const headerByKey = Object.fromEntries(columns.map((c) => [c.key, c.header]));

    const normalize = (value) => String(value ?? '').trim().toLowerCase();

    const existing = new Set();

    if (uniqueKeys.length > 0) {
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;

            const signature = uniqueKeys
                .map((key) => normalize(row.getCell(colIndex[headerByKey[key]]).value))
                .join('|');

            existing.add(signature);
        });
    }

    let added = 0;
    let skipped = 0;

    for (const row of rows) {
        if (uniqueKeys.length > 0) {
            const signature = uniqueKeys.map((key) => normalize(row[key])).join('|');

            if (existing.has(signature)) {
                skipped++;
                continue;
            }

            existing.add(signature);
        }

        const newRow = sheet.addRow([]);

        for (const col of columns) {
            newRow.getCell(colIndex[col.header]).value = row[col.key] ?? '';
        }

        newRow.commit();
        added++;
    }

    await workbook.xlsx.writeFile(filePath);

    logger.info(`Excel updated: ${added} added, ${skipped} duplicates skipped -> ${filePath}`);

    return { filePath, added, skipped };
}