import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  pruneStale,
  evaluateRateLimit,
  readState,
  writeState,
  checkAndRecordRateLimit,
  getClientIp,
  type RateLimitState,
} from '../rate-limit';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = 1_700_000_000_000; // fixed timestamp, ~2023-11-14

// ─── pruneStale ───────────────────────────────────────────────────────────

describe('pruneStale', () => {
  it('drops timestamps older than 24h', () => {
    const state: RateLimitState = {
      '1.1.1.1': [NOW - DAY - 1, NOW - HOUR, NOW],
    };
    const result = pruneStale(state, NOW);
    expect(result['1.1.1.1']).toEqual([NOW - HOUR, NOW]);
  });

  it('drops IPs whose entire timestamp list is stale', () => {
    const state: RateLimitState = {
      '1.1.1.1': [NOW - 2 * DAY, NOW - DAY - 1],
      '2.2.2.2': [NOW - HOUR],
    };
    const result = pruneStale(state, NOW);
    expect(result['1.1.1.1']).toBeUndefined();
    expect(result['2.2.2.2']).toEqual([NOW - HOUR]);
  });

  it('returns empty object when all IPs are stale', () => {
    const state: RateLimitState = {
      '1.1.1.1': [NOW - 2 * DAY],
      '2.2.2.2': [NOW - 3 * DAY],
    };
    expect(pruneStale(state, NOW)).toEqual({});
  });

  it('returns input unchanged (deep-clone-safe) when all entries are fresh', () => {
    const state: RateLimitState = {
      '1.1.1.1': [NOW - HOUR, NOW],
    };
    const result = pruneStale(state, NOW);
    expect(result['1.1.1.1']).toEqual([NOW - HOUR, NOW]);
    // pruneStale must not mutate input
    expect(state['1.1.1.1']).toEqual([NOW - HOUR, NOW]);
  });
});

// ─── evaluateRateLimit ────────────────────────────────────────────────────

describe('evaluateRateLimit', () => {
  it('allows a first-time request and records the timestamp', () => {
    const result = evaluateRateLimit({}, '1.1.1.1', NOW, 5);
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(1);
    expect(result.limit).toBe(5);
    expect(result.retryAfterSeconds).toBe(0);
    expect(result.nextState['1.1.1.1']).toEqual([NOW]);
  });

  it('allows up to the limit', () => {
    const state: RateLimitState = {
      '1.1.1.1': [NOW - 4 * HOUR, NOW - 3 * HOUR, NOW - 2 * HOUR, NOW - HOUR],
    };
    const result = evaluateRateLimit(state, '1.1.1.1', NOW, 5);
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(5);
    expect(result.nextState['1.1.1.1']).toHaveLength(5);
  });

  it('denies the (limit+1)th request within the window', () => {
    const state: RateLimitState = {
      '1.1.1.1': [NOW - 4 * HOUR, NOW - 3 * HOUR, NOW - 2 * HOUR, NOW - HOUR, NOW - 1000],
    };
    const result = evaluateRateLimit(state, '1.1.1.1', NOW, 5);
    expect(result.allowed).toBe(false);
    expect(result.used).toBe(5);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.nextState['1.1.1.1']).toEqual(state['1.1.1.1']); // unchanged on reject
  });

  it('retryAfterSeconds points at the oldest timestamp falling out of the window', () => {
    // Oldest is 4h ago → falls out in (24 - 4) = 20h.
    const state: RateLimitState = {
      '1.1.1.1': [NOW - 4 * HOUR, NOW - 3 * HOUR, NOW - 2 * HOUR, NOW - HOUR, NOW - 1000],
    };
    const result = evaluateRateLimit(state, '1.1.1.1', NOW, 5);
    const expectedSeconds = Math.ceil((20 * HOUR) / 1000);
    expect(result.retryAfterSeconds).toBe(expectedSeconds);
    expect(result.resetIn).toMatch(/in \d+ hours/);
  });

  it('allows again after the oldest timestamp falls out of the window', () => {
    // Oldest timestamp is RIGHT at 24h+1ms — past the window, gets pruned.
    const state: RateLimitState = {
      '1.1.1.1': [NOW - DAY - 1, NOW - 3 * HOUR, NOW - 2 * HOUR, NOW - HOUR, NOW - 1000],
    };
    const result = evaluateRateLimit(state, '1.1.1.1', NOW, 5);
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(5); // 4 fresh + 1 new
  });

  it('separate IPs have separate buckets', () => {
    const state: RateLimitState = {
      '1.1.1.1': [NOW - HOUR, NOW - 1000, NOW - 500, NOW - 100, NOW - 50],
    };
    // 1.1.1.1 is over limit; 2.2.2.2 should still be allowed.
    const blocked = evaluateRateLimit(state, '1.1.1.1', NOW, 5);
    const allowed = evaluateRateLimit(state, '2.2.2.2', NOW, 5);
    expect(blocked.allowed).toBe(false);
    expect(allowed.allowed).toBe(true);
  });

  it('prunes stale entries from other IPs in the persisted state', () => {
    const state: RateLimitState = {
      '1.1.1.1': [NOW - 2 * DAY], // stale
      '2.2.2.2': [NOW - HOUR],   // fresh
    };
    const result = evaluateRateLimit(state, '3.3.3.3', NOW, 5);
    expect(result.nextState['1.1.1.1']).toBeUndefined(); // pruned
    expect(result.nextState['2.2.2.2']).toEqual([NOW - HOUR]);
    expect(result.nextState['3.3.3.3']).toEqual([NOW]);
  });

  it('formats reset time as seconds for short retries', () => {
    // 30 second-old single entry, limit 1 → next slot in 24h - 30s.
    // Actually pick a scenario where retry is < 60s:
    // oldest timestamp at NOW - (DAY - 30 * 1000) → falls out in 30s.
    const state: RateLimitState = {
      '1.1.1.1': [NOW - DAY + 30 * 1000],
    };
    const result = evaluateRateLimit(state, '1.1.1.1', NOW, 1);
    expect(result.allowed).toBe(false);
    expect(result.resetIn).toMatch(/in \d+ seconds/);
  });

  it('formats reset time as minutes for medium retries', () => {
    // Oldest falls out in 30 minutes.
    const state: RateLimitState = {
      '1.1.1.1': [NOW - DAY + 30 * 60 * 1000],
    };
    const result = evaluateRateLimit(state, '1.1.1.1', NOW, 1);
    expect(result.allowed).toBe(false);
    expect(result.resetIn).toMatch(/in \d+ minutes/);
  });
});

