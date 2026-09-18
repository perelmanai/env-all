import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { config } from './config.js';

// 'value', "value" or `value` (may span lines), optionally followed by a comment
const QUOTED = /^(['"`])((?:\\\1|(?!\1).)*)\1\s*(?:#.*)?$/s;

const KEY_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const KEY_NAME_RULE = 'Key names use letters, digits and underscores, and cannot start with a digit.';

export function isValidKey(key) {
  return typeof key === 'string' && KEY_NAME.test(key);
}

/**
 * Parse the right-hand side of a KEY=... line (matches dotenv npm behavior).
 * For quoted values, `literal` is the quoted text exactly as written: the quote style
 * decides how a parser reads escapes like \n, so it has to survive a pull.
 */
function parseValue(rhs) {
  const quoted = rhs.match(QUOTED);
  if (quoted) {
    const [, quote, inner] = quoted;
    // Double quotes expand \n and \r; other quotes are literal
    const value = quote === '"' ? inner.replace(/\\n/g, '\n').replace(/\\r/g, '\r') : inner;
    return { value, literal: quote + inner + quote };
  }
  // Unquoted: a '#' after whitespace starts an inline comment
  return { value: rhs.replace(/\s+#.*$/, '').trim(), literal: null };
}

/**
 * Format a value for writing after KEY=. Values a dotenv parser would misread unquoted
 * ('#' starts a comment, surrounding whitespace is trimmed) are wrapped in quotes.
 */
export function formatValue(value) {
  if (parseValue(value).literal === value) return value; // already quoted by the user
  if (!/[\s#]/.test(value)) return value;
  if (/[\r\n]/.test(value) && !value.includes('"')) {
    // Keep the pair on one line: parsers expand \n and \r inside double quotes
    return `"${value.replace(/\r/g, '\\r').replace(/\n/g, '\\n')}"`;
  }
  const quote = ["'", '"', '`'].find((q) => !value.includes(q)) ?? '"';
  return `${quote}${value}${quote}`;
}

/**
 * Write a file in ~/.env-global, readable and writable by the owner only.
 */
export function writeStoreFile(filePath, content) {
  writeFileSync(filePath, content, { encoding: 'utf-8', mode: 0o600 });
  // The mode option only applies to new files — tighten existing ones too
  chmodSync(filePath, 0o600);
  chmodSync(config.dir, 0o700);
}

/**
 * Parse a .env file into an ordered array of entries.
 * Each entry is { type: 'pair' | 'comment' | 'blank', key?, value?, literal?, raw }.
 * This preserves comments and blank lines for faithful round-tripping.
 */
export function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const entries = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '') {
      entries.push({ type: 'blank', raw: line });
    } else if (trimmed.startsWith('#')) {
      entries.push({ type: 'comment', raw: line });
    } else {
      const eqIndex = trimmed.indexOf('=');
      const key = eqIndex === -1 ? '' : trimmed.slice(0, eqIndex).replace(/^export\s+/, '').trim();
      if (!isValidKey(key)) {
        entries.push({ type: 'comment', raw: line }); // not a KEY=value line: kept as-is, never read as a key
      } else {
        let rhs = trimmed.slice(eqIndex + 1).trim();
        let raw = line;
        // A quoted value that does not close on its own line runs on to its closing quote
        if (/^['"`]/.test(rhs) && !QUOTED.test(rhs)) {
          for (let j = i + 1; j < lines.length; j++) {
            const joined = [rhs, ...lines.slice(i + 1, j + 1)].join('\n').trimEnd();
            if (QUOTED.test(joined)) {
              rhs = joined;
              raw = lines.slice(i, j + 1).join('\n');
              i = j;
              break;
            }
          }
        }
        const { value, literal } = parseValue(rhs);
        entries.push({ type: 'pair', key, value, literal, raw });
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
 * Read the global store as key -> text to write after KEY= in another .env file.
 * Quoted values keep their quoting as written; the rest are formatted like a new value.
 */
export function readStoreLiterals(profile) {
  const filePath = config.envFileForProfile(profile);
  const entries = parseEnvFile(filePath);
  const map = new Map();
  for (const entry of entries) {
    if (entry.type === 'pair') {
      map.set(entry.key, entry.literal ?? formatValue(entry.value));
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
  if (!isValidKey(key)) throw new Error(`Invalid key name: ${key}. ${KEY_NAME_RULE}`);
  const filePath = config.envFileForProfile(profile);
  const entries = parseEnvFile(filePath);

  const raw = `${key}=${formatValue(value)}`;

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

  writeStoreFile(filePath, serializeEntries(entries));
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

  writeStoreFile(filePath, serializeEntries(filtered));
  return true;
}
