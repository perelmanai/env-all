import { existsSync } from 'node:fs';
import { readStore } from '../lib/store.js';
import { config } from '../lib/config.js';

function maskValue(value) {
  if (value.length <= 4) return '****';
  const start = value.slice(0, 2);
  const end = value.slice(-3);
  return `${start}...${end}`;
}

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
