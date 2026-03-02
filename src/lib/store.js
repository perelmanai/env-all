import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { config } from './config.js';

/**
 * Parse a .env file into an ordered array of entries.
 * Each entry is { type: 'pair' | 'comment' | 'blank', key?, value?, raw }.
 * This preserves comments and blank lines for faithful round-tripping.
 */
export function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const entries = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      entries.push({ type: 'blank', raw: line });
    } else if (trimmed.startsWith('#')) {
      entries.push({ type: 'comment', raw: line });
    } else {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) {
        entries.push({ type: 'comment', raw: line }); // malformed, treat as comment
      } else {
        const key = trimmed.slice(0, eqIndex);
        let value = trimmed.slice(eqIndex + 1);
        // Strip matching surrounding quotes (matches dotenv npm behavior)
        if (
          value.length >= 2 &&
          ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'")))
        ) {
          value = value.slice(1, -1);
        }
        entries.push({ type: 'pair', key, value, raw: line });
      }
    }
  }

  // Remove trailing blank entry from final newline
  if (entries.length > 0 && entries[entries.length - 1].type === 'blank' && entries[entries.length - 1].raw === '') {
    entries.pop();
  }

  return entries;
}

/**
 * Serialize entries back to .env file content.
 */
export function serializeEntries(entries) {
  return entries.map((e) => e.raw).join('\n') + '\n';
}

/**
 * Read the global store. Returns a Map of key -> value preserving insertion order.
 */
export function readStore(profile) {
  const filePath = config.envFileForProfile(profile);
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
 * Get a single key from the global store.
 */
export function getKey(key, profile) {
  const store = readStore(profile);
  return store.get(key);
}

/**
 * Set a key in the global store. Updates existing or appends.
 */
export function setKey(key, value, profile) {
  const filePath = config.envFileForProfile(profile);
  const entries = parseEnvFile(filePath);

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

/**
 * Remove a key from the global store.
 */
export function removeKey(key, profile) {
  const filePath = config.envFileForProfile(profile);
  const entries = parseEnvFile(filePath);
  const filtered = entries.filter((e) => !(e.type === 'pair' && e.key === key));

  if (filtered.length === entries.length) {
    return false; // key not found
  }

  writeFileSync(filePath, serializeEntries(filtered), 'utf-8');
  return true;
}
