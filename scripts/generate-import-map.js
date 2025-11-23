#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import path from 'path';
import { fileURLToPath } from 'url';

const IMPORT_MAP_PATH = 'web/import-map.json';
const IMPORT_MAP_TAG = '<script type="importmap" src="import-map.json"></script>';
const IMPORT_MAP_REGEX = /<script[^>]*type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i;

export function generateImportMap() {
    const htmlFiles = glob.sync('web/*.html');
    const union = new Map();
    const filesWithImportMap = [];

    htmlFiles.forEach(file => {
        const content = readFileSync(file, 'utf8');
        const match = content.match(IMPORT_MAP_REGEX);
        if (!match)
            return;
        try {
            const parsed = JSON.parse(match[1]);
            if (parsed.imports)
                Object.entries(parsed.imports).forEach(([key, value]) => {
                    union.set(key, value);
                });
            filesWithImportMap.push({file, content});
        } catch (error) {
            console.warn(`Skipping ${file}: failed to parse import map JSON`);
        }
    });

    if (!union.size) {
        console.warn(
            'No inline import maps found under web/*.html; skipping shared map generation.',
        );
        return {imports: {}};
    }

    const sorted = [...union.entries()].sort(([a], [b]) => a.localeCompare(b));
    const imports = Object.fromEntries(sorted);
    writeFileSync(IMPORT_MAP_PATH, `${JSON.stringify({imports}, null, 2)}\n`);

    filesWithImportMap.forEach(({file, content}) => {
        const newContent = content.replace(IMPORT_MAP_REGEX, match => {
            const indent = match.match(/^\s*/m)?.[0] ?? '';
            return `${indent}${IMPORT_MAP_TAG}`;
        });
        if (newContent !== content)
            writeFileSync(file, newContent);
    });

    console.log(`✓ Generated shared import map at ${IMPORT_MAP_PATH}`);
    console.log(`✓ Updated ${filesWithImportMap.length} HTML files to reference it`);
    return {imports};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    generateImportMap();
}
