import { existsSync } from 'node:fs';
import { getKey } from '../lib/store.js';
import { config } from '../lib/config.js';
import { maskValue } from '../lib/mask.js';

export function getCommand(key, options) {
  if (!existsSync(config.dir)) {
    console.error('Not initialized. Run: envall init');
    process.exit(1);
  }

  const profile = options.profile || undefined;
  const value = getKey(key, profile);

  if (value === undefined) {
    console.error(`Key not found: ${key}`);
    process.exit(1);
  }

  if (options.unmask) {
    console.log(value);
  } else {
    console.log(maskValue(value));
  }
}
