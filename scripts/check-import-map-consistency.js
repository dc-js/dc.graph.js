#!/usr/bin/env node

/**
 * Check import map consistency across all HTML files
 * 
 * This script parses all HTML files in the web/ directory, extracts import maps,
 * and reports any inconsistencies in package versions across files.
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Colors for console output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function colorize(text, color) {
    return colors[color] + text + colors.reset;
}

function extractImportMap(htmlContent) {
    const importMapRegex = /<script\s+type="importmap"[^>]*>([\s\S]*?)<\/script>/gi;
    const match = importMapRegex.exec(htmlContent);
    
    if (!match) {
        return null;
    }
    
    try {
        const importMapContent = match[1].trim();
        return JSON.parse(importMapContent);
    } catch (error) {
        return { error: `Failed to parse import map: ${error.message}` };
    }
}

function extractVersionFromUrl(url) {
    // Match patterns like @1.2.3, @1.2.3-alpha.1, @^1.2.3, @~1.2.3
    const versionMatch = url.match(/@([^\/\+]+)/);
    return versionMatch ? versionMatch[1] : null;
}

function extractPackageFromUrl(url) {
    // Extract package name from jsdelivr URLs
    const jsdelivrMatch = url.match(/jsdelivr\.net\/npm\/([^@\/]+)/);
    if (jsdelivrMatch) {
        return jsdelivrMatch[1];
    }
    
    // Extract scoped package names like @dagrejs/dagre
    const scopedMatch = url.match(/jsdelivr\.net\/npm\/(@[^\/]+\/[^@\/]+)/);
    if (scopedMatch) {
        return scopedMatch[1];
    }
    
    return null;
}

async function checkImportMapConsistency() {
    console.log(colorize('🔍 Checking import map consistency across HTML files...', 'cyan'));
    console.log();
    
    // Find all HTML files in web directory
    const htmlFiles = await glob('web/*.html', { cwd: path.resolve('.') });
    
    if (htmlFiles.length === 0) {
        console.log(colorize('❌ No HTML files found in web/ directory', 'red'));
        return;
    }
    
    const allImportMaps = new Map(); // filename -> import map
    const packageVersions = new Map(); // package name -> Map(version -> [files])
    
    // Extract import maps from all files
    for (const htmlFile of htmlFiles) {
        const fullPath = path.resolve(htmlFile);
        const content = fs.readFileSync(fullPath, 'utf8');
        const importMap = extractImportMap(content);
        
        if (importMap) {
            if (importMap.error) {
                console.log(colorize(`❌ ${path.basename(htmlFile)}: ${importMap.error}`, 'red'));
                continue;
            }
            
            allImportMaps.set(htmlFile, importMap);
            
            // Process imports
            if (importMap.imports) {
                for (const [importName, url] of Object.entries(importMap.imports)) {
                    const packageName = extractPackageFromUrl(url);
                    const version = extractVersionFromUrl(url);
                    
                    if (packageName && version) {
                        if (!packageVersions.has(packageName)) {
                            packageVersions.set(packageName, new Map());
                        }
                        
                        const versionMap = packageVersions.get(packageName);
                        if (!versionMap.has(version)) {
                            versionMap.set(version, []);
                        }
                        
                        versionMap.get(version).push({
                            file: path.basename(htmlFile),
                            importName,
                            url
                        });
                    }
                }
            }
        }
    }
    
    console.log(colorize(`📊 Found ${allImportMaps.size} files with import maps`, 'blue'));
    console.log();
    
    // Check for version inconsistencies
    let hasInconsistencies = false;
    
    for (const [packageName, versionMap] of packageVersions.entries()) {
        if (versionMap.size > 1) {
            hasInconsistencies = true;
            console.log(colorize(`⚠️  Version inconsistency for ${packageName}:`, 'yellow'));
            
            for (const [version, usages] of versionMap.entries()) {
                console.log(`  ${colorize(version, 'magenta')} used in:`);
                for (const usage of usages) {
                    console.log(`    - ${colorize(usage.file, 'cyan')} (${usage.importName})`);
                }
            }
            console.log();
        }
    }
    
    if (!hasInconsistencies) {
        console.log(colorize('✅ All package versions are consistent across import maps!', 'green'));
    }
    
    // Summary statistics
    console.log(colorize('📈 Summary:', 'bold'));
    console.log(`  Files with import maps: ${allImportMaps.size}`);
    console.log(`  Unique packages: ${packageVersions.size}`);
    console.log(`  Packages with version conflicts: ${Array.from(packageVersions.values()).filter(vm => vm.size > 1).length}`);
    
    // List all packages and their versions for reference
    if (packageVersions.size > 0) {
        console.log();
        console.log(colorize('📦 All packages and versions:', 'bold'));
        
        const sortedPackages = Array.from(packageVersions.entries()).sort(([a], [b]) => a.localeCompare(b));
        
        for (const [packageName, versionMap] of sortedPackages) {
            const versions = Array.from(versionMap.keys()).sort();
            const versionColor = versionMap.size > 1 ? 'yellow' : 'green';
            console.log(`  ${packageName}: ${colorize(versions.join(', '), versionColor)}`);
        }
    }
    
    process.exit(hasInconsistencies ? 1 : 0);
}

// Run the check
checkImportMapConsistency().catch(error => {
    console.error(colorize(`❌ Error: ${error.message}`, 'red'));
    process.exit(1);
});