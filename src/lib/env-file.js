import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseEnvFile, serializeEntries } from './store.js';

/**
 * Read a project .env file into a Map of key -> value.
 */
export function readProjectEnv(filePath) {
  const entries = parseEnvFile(filePath);
  const map = new Map();
  for (const entry of entries) {
    if (entry.type === 'pair') {
      map.set(entry.key, entry.value);
    }
  }
  return map;
}

/**
 * Write or update a key in a project .env file.
 * Preserves existing content, updates in-place or appends.
 */
export function setProjectKey(filePath, key, value) {
  const entries = existsSync(filePath) ? parseEnvFile(filePath) : [];

  let found = false;
  for (const entry of entries) {
    if (entry.type === 'pair' && entry.key === key) {
      entry.value = value;
      entry.raw = `${key}=${value}`;
      found = true;
      break;
    }
  }

  if (!found) {
    entries.push({ type: 'pair', key, value, raw: `${key}=${value}` });
  }

  writeFileSync(filePath, serializeEntries(entries), 'utf-8');
}
