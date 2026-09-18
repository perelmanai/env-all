import { existsSync } from 'node:fs';
import { readStore } from '../lib/store.js';
import { config } from '../lib/config.js';
import { maskValue } from '../lib/mask.js';

export function listCommand(options) {
  if (!existsSync(config.dir)) {
    console.error('Not initialized. Run: envall init');
    process.exit(1);
  }

  const profile = options.profile || undefined;
  const store = readStore(profile);

  if (store.size === 0) {
    console.log('No keys stored.');
    return;
  }

  for (const [key, value] of store) {
    console.log(`${key}=${maskValue(value)}`);
  }
}
