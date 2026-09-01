#!/usr/bin/env node
// One-off helper: logs into a login-gated site with Playwright and saves the
// resulting session (cookies + localStorage) as a storageState JSON file.
// Feed that file to `pnpm engine:extract <url> --storage-state <file>` to
// crawl pages that require an authenticated session.
//
// Usage: pnpm exec tsx bin/login.ts <login-url> <email> <password> <output-path>

import { chromium } from 'playwright';

async function main() {
  const [loginUrl, email, password, outputPath] = process.argv.slice(2);

  if (!loginUrl || !email || !password || !outputPath) {
    console.error(
      'Usage: pnpm exec tsx bin/login.ts <login-url> <email> <password> <output-path>',
    );
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    console.log(`  Navigating to ${loginUrl}...`);
    await page.goto(loginUrl, { waitUntil: 'load', timeout: 30000 });

    // WordPress-standard login field names (log/pwd) — works for wp-login.php
    // and Elementor Pro login widgets, which is what most WP sites use.
    // Elementor often renders a duplicate (hidden) copy of the form for its
    // popup variant, so we scope to the :visible instance.
    await page.locator('input[name="log"]:visible').first().fill(email);
    await page.locator('input[name="pwd"]:visible').first().fill(password);

    console.log('  Submitting credentials...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => null),
      page.locator('button[type="submit"]:visible, input[type="submit"]:visible').first().click(),
    ]);
    await page.waitForTimeout(1500);

    const stillOnLoginPage = page.url().includes(new URL(loginUrl).pathname);
    const errorText = await page
      .locator('text=/incorrect|error|inválid|invalid/i')
      .first()
      .textContent()
      .catch(() => null);

    if (stillOnLoginPage || errorText) {
      console.error(
        `  WARN: login may have failed — still on ${page.url()}${errorText ? ` (found: "${errorText.trim()}")` : ''}`,
      );
    } else {
      console.log(`  Logged in — landed on ${page.url()}`);
    }

    await context.storageState({ path: outputPath });
    console.log(`  Saved session to ${outputPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
