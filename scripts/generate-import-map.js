#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const SOURCE_MAP_PATH = 'src/import-map.json';
const OUTPUT_MAP_PATH = 'web/import-map.json';
const IMPORT_MAP_REGEX = /<script[^>]*type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i;
const INLINE_INDENT = '      ';

function readSourceImportMap() {
    if (!existsSync(SOURCE_MAP_PATH))
        throw new Error(`Source import map not found at ${SOURCE_MAP_PATH}`);
    const parsed = JSON.parse(readFileSync(SOURCE_MAP_PATH, 'utf8'));
    if (!parsed.imports)
        throw new Error(`${SOURCE_MAP_PATH} is missing the "imports" key`);
    return parsed;
}

function formatInlineImportMap(map, indent = INLINE_INDENT) {
    const jsonText = JSON.stringify(map, null, 2)
        .split('\n')
        .map(line => `${indent}${line}`)
        .join('\n');
    // Match Prettier’s style: closing tag aligned with its opening indent (no extra spaces)
    return `<script type="importmap">\n${jsonText}\n    </script>`;
}

export function generateImportMap() {
    const htmlFiles = glob.sync('web/*.html');
    const map = readSourceImportMap();

    let htmlsUpdated = 0;
    htmlFiles.forEach(file => {
        const content = readFileSync(file, 'utf8');
        const match = content.match(IMPORT_MAP_REGEX);
        if (!match)
            return;
        const newContent = content.replace(IMPORT_MAP_REGEX, formatInlineImportMap(map));
        if (newContent !== content) {
            writeFileSync(file, newContent);
            htmlsUpdated += 1;
        }
    });

    const canonical = `${JSON.stringify(map, null, 2)}\n`;
    if (!existsSync(OUTPUT_MAP_PATH) || readFileSync(OUTPUT_MAP_PATH, 'utf8') !== canonical) {
        writeFileSync(OUTPUT_MAP_PATH, canonical);
    }

    console.log(`✓ Synced import map from ${SOURCE_MAP_PATH} to HTML and ${OUTPUT_MAP_PATH}`);
    console.log(`✓ Updated ${htmlsUpdated} HTML files with inline import maps`);
    return map;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    generateImportMap();
}
