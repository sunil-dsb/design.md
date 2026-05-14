// File-based per-IP rate limiter for /api/extract.
//
// Each extraction is 60-240s of Playwright work  without a cap, an
// unattended script could DOS the worker. Default cap is 5 extractions per
// IP per 24-hour sliding window.
//
// Storage: a single JSON file at <cwd>/output/.rate-limits.json mapping
// `ip → recent extraction timestamps`. Entries older than 24h are pruned
// on every read so the file doesn't grow unbounded. The file is gitignored
// (under /output/) and survives container restarts on persistent disk
// (HF Spaces with persistent storage enabled; ephemeral filesystems reset
// the limiter on rebuild, which is fine  the limit isn't a security
// boundary, just an abuse brake).
//
// Concurrency: best-effort. Two simultaneous requests from the same IP at
// exactly the same moment could both observe count = N-1 and both proceed,
// resulting in N+1 recorded. For 5/IP/24h on an HF Space getting < 1000
// requests/day this virtually never fires. The downside is the user
// occasionally gets one extra slot  not a security issue. Atomic
// read-modify-write via tmpfile + rename keeps the file from being
// half-written under crash.
//
// Config (env vars):
//   RATE_LIMIT_PER_IP_PER_DAY  numeric daily cap (default 5)
//   RATE_LIMIT_BYPASS_KEY      optional secret. Requests with
//                              ?key=<value> matching this skip the limit.
//                              Useful for demos / your own testing without
//                              eating your quota.
//
// Dev bypass: when NODE_ENV !== 'production', the limiter is auto-bypassed
// so local dev doesn't trip itself.

import * as fs from 'fs';
import * as path from 'path';

const WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 5;

//  Public types 

/** IP → list of UTC ms timestamps within the 24h window. */
export type RateLimitState = Record<string, number[]>;

export interface RateLimitResult {
  /** True when the request is allowed. False = caller should return 429. */
  allowed: boolean;
  /** How many extractions this IP has used in the current window (post-this-call when allowed). */
  used: number;
  /** The configured cap. Exposed so the UI can show "3/5 used today". */
  limit: number;
  /** Seconds until the oldest timestamp falls out of the window. 0 when allowed. */
  retryAfterSeconds: number;
  /** Human-readable "in 3 hours" / "in 45 minutes"  for error messaging. */
  resetIn: string;
}

export interface RateLimitOptions {
  /** Override the state file path. Default: <cwd>/output/.rate-limits.json */
  stateFilePath?: string;
  /** Override the current time (for tests). Default: Date.now() */
  now?: number;
  /** Override the limit (for tests). Default: env-driven, falls back to 5 */
  limit?: number;
  /** Override env-bypass behaviour (for tests). Default: NODE_ENV-driven */
  skipEnvBypass?: boolean;
}

//  Pure logic (no I/O  easy to unit-test) 

/**
 * Drop timestamps older than the sliding window. Removes IPs whose entire
 * list pruned to empty so the file stays tidy.
 */
export function pruneStale(state: RateLimitState, now: number): RateLimitState {
  const cutoff = now - WINDOW_MS;
  const pruned: RateLimitState = {};
  for (const ip in state) {
    const fresh = state[ip].filter((t) => t > cutoff);
    if (fresh.length > 0) pruned[ip] = fresh;
  }
  return pruned;
}

/**
 * Pure rate-limit evaluation. Given a state, IP, now-timestamp, and limit,
 * decide whether the request is allowed and produce the next state.
 *
 * The caller persists `nextState` only on allowed requests (or, optionally,
 * always  to compact the pruned file).
 */
export function evaluateRateLimit(
  state: RateLimitState,
  ip: string,
  now: number,
  limit: number,
): RateLimitResult & { nextState: RateLimitState } {
  const pruned = pruneStale(state, now);
  const timestamps = pruned[ip] ?? [];

  if (timestamps.length >= limit) {
    // Pruned guarantees all timestamps are within the window. Oldest one
    // determines when the user gets their next slot back.
    const oldest = timestamps[0];
    const retryAfterMs = oldest + WINDOW_MS - now;
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return {
      allowed: false,
      used: timestamps.length,
      limit,
      retryAfterSeconds,
      resetIn: formatResetIn(retryAfterSeconds),
      nextState: pruned,
    };
  }

  const nextTimestamps = [...timestamps, now];
  const nextState: RateLimitState = { ...pruned, [ip]: nextTimestamps };
  return {
    allowed: true,
    used: nextTimestamps.length,
    limit,
    retryAfterSeconds: 0,
    resetIn: 'now',
    nextState,
  };
}

