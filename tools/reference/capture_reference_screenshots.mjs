#!/usr/bin/env node
/**
 * Captures reference screenshots from the offline reference server at
 * 1440x900, 820x1180, and 390x844 viewports.
 * Emits evals/results/reference-environment.json with measured dimensions and styles.
 */

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);

function findPlaywright() {
  if (process.env.SANCTUM_PLAYWRIGHT && existsSync(process.env.SANCTUM_PLAYWRIGHT)) {
    return process.env.SANCTUM_PLAYWRIGHT;
  }
  // Check local npx cache
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const npxCache = path.join(localAppData, 'npm-cache', '_npx');
  if (existsSync(npxCache)) {
    const fs = require('node:fs');
    for (const dir of fs.readdirSync(npxCache)) {
      const candidate = path.join(npxCache, dir, 'node_modules', 'playwright');
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return 'playwright';
}

const pwPath = findPlaywright();
const { chromium } = require(pwPath);

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '820', width: 820, height: 1180 },
  { name: '390', width: 390, height: 844 },
];

const BASE_URL = process.env.REFERENCE_URL || 'http://127.0.0.1:5174';
const OUTPUT_DIR = path.resolve('evals/results/reference-screenshots');
const RESULTS_FILE = path.resolve('evals/results/reference-environment.json');

mkdirSync(OUTPUT_DIR, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = {
    suite: 'upstream-reference-environment-v1',
    pinned_commit: 'b30f95ac4a80d2f6dbe3aa01001b0524314f6d74',
    timestamp: new Date().toISOString(),
    playwright_path: pwPath,
    surfaces: {},
  };

  try {
    for (const surface of ['dashboard', 'chat']) {
      results.surfaces[surface] = {};
      const url = `${BASE_URL}/${surface}`;

      for (const vp of VIEWPORTS) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: 1,
        });
        const page = await context.newPage();

        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(100);

        const screenshotPath = path.join(OUTPUT_DIR, `reference-${surface}-${vp.name}.png`);
        await page.screenshot({ path: screenshotPath });

        const metrics = await page.evaluate(() => {
          const aside = document.querySelector('aside');
          const asideWidth = aside ? aside.getBoundingClientRect().width : 0;
          const bodyStyle = window.getComputedStyle(document.body);
          return {
            title: document.title,
            aside_width: asideWidth,
            body_bg: bodyStyle.backgroundColor,
            body_color: bodyStyle.color,
            no_horizontal_overflow: document.documentElement.scrollWidth <= window.innerWidth,
          };
        });

        results.surfaces[surface][vp.name] = {
          screenshot: `evals/results/reference-screenshots/reference-${surface}-${vp.name}.png`,
          viewport: { width: vp.width, height: vp.height },
          metrics,
        };

        await context.close();
      }
    }

    writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2) + '\n', 'utf-8');
    console.log(JSON.stringify({ status: 'PASS', surfaces: Object.keys(results.surfaces) }));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