// ─── readState / writeState (file I/O) ───────────────────────────────────

describe('readState + writeState', () => {
  let tmpFile: string;

  beforeEach(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ratelimit-'));
    tmpFile = path.join(dir, '.rate-limits.json');
  });

  afterEach(() => {
    try {
      fs.rmSync(path.dirname(tmpFile), { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  });

  it('returns empty object when file does not exist', () => {
    expect(readState(tmpFile)).toEqual({});
  });

  it('returns empty object when file content is malformed', () => {
    fs.writeFileSync(tmpFile, 'not json at all');
    expect(readState(tmpFile)).toEqual({});
  });

  it('returns empty object when file content is a JSON array (wrong shape)', () => {
    fs.writeFileSync(tmpFile, '[1, 2, 3]');
    expect(readState(tmpFile)).toEqual({});
  });

  it('round-trips a state through write + read', () => {
    const state: RateLimitState = {
      '1.1.1.1': [NOW - HOUR, NOW],
      '2.2.2.2': [NOW - 1000],
    };
    writeState(tmpFile, state);
    expect(readState(tmpFile)).toEqual(state);
  });

  it('creates parent directories as needed', () => {
    const deepPath = path.join(path.dirname(tmpFile), 'a', 'b', 'c', '.rate-limits.json');
    writeState(deepPath, { '1.1.1.1': [NOW] });
    expect(fs.existsSync(deepPath)).toBe(true);
  });

  it('cleans up tmp file after rename', () => {
    writeState(tmpFile, { '1.1.1.1': [NOW] });
    expect(fs.existsSync(tmpFile + '.tmp')).toBe(false);
  });
});

// ─── checkAndRecordRateLimit (end-to-end) ────────────────────────────────

describe('checkAndRecordRateLimit (with file I/O)', () => {
  let tmpFile: string;

  beforeEach(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ratelimit-int-'));
    tmpFile = path.join(dir, '.rate-limits.json');
    // Force the prod path so the env bypass doesn't short-circuit our tests.
    vi.stubEnv('NODE_ENV', 'production');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    try {
      fs.rmSync(path.dirname(tmpFile), { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  });

  it('allows 5 requests then denies the 6th from same IP', () => {
    for (let i = 0; i < 5; i++) {
      const r = checkAndRecordRateLimit('1.1.1.1', null, {
        stateFilePath: tmpFile,
        now: NOW + i * 1000,
        limit: 5,
      });
      expect(r.allowed).toBe(true);
      expect(r.used).toBe(i + 1);
    }
    const sixth = checkAndRecordRateLimit('1.1.1.1', null, {
      stateFilePath: tmpFile,
      now: NOW + 6 * 1000,
      limit: 5,
    });
    expect(sixth.allowed).toBe(false);
    expect(sixth.used).toBe(5);
    expect(sixth.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('persists state across calls', () => {
    checkAndRecordRateLimit('1.1.1.1', null, {
      stateFilePath: tmpFile,
      now: NOW,
      limit: 5,
    });
    const disk = readState(tmpFile);
    expect(disk['1.1.1.1']).toEqual([NOW]);
  });

  it('separate IPs do not share quota', () => {
    // 1.1.1.1 fills up.
    for (let i = 0; i < 5; i++) {
      checkAndRecordRateLimit('1.1.1.1', null, {
        stateFilePath: tmpFile,
        now: NOW + i,
        limit: 5,
      });
    }
    // 2.2.2.2 should still get the first slot.
    const r = checkAndRecordRateLimit('2.2.2.2', null, {
      stateFilePath: tmpFile,
      now: NOW + 10,
      limit: 5,
    });
    expect(r.allowed).toBe(true);
    expect(r.used).toBe(1);
  });

  it('bypass key auto-allows without burning a slot', () => {
    vi.stubEnv('RATE_LIMIT_BYPASS_KEY', 'secret123');
    // Fill up a bucket first.
    for (let i = 0; i < 5; i++) {
      checkAndRecordRateLimit('1.1.1.1', null, {
        stateFilePath: tmpFile,
        now: NOW + i,
        limit: 5,
      });
    }
    // Same IP, with the right bypass key — should pass.
    const r = checkAndRecordRateLimit('1.1.1.1', 'secret123', {
      stateFilePath: tmpFile,
      now: NOW + 10,
      limit: 5,
    });
    expect(r.allowed).toBe(true);
    // Bucket should NOT include the bypassed request.
    const disk = readState(tmpFile);
    expect(disk['1.1.1.1']).toHaveLength(5);
  });

  it('wrong bypass key does not auto-allow', () => {
    vi.stubEnv('RATE_LIMIT_BYPASS_KEY', 'secret123');
    for (let i = 0; i < 5; i++) {
      checkAndRecordRateLimit('1.1.1.1', null, {
        stateFilePath: tmpFile,
        now: NOW + i,
        limit: 5,
      });
    }
    const r = checkAndRecordRateLimit('1.1.1.1', 'wrong-key', {
      stateFilePath: tmpFile,
      now: NOW + 10,
      limit: 5,
    });
    expect(r.allowed).toBe(false);
  });

  it('dev-mode bypass: NODE_ENV !== production always allows', () => {
    vi.stubEnv('NODE_ENV', 'development');
    // Even after filling the bucket synthetically...
    fs.mkdirSync(path.dirname(tmpFile), { recursive: true });
    fs.writeFileSync(
      tmpFile,
      JSON.stringify({ '1.1.1.1': Array.from({ length: 100 }, (_, i) => NOW + i) }),
    );
    const r = checkAndRecordRateLimit('1.1.1.1', null, {
      stateFilePath: tmpFile,
      now: NOW + 200,
      limit: 5,
    });
    expect(r.allowed).toBe(true);
  });

  it('skipEnvBypass forces the real path even in dev', () => {
    vi.stubEnv('NODE_ENV', 'development');
    // Pre-fill bucket.
    fs.mkdirSync(path.dirname(tmpFile), { recursive: true });
    fs.writeFileSync(
      tmpFile,
      JSON.stringify({ '1.1.1.1': Array.from({ length: 5 }, (_, i) => NOW + i) }),
    );
    const r = checkAndRecordRateLimit('1.1.1.1', null, {
      stateFilePath: tmpFile,
      now: NOW + 100,
      limit: 5,
      skipEnvBypass: true,
    });
    expect(r.allowed).toBe(false);
  });

  it('reads RATE_LIMIT_PER_IP_PER_DAY env override', () => {
    vi.stubEnv('RATE_LIMIT_PER_IP_PER_DAY', '2');
    // 2 should be the limit now.
    const r1 = checkAndRecordRateLimit('1.1.1.1', null, {
      stateFilePath: tmpFile,
      now: NOW,
    });
    const r2 = checkAndRecordRateLimit('1.1.1.1', null, {
      stateFilePath: tmpFile,
      now: NOW + 1,
    });
    const r3 = checkAndRecordRateLimit('1.1.1.1', null, {
      stateFilePath: tmpFile,
      now: NOW + 2,
    });
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(false);
    expect(r3.limit).toBe(2);
  });

  it('falls back to default 5 when RATE_LIMIT_PER_IP_PER_DAY is non-numeric', () => {
    vi.stubEnv('RATE_LIMIT_PER_IP_PER_DAY', 'banana');
    const r = checkAndRecordRateLimit('1.1.1.1', null, {
      stateFilePath: tmpFile,
      now: NOW,
    });
    expect(r.allowed).toBe(true);
    expect(r.limit).toBe(5);
  });
});

// ─── getClientIp ──────────────────────────────────────────────────────────

describe('getClientIp', () => {
  function makeRequest(headers: Record<string, string>): Request {
    return new Request('https://example.com/', { headers });
  }

  it('reads x-forwarded-for first', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4' });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('takes the leftmost IP from a comma-separated x-forwarded-for chain', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1, 172.16.0.1' });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('trims whitespace around the first IP', () => {
    const req = makeRequest({ 'x-forwarded-for': '  1.2.3.4  , 10.0.0.1' });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = makeRequest({ 'x-real-ip': '5.6.7.8' });
    expect(getClientIp(req)).toBe('5.6.7.8');
  });

  it('returns "unknown" when no IP headers are present', () => {
    const req = makeRequest({});
    expect(getClientIp(req)).toBe('unknown');
  });

  it('returns "unknown" when x-forwarded-for is empty', () => {
    const req = makeRequest({ 'x-forwarded-for': '' });
    expect(getClientIp(req)).toBe('unknown');
  });
});
