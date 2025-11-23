#!/usr/bin/env node

/**
 * Fetch a page with Puppeteer and dump console/page errors.
 * Usage: node scripts/puppeteer-console.js <url> [--wait 2000] [--timeout 20000] [--headful] [--executable /path/to/chrome]
 *
 * Respects:
 * - PUPPETEER_EXECUTABLE_PATH to force a specific Chrome/Chromium
 * - PUPPETEER_USER_DATA_DIR for a custom profile (defaults to /tmp/puppeteer-dcgraph)
 */

import puppeteer from 'puppeteer';

// Allow overriding the Chrome path and profile via env
const envExecutable = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_BIN;
const envUserDataDir = process.env.PUPPETEER_USER_DATA_DIR || '/tmp/puppeteer-dcgraph';

const args = process.argv.slice(2);
let url = null;
let waitMs = 2000;
let timeoutMs = 20000;
let headless = true;
let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH ?? null;

for (let i = 0; i < args.length; ++i) {
    const arg = args[i];
    switch (arg) {
        case '--wait':
            waitMs = Number(args[++i]);
            break;
        case '--timeout':
            timeoutMs = Number(args[++i]);
            break;
        case '--headful':
            headless = false;
            break;
        case '--executable':
            executablePath = args[++i];
            break;
        default:
            if (!url)
                url = arg;
            break;
    }
}

if (!url) {
    console.error(
        'Usage: node scripts/puppeteer-console.js <url> [--wait 2000] [--timeout 20000] [--headful] [--executable /path/to/chrome]',
    );
    process.exit(1);
}

const userDataDir = envUserDataDir;

async function main() {
    const browser = await puppeteer.launch({
        headless,
        executablePath: executablePath || envExecutable || undefined,
        userDataDir,
        args: [
            '--disable-crash-reporter',
            '--no-sandbox',
            '--disable-dev-shm-usage',
        ],
    });

    const page = await browser.newPage();
    const logs = [];
    page.on('console', msg => logs.push({type: msg.type(), text: msg.text()}));
    page.on('pageerror', err => logs.push({type: 'pageerror', text: err.message}));

    await page.goto(url, {waitUntil: 'load', timeout: timeoutMs});
    await new Promise(resolve => setTimeout(resolve, waitMs));
    await browser.close();

    console.log(JSON.stringify(logs, null, 2));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
