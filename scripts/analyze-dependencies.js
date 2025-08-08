#!/usr/bin/env node

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import fs from 'fs';
import { glob } from 'glob';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Track different types of dependencies
const dependencies = {
    imports: new Map(), // ES6 imports
    requires: new Map(), // CommonJS requires
    globals: new Map(), // Global variable usage
    scripts: new Map(), // <script> tag imports
    importMaps: new Map(), // Import map declarations
    workers: new Map(), // importScripts in workers
};

// Track where each dependency is used
const usageMap = new Map();

function addUsage(type, name, file, line, context) {
    const key = `${type}:${name}`;
    if (!usageMap.has(key)) {
        usageMap.set(key, []);
    }
    usageMap.get(key).push({file, line, context});
}

// Parse JavaScript files for imports/requires
async function analyzeJSFile(filepath) {
    try {
        const content = fs.readFileSync(filepath, 'utf8');
        const ast = parse(content, {
            sourceType: 'unambiguous',
            plugins: ['jsx', 'typescript'],
            errorRecovery: true,
        });

        const relativePath = path.relative(projectRoot, filepath);

        traverse.default(ast, {
            // ES6 imports
            ImportDeclaration(nodePath) {
                const source = nodePath.node.source.value;
                const line = nodePath.node.loc?.start.line || 0;
                addUsage('import', source, relativePath, line, content.split('\n')[line-1]?.trim());
            },

            // Dynamic imports
            CallExpression(nodePath) {
                if (nodePath.node.callee.type === 'Import' && nodePath.node.arguments[0]?.value) {
                    const source = nodePath.node.arguments[0].value;
                    const line = nodePath.node.loc?.start.line || 0;
                    addUsage(
                        'dynamic-import',
                        source,
                        relativePath,
                        line,
                        content.split('\n')[line-1]?.trim(),
                    );
                } // CommonJS requires
                else if (
                    nodePath.node.callee.name === 'require'
                    && nodePath.node.arguments[0]?.value
                ) {
                    const source = nodePath.node.arguments[0].value;
                    const line = nodePath.node.loc?.start.line || 0;
                    addUsage(
                        'require',
                        source,
                        relativePath,
                        line,
                        content.split('\n')[line-1]?.trim(),
                    );
                }
            },

            // Global variable references (for your specific globals)
            Identifier(nodePath) {
                const globals = [
                    'graphlibDot',
                    'setcola',
                    'Viz',
                    'THREE',
                    'dc_graph',
                    'lysenkoIntervalTree',
                    'metagraph',
                ];
                if (globals.includes(nodePath.node.name) && nodePath.isReferencedIdentifier()) {
                    const line = nodePath.node.loc?.start.line || 0;
                    addUsage(
                        'global',
                        nodePath.node.name,
                        relativePath,
                        line,
                        content.split('\n')[line-1]?.trim(),
                    );
                }
            },
        });
    } catch (error) {
        console.error(`Error parsing ${filepath}: ${error.message}`);
    }
}

// Parse HTML files for script tags and import maps
async function analyzeHTMLFile(filepath) {
    const content = fs.readFileSync(filepath, 'utf8');
    const relativePath = path.relative(projectRoot, filepath);
    const lines = content.split('\n');

    // Find script tags
    const scriptRegex = /<script[^>]*src=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = scriptRegex.exec(content)) !== null) {
        const src = match[1];
        const line = content.substring(0, match.index).split('\n').length;
        addUsage('script', src, relativePath, line, lines[line-1]?.trim());
    }

    // Find import maps
    const importMapRegex = /<script[^>]*type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/gi;
    while ((match = importMapRegex.exec(content)) !== null) {
        try {
            const importMap = JSON.parse(match[1]);
            const line = content.substring(0, match.index).split('\n').length;
            if (importMap.imports) {
                for (const [name, url] of Object.entries(importMap.imports)) {
                    addUsage('importmap', name, relativePath, line, `"${name}": "${url}"`);
                }
            }
        } catch (e) {
            console.error(`Error parsing import map in ${filepath}`);
        }
    }

    // Find inline scripts that might use globals
    const inlineScriptRegex = /<script[^>]*>([^<]+)<\/script>/gi;
    while ((match = inlineScriptRegex.exec(content)) !== null) {
        const scriptContent = match[1];
        const line = content.substring(0, match.index).split('\n').length;
        const globals = [
            'graphlibDot',
            'setcola',
            'Viz',
            'THREE',
            'dc_graph',
            'lysenkoIntervalTree',
            'metagraph',
        ];
        for (const global of globals) {
            if (scriptContent.includes(global)) {
                addUsage(
                    'inline-global',
                    global,
                    relativePath,
                    line,
                    scriptContent.trim().substring(0, 100),
                );
            }
        }
    }
}

