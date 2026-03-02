import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { config } from './config.js';

/**
 * Regenerate .env.available from .env.
 * Extracts key names only (everything before the first '='), skipping comments and blanks.
 */
export function regenerateAvailable(profile) {
  const envPath = config.envFileForProfile(profile);
  const availPath = config.availableFileForProfile(profile);

  if (!existsSync(envPath)) {
    writeFileSync(availPath, '', 'utf-8');
    return [];
  }

  const content = readFileSync(envPath, 'utf-8');
  const keys = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      keys.push(trimmed.slice(0, eqIndex));
    }
  }

  writeFileSync(availPath, keys.join('\n') + (keys.length ? '\n' : ''), 'utf-8');
  return keys;
}
