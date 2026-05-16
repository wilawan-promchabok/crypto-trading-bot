import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readJSON(file, fallback) {
  const path = join(DATA_DIR, file);
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  ensureDir();
  writeFileSync(join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf8');
}

// ─── Watchlist ────────────────────────────────────────────────────────────────

export function loadWatchList() {
  const list = readJSON('watchlist.json', null);
  if (Array.isArray(list)) return new Set(list);
  return new Set(
    (process.env.DEFAULT_SYMBOLS || 'BTC/USDT,ETH/USDT').split(',').map((s) => s.trim())
  );
}

export function saveWatchList(set) {
  writeJSON('watchlist.json', [...set]);
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function readSettings() {
  return readJSON('settings.json', {});
}

export function loadThreshold() {
  const s = readSettings();
  return typeof s.threshold === 'number' ? s.threshold : 2;
}

export function saveThreshold(value) {
  const s = readSettings();
  s.threshold = value;
  writeJSON('settings.json', s);
}
