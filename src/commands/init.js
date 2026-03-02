import { mkdirSync, existsSync, writeFileSync, chmodSync } from 'node:fs';
import { config } from '../lib/config.js';

export function initCommand() {
  if (existsSync(config.dir)) {
    console.log(`Already initialized: ${config.dir}`);
    return;
  }

  mkdirSync(config.dir, { recursive: true });
  writeFileSync(config.envFile, '', 'utf-8');
  chmodSync(config.envFile, 0o600);
  writeFileSync(config.availableFile, '', 'utf-8');

  console.log(`Created ${config.dir}`);
  console.log(`Global env file: ${config.envFile}`);
}
