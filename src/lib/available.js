import { config } from './config.js';
import { parseEnvFile, writeStoreFile } from './store.js';

/**
 * Regenerate .env.available from .env.
 * Lists key names only, as the store parser sees them, so lines that are not
 * KEY=value pairs (or belong to a multi-line value) never end up in this file.
 */
export function regenerateAvailable(profile) {
  const envPath = config.envFileForProfile(profile);
  const availPath = config.availableFileForProfile(profile);

  const keys = parseEnvFile(envPath)
    .filter((entry) => entry.type === 'pair')
    .map((entry) => entry.key);

  writeStoreFile(availPath, keys.join('\n') + (keys.length ? '\n' : ''));
  return keys;
}
