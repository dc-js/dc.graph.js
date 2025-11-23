#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const IMPORT_MAP_PATH = 'web/import-map.json';
const IMPORT_MAP_REGEX = /<script[^>]*type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i;
const INLINE_INDENT = '      ';

function readCanonicalImportMap() {
    if (!existsSync(IMPORT_MAP_PATH))
        return null;
    const parsed = JSON.parse(readFileSync(IMPORT_MAP_PATH, 'utf8'));
    if (!parsed.imports)
        throw new Error(`${IMPORT_MAP_PATH} is missing the "imports" key`);
    return parsed;
}

function collectImportsFromHtml(htmlFiles) {
    const merged = new Map();
    htmlFiles.forEach(file => {
        const content = readFileSync(file, 'utf8');
        const match = content.match(IMPORT_MAP_REGEX);
        if (!match)
            return;
        try {
            const parsed = JSON.parse(match[1]);
            if (parsed.imports)
                Object.entries(parsed.imports).forEach(([key, value]) => merged.set(key, value));
        } catch (error) {
            console.warn(`Skipping ${file}: failed to parse import map JSON`);
        }
    });
    if (!merged.size)
        return null;
    return {
        imports: Object.fromEntries([...merged.entries()].sort(([a], [b]) => a.localeCompare(b))),
    };
}

function formatInlineImportMap(map, indent = INLINE_INDENT) {
    const jsonText = JSON.stringify(map, null, 2)
        .split('\n')
        .map(line => `${indent}${line}`)
        .join('\n');
    // Match Prettier’s style: closing tag aligned with its opening indent (no extra spaces)
    const closingIndent = indent.slice(0, -2) || '';
    return `<script type="importmap">\n${jsonText}\n${closingIndent}</script>`;
}

export function generateImportMap() {
    const htmlFiles = glob.sync('web/*.html');
    let map = readCanonicalImportMap();

    if (!map) {
        map = collectImportsFromHtml(htmlFiles);
        if (!map) {
            console.warn('No import map definitions found; skipping generation.');
            return {imports: {}};
        }
        writeFileSync(IMPORT_MAP_PATH, `${JSON.stringify(map, null, 2)}\n`);
        console.log(`✓ Created canonical import map at ${IMPORT_MAP_PATH}`);
    }

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

    const canonical = JSON.stringify(map, null, 2);
    if (
        !existsSync(IMPORT_MAP_PATH) || readFileSync(IMPORT_MAP_PATH, 'utf8').trim() !== canonical
    ) {
        writeFileSync(IMPORT_MAP_PATH, `${canonical}\n`);
    }

    console.log(`✓ Ensured shared import map at ${IMPORT_MAP_PATH}`);
    console.log(`✓ Updated ${htmlsUpdated} HTML files with inline import maps`);
    return map;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    generateImportMap();
}
