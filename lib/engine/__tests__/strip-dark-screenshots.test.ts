import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { stripDarkScreenshotsOnDisk } from '../strip-dark-screenshots';

// Fake "Buffer JSON" — the shape JSON.stringify produces when serializing a
// Node Buffer. We don't need a real Buffer here; the helper only cares about
// whether the `darkScreenshots` key has a truthy value.
const fakeBufferLikeObject = { type: 'Buffer', data: [137, 80, 78, 71, 13, 10, 26, 10] };

describe('stripDarkScreenshotsOnDisk()', () => {
  let tmpRoot: string;
  let tokensPath: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strip-dark-test-'));
    tokensPath = path.join(tmpRoot, 'tokens.json');
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('returns false when tokens.json does not exist', () => {
    expect(stripDarkScreenshotsOnDisk(path.join(tmpRoot, 'missing.json'))).toBe(false);
  });

  it('returns false when tokens.json is malformed JSON', () => {
    fs.writeFileSync(tokensPath, '{ not valid json');
    expect(stripDarkScreenshotsOnDisk(tokensPath)).toBe(false);
  });

  it('returns false when tokens.json has no darkMode field', () => {
    fs.writeFileSync(tokensPath, JSON.stringify({ colorTokens: [] }));
    expect(stripDarkScreenshotsOnDisk(tokensPath)).toBe(false);
  });

  it('returns false when darkMode exists but darkScreenshots is null/missing', () => {
    fs.writeFileSync(tokensPath, JSON.stringify({
      darkMode: { supported: false, darkScreenshots: null },
    }));
    expect(stripDarkScreenshotsOnDisk(tokensPath)).toBe(false);

    fs.writeFileSync(tokensPath, JSON.stringify({
      darkMode: { supported: false },
    }));
    expect(stripDarkScreenshotsOnDisk(tokensPath)).toBe(false);
  });

  it('strips darkScreenshots when present and returns true', () => {
    fs.writeFileSync(tokensPath, JSON.stringify({
      darkMode: {
        supported: true,
        darkScreenshots: {
          '1440': fakeBufferLikeObject,
          '1920': fakeBufferLikeObject,
        },
      },
      colorTokens: [],
    }));
    const result = stripDarkScreenshotsOnDisk(tokensPath);
    expect(result).toBe(true);

    const after = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
    expect(after.darkMode.darkScreenshots).toBeNull();
    // Other fields are preserved.
    expect(after.darkMode.supported).toBe(true);
    expect(after.colorTokens).toEqual([]);
  });

  it('shrinks tokens.json when darkScreenshots was a large payload', () => {
    // Simulate a "fat" tokens.json by stuffing a 50 KB string into the
    // screenshot slot. The actual engine puts Buffer-serialized PNG bytes
    // here, which is ~30 MB per viewport — we're not measuring exact sizes,
    // just confirming the file shrinks materially after the strip.
    const heavyPayload = 'A'.repeat(50_000);
    fs.writeFileSync(tokensPath, JSON.stringify({
      darkMode: {
        supported: true,
        darkScreenshots: { '1440': heavyPayload, '1920': heavyPayload },
      },
    }));
    const sizeBefore = fs.statSync(tokensPath).size;
    stripDarkScreenshotsOnDisk(tokensPath);
    const sizeAfter = fs.statSync(tokensPath).size;
    expect(sizeAfter).toBeLessThan(sizeBefore / 10); // ≥ 10× shrink
  });

  it('is idempotent — running twice on a stripped file is a no-op', () => {
    fs.writeFileSync(tokensPath, JSON.stringify({
      darkMode: { supported: true, darkScreenshots: { '1440': fakeBufferLikeObject } },
    }));
    expect(stripDarkScreenshotsOnDisk(tokensPath)).toBe(true);
    expect(stripDarkScreenshotsOnDisk(tokensPath)).toBe(false);
  });
});
