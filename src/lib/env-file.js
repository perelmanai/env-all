import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseEnvFile, serializeEntries, formatValue, isValidKey, KEY_NAME_RULE } from './store.js';

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
 * `literal` is the text written after KEY= (defaults to the value, quoted if it needs it).
 */
export function setProjectKey(filePath, key, value, literal = formatValue(value)) {
  if (!isValidKey(key)) throw new Error(`Invalid key name: ${key}. ${KEY_NAME_RULE}`);
  const entries = existsSync(filePath) ? parseEnvFile(filePath) : [];
  const raw = `${key}=${literal}`;

  let found = false;
  for (const entry of entries) {
    if (entry.type === 'pair' && entry.key === key) {
      entry.value = value;
      entry.raw = raw;
      found = true;
      break;
    }
  }

  if (!found) {
    entries.push({ type: 'pair', key, value, raw });
  }

  writeFileSync(filePath, serializeEntries(entries), 'utf-8');
}
