#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const files = glob.sync('web/*.html').filter(file =>
    !file.includes('index.html') && !file.includes('arrow-designer.html')
);

files.forEach(file => {
    let content = readFileSync(file, 'utf8');
    let modified = false;

    // Remove old graphlib-dot script tags
    const scriptPatterns = [
        /<script[^>]*src="js\/graphlib-dot\.js"[^>]*><\/script>\s*/g,
        /<script[^>]*src="js\/graphlib-dot\.min\.js"[^>]*><\/script>\s*/g,
    ];

    scriptPatterns.forEach(pattern => {
        if (pattern.test(content)) {
            content = content.replace(pattern, '');
            modified = true;
            console.log(`✓ Removed old graphlib-dot script tag from ${file}`);
        }
    });

    // Check if file has import maps
    if (!content.includes('"imports"')) {
        if (modified) writeFileSync(file, content);
        console.log(`Skipping import map addition for ${file} - no import maps`);
        return;
    }

    // Check if graphlib-dot is already added
    if (content.includes('"graphlib-dot"')) {
        if (modified) writeFileSync(file, content);
        console.log(`Skipping import map addition for ${file} - graphlib-dot already present`);
        return;
    }

    // Find the @dagrejs/dagre line and add graphlib-dot after it
    const dagrePattern = /(\s*"@dagrejs\/dagre":\s*"[^"]+",?\s*\n)/;
    const match = content.match(dagrePattern);

    if (match) {
        const dagreLine = match[1];
        const replacement =
            `${dagreLine}      "graphlib-dot": "https://cdn.jsdelivr.net/npm/graphlib-dot@0.6.4/+esm",\n      "lodash": "https://cdn.jsdelivr.net/npm/lodash@4.17.21/+esm",\n      "graphlib": "https://cdn.jsdelivr.net/npm/graphlib@2.1.8/+esm",\n`;
        content = content.replace(dagrePattern, replacement);
        modified = true;
        console.log(`✓ Added graphlib-dot and its dependencies to import map in ${file}`);
    } else {
        console.log(`⚠ Could not find @dagrejs/dagre in ${file}`);
    }

    if (modified) {
        writeFileSync(file, content);
    }
});