function formatResetIn(seconds: number): string {
  if (seconds < 60) return `in ${seconds} seconds`;
  if (seconds < 3600) return `in ${Math.ceil(seconds / 60)} minutes`;
  return `in ${Math.ceil(seconds / 3600)} hours`;
}

//  File I/O 

function defaultStatePath(): string {
  return path.join(process.cwd(), 'output', '.rate-limits.json');
}

export function readState(stateFilePath: string): RateLimitState {
  if (!fs.existsSync(stateFilePath)) return {};
  try {
    const raw = fs.readFileSync(stateFilePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as RateLimitState;
    }
    return {};
  } catch {
    // Corrupted file  start fresh. Returning {} means the next write will
    // overwrite the bad content with valid JSON.
    return {};
  }
}

export function writeState(stateFilePath: string, state: RateLimitState): void {
  // Ensure parent dir exists (output/ may be absent on a clean checkout).
  fs.mkdirSync(path.dirname(stateFilePath), { recursive: true });

  // Atomic write via tmpfile + rename. On Linux (HF Spaces Docker target)
  // rename is atomic. On Windows we fall back to direct overwrite if
  // rename fails  atomicity is lost but the state still updates.
  const tmp = stateFilePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state));
  try {
    fs.renameSync(tmp, stateFilePath);
  } catch {
    try {
      fs.writeFileSync(stateFilePath, JSON.stringify(state));
      fs.unlinkSync(tmp);
    } catch {
      /* best-effort */
    }
  }
}

//  Env-aware wrapper (what the route calls) 

function getEnvLimit(): number {
  const raw = process.env.RATE_LIMIT_PER_IP_PER_DAY;
  if (!raw) return DEFAULT_LIMIT;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_LIMIT;
}

function getBypassKey(): string | null {
  const k = process.env.RATE_LIMIT_BYPASS_KEY?.trim();
  return k ? k : null;
}

function devBypassResult(limit: number): RateLimitResult {
  return {
    allowed: true,
    used: 0,
    limit,
    retryAfterSeconds: 0,
    resetIn: 'now',
  };
}

/**
 * Check whether `ip` is allowed to start another extraction; record the
 * extraction if allowed; return the decision + retry-after info.
 *
 * Bypass paths (return allowed: true without touching the state file):
 *   1. NODE_ENV !== 'production' (so local dev doesn't trip itself)
 *   2. `bypassKey` matches RATE_LIMIT_BYPASS_KEY env var
 *
 * Otherwise: read state file → prune stale entries → evaluate → if allowed,
 * append now to this IP's list and persist. The persisted state is always
 * the pruned version (so the file shrinks even on rejected requests).
 */
export function checkAndRecordRateLimit(
  ip: string,
  bypassKey: string | null = null,
  opts: RateLimitOptions = {},
): RateLimitResult {
  const limit = opts.limit ?? getEnvLimit();
  const now = opts.now ?? Date.now();
  const stateFile = opts.stateFilePath ?? defaultStatePath();

  // Dev bypass  auto-allow when running locally. Tests can disable via
  // skipEnvBypass to exercise the real path.
  if (!opts.skipEnvBypass && process.env.NODE_ENV !== 'production') {
    return devBypassResult(limit);
  }

  // Key bypass  auto-allow if a known secret was passed.
  const expectedKey = getBypassKey();
  if (expectedKey && bypassKey && bypassKey === expectedKey) {
    return devBypassResult(limit);
  }

  const state = readState(stateFile);
  const result = evaluateRateLimit(state, ip, now, limit);

  // Always persist the pruned state  keeps the file tidy even when we
  // reject. The pruned state is identical to the input minus stale entries.
  writeState(stateFile, result.nextState);

  return {
    allowed: result.allowed,
    used: result.used,
    limit: result.limit,
    retryAfterSeconds: result.retryAfterSeconds,
    resetIn: result.resetIn,
  };
}

//  IP extraction 

/**
 * Extract the client IP from request headers. Tries x-forwarded-for first
 * (the standard reverse-proxy header  HF Spaces, Cloudflare, and Vercel
 * all set it), then x-real-ip, then falls back to `unknown`.
 *
 * Unknown clients share a single bucket  slightly more restrictive than
 * per-real-IP but never unsafe. An attacker who can spoof XFF can dodge
 * the limit anyway; this is a brake, not a security wall.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    // X-Forwarded-For: client, proxy1, proxy2  client is leftmost.
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const xri = req.headers.get('x-real-ip');
  if (xri) return xri.trim();
  return 'unknown';
}
