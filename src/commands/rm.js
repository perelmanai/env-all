import { existsSync } from 'node:fs';
import { removeKey } from '../lib/store.js';
import { regenerateAvailable } from '../lib/available.js';
import { config } from '../lib/config.js';

export function rmCommand(key, options) {
  if (!existsSync(config.dir)) {
    console.error('Not initialized. Run: envall init');
    process.exit(1);
  }

  const profile = options.profile || undefined;
  const removed = removeKey(key, profile);
  if (!removed) {
    console.error(`Key not found: ${key}`);
    process.exit(1);
  }

  regenerateAvailable(profile);
  console.log(`Removed ${key}`);
}
