// Per-element screenshot capture for Card / PricingTier variants.
//
// Runs server-side via Playwright while the source page is still open
// (in extract.ts's per-page loop). The in-browser dom-collector pass
// tagged every card-shaped element with a `data-designmd-cap="<nodeId>"`
// attribute; this module locates those tagged elements and saves a PNG
// of each to `output/<slug>/components/`. cluster.ts then matches a
// variant's representative element (by nodeId + page URL) to its
// screenshot when emitting ComponentVariant records.
//
// Why screenshots instead of live tree rendering? See the conversation
// trail — the captured CSS context can't be replanted faithfully, so
// the screenshot is the only path to 100% visual fidelity for composed
// components. The tree (captured separately in cluster.ts) shows up in
// the renderer as a copyable code snippet, not as live HTML.

import * as fs from 'fs';
import * as path from 'path';
import type { Page } from 'playwright';

export interface ComponentScreenshotInfo {
  /** Relative path under outputDir, suitable for `/api/output/<slug>/<this>`. */
  url: string;
  role: 'card' | 'pricing';
}

/** Map keyed by ElementStyle.nodeId. */
export type ComponentScreenshots = Record<number, ComponentScreenshotInfo>;

export interface CaptureOptions {
  /** Max screenshots per page. Defaults to 30 — cards-per-page rarely exceeds. */
  hardCap?: number;
  verbose?: boolean;
}

/**
 * Find every `[data-designmd-cap]` tagged element on the live page and
 * screenshot it to `output/<slug>/components/page-<i>-<role>-<node>.png`.
 *
 * Side effects:
 *  - Writes PNGs to disk (creates `components/` subdir if absent).
 *  - Removes the `data-designmd-cap*` attributes from the page after
 *    capture so subsequent analysis passes see a clean DOM.
 *
 * Failures of a single element (scroll-into-view timeout, off-screen,
 * detached during the pass) are swallowed — partial results are better
 * than aborting the whole extraction over one stubborn card.
 */
export async function captureComponentScreenshots(
  page: Page,
  outputDir: string,
  pageIndex: number,
  options: CaptureOptions = {},
): Promise<ComponentScreenshots> {
  const hardCap = options.hardCap ?? 30;
  const verbose = !!options.verbose;
  const result: ComponentScreenshots = {};

  const componentsDir = path.join(outputDir, 'components');
  if (!fs.existsSync(componentsDir)) {
    fs.mkdirSync(componentsDir, { recursive: true });
  }

  let captured = 0;
  let skipped = 0;
  try {
    const locator = page.locator('[data-designmd-cap]');
    const count = await locator.count();
    const ceiling = Math.min(count, hardCap);

    for (let i = 0; i < ceiling; i++) {
      const el = locator.nth(i);
      try {
        const nodeIdAttr = await el.getAttribute('data-designmd-cap');
        const roleAttr = await el.getAttribute('data-designmd-cap-role');
        if (!nodeIdAttr) {
          skipped++;
          continue;
        }
        const nodeId = parseInt(nodeIdAttr, 10);
        if (!Number.isFinite(nodeId)) {
          skipped++;
          continue;
        }
        const role: 'card' | 'pricing' =
          roleAttr === 'pricing' ? 'pricing' : 'card';

        // Best-effort scroll so lazy-loaded images / IntersectionObserver
        // content has a chance to render before we screenshot. 1.5s is a
        // tight ceiling — a stuck element shouldn't block the whole pass.
        await el
          .scrollIntoViewIfNeeded({ timeout: 1500 })
          .catch(() => undefined);

        const filename = `page-${pageIndex}-${role}-${nodeId}.png`;
        const filepath = path.join(componentsDir, filename);
        const buf = await el.screenshot({
          omitBackground: false,
          timeout: 5000,
          // Don't bother with animations — element.screenshot already
          // waits for layout stability by default.
        });
        fs.writeFileSync(filepath, buf);
        result[nodeId] = { url: `components/${filename}`, role };
        captured++;
      } catch (err) {
        skipped++;
        if (verbose) {
          console.log(
            `    component screenshot skipped (idx ${i}): ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    }
  } catch (err) {
    if (verbose) {
      console.log(
        `    component screenshot pass failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  } finally {
    // Strip the tagging attributes off the live DOM so any downstream
    // analysis pass (or a screenshot of the page itself) sees clean
    // markup. Best-effort — page may already be closed.
    await page
      .evaluate(() => {
        const tagged = document.querySelectorAll('[data-designmd-cap]');
        for (const el of Array.from(tagged)) {
          el.removeAttribute('data-designmd-cap');
          el.removeAttribute('data-designmd-cap-role');
        }
      })
      .catch(() => undefined);
  }

  if (verbose) {
    console.log(
      `    component screenshots: ${captured} captured, ${skipped} skipped`,
    );
  }

  return result;
}