// Analyze worker files for importScripts
async function analyzeWorkerFile(filepath) {
    const content = fs.readFileSync(filepath, 'utf8');
    const relativePath = path.relative(projectRoot, filepath);
    const lines = content.split('\n');

    const importScriptsRegex = /importScripts\s*\(\s*["']([^"']+)["']\s*\)/g;
    let match;
    while ((match = importScriptsRegex.exec(content)) !== null) {
        const script = match[1];
        const line = content.substring(0, match.index).split('\n').length;
        addUsage('importScripts', script, relativePath, line, lines[line-1]?.trim());
    }
}

// Generate dependency report
function generateReport() {
    console.log('# Dependency Analysis Report\n');

    // Group by dependency name
    const depGroups = new Map();
    for (const [key, usages] of usageMap.entries()) {
        const [type, name] = key.split(':');
        if (!depGroups.has(name)) {
            depGroups.set(name, new Map());
        }
        depGroups.get(name).set(type, usages);
    }

    // Sort dependencies by name
    const sortedDeps = Array.from(depGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    for (const [depName, types] of sortedDeps) {
        console.log(`\n## ${depName}`);

        for (const [type, usages] of types.entries()) {
            console.log(`\n### Used as: ${type} (${usages.length} occurrences)`);

            // Group by file
            const byFile = new Map();
            for (const usage of usages) {
                if (!byFile.has(usage.file)) {
                    byFile.set(usage.file, []);
                }
                byFile.get(usage.file).push(usage);
            }

            for (const [file, fileUsages] of byFile.entries()) {
                console.log(`\n**${file}:**`);
                for (const usage of fileUsages) {
                    console.log(`  - Line ${usage.line}: \`${usage.context}\``);
                }
            }
        }
    }

    // Summary statistics
    console.log('\n## Summary Statistics\n');
    const stats = new Map();
    for (const [key, usages] of usageMap.entries()) {
        const [type] = key.split(':');
        stats.set(type, (stats.get(type) || 0)+usages.length);
    }

    console.log('| Type | Count |');
    console.log('|------|-------|');
    for (const [type, count] of stats.entries()) {
        console.log(`| ${type} | ${count} |`);
    }
}

// Main analysis function
async function analyze() {
    console.log('Analyzing dependencies...\n');

    // Find all JavaScript files
    const jsFiles = await glob('**/*.js', {
        cwd: projectRoot,
        ignore: ['node_modules/**', 'dist/**', 'doc/**', '**/*.min.js'],
    });

    // Find all HTML files
    const htmlFiles = await glob('**/*.html', {
        cwd: projectRoot,
        ignore: ['node_modules/**', 'dist/**', 'doc/**'],
    });

    // Analyze JS files
    for (const file of jsFiles) {
        const filepath = path.join(projectRoot, file);
        if (file.includes('.worker.js')) {
            await analyzeWorkerFile(filepath);
        } else {
            await analyzeJSFile(filepath);
        }
    }

    // Analyze HTML files
    for (const file of htmlFiles) {
        const filepath = path.join(projectRoot, file);
        await analyzeHTMLFile(filepath);
    }

    // Generate report
    generateReport();

    // Generate specific report for graphlibDot
    console.log('\n\n# Specific Report: graphlibDot\n');
    const graphlibUsages = [];
    for (const [key, usages] of usageMap.entries()) {
        if (key.includes('graphlibDot')) {
            graphlibUsages.push(...usages.map(u => ({...u, type: key.split(':')[0]})));
        }
    }

    if (graphlibUsages.length === 0) {
        console.log('No usages of graphlibDot found.');
    } else {
        console.log(`Found ${graphlibUsages.length} usages of graphlibDot:\n`);
        for (const usage of graphlibUsages) {
            console.log(`- ${usage.type} in ${usage.file}:${usage.line}`);
            console.log(`  ${usage.context}\n`);
        }
    }
}

// Check for required dependencies
try {
    await import('@babel/parser');
    await import('@babel/traverse');
} catch (e) {
    console.error('Missing required dependencies. Please run:');
    console.error('npm install --save-dev @babel/parser @babel/traverse glob');
    process.exit(1);
}

// Run analysis
analyze().catch(console.error);
