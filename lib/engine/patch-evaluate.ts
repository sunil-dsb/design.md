import type { Page } from 'playwright';

let patched = false;

/**
 * tsx (the runtime behind `pnpm engine:*`) hardcodes esbuild's
 * `keepNames: true`, which wraps every named function/const declared
 * inside a module with `__name(target, "name")` calls so `.name` survives
 * minification. Playwright's `page.evaluate(fn)` ships `fn.toString()`
 * into an isolated browser context that never sees the Node-side `__name`
 * helper, so any evaluate callback with an inner named function/const
 * (dom-collector.ts, css-analyzer.ts, etc. — dozens of call sites across
 * the engine) throws `ReferenceError: __name is not defined` and the
 * extraction pipeline silently returns 0 tokens for every page.
 *
 * Rather than rewriting every call site, this patches
 * `Page.prototype.evaluate` once — reached via any live `page` instance,
 * since Playwright doesn't export the `Page` class itself — so every
 * existing `page.evaluate(fn, arg?)` call keeps working unchanged. It
 * rewrites the callback's source to embed a self-contained `__name` shim
 * directly inside the function body (not in an outer closure — Playwright
 * only ships `fn.toString()`, which wouldn't capture an outer closure)
 * before Playwright serializes it.
 */
export function patchEvaluateForTsxKeepNames(page: Page): void {
  if (patched) return;
  patched = true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- monkeypatching a third-party prototype
  const proto = Object.getPrototypeOf(page) as any;
  const original: (...args: unknown[]) => Promise<unknown> = proto.evaluate;

  proto.evaluate = function (this: Page, pageFunction: unknown, ...rest: unknown[]) {
    if (typeof pageFunction === 'function') {
      const src = Function.prototype.toString.call(pageFunction);
      if (src.includes('__name(')) {
        return original.apply(this, [rebuildWithShim(src), ...rest]);
      }
    }
    return original.apply(this, [pageFunction, ...rest]);
  };
}

function rebuildWithShim(src: string): unknown {
  const bodyStart = src.indexOf('{');
  // Concise-body arrows (`x => x + 1`) have no block body, so they can't
  // contain named declarations and never trigger `__name(` — nothing to fix.
  if (bodyStart === -1) {
    // eslint-disable-next-line no-eval -- reconstructing a function from its own source text
    return (0, eval)(`(${src})`);
  }

  const shim = 'function __esbuildKeepNamesShim(f){return f;}';
  const cleaned =
    src.slice(0, bodyStart + 1) +
    shim +
    src
      .slice(bodyStart + 1)
      .replace(/\/\*\s*@__PURE__\s*\*\/\s*/g, '')
      .replace(/\b__name\(/g, '__esbuildKeepNamesShim(');

  // eslint-disable-next-line no-eval -- reconstructing a function from its own (patched) source text
  return (0, eval)(`(${cleaned})`);
}
