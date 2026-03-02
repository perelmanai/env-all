import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { regenerateAvailable } from '../lib/available.js';
import { readProjectEnv } from '../lib/env-file.js';
import { config } from '../lib/config.js';

export function statusCommand(options) {
  if (!existsSync(config.dir)) {
    console.error('Not initialized. Run: envall init');
    process.exit(1);
  }

  const profile = options.profile || undefined;
  const envFile = resolve(options.env || config.defaultProjectEnv);
  const pullJsonPath = resolve(options.pullFile || '.env-pull.json');

  // Regenerate .env.available
  regenerateAvailable(profile);

  // Read available global key names
  const availPath = config.availableFileForProfile(profile);
  const globalKeys = existsSync(availPath)
    ? readFileSync(availPath, 'utf-8')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    : [];
  const globalKeySet = new Set(globalKeys);

  // Read project .env
  const projectEnv = existsSync(envFile) ? readProjectEnv(envFile) : new Map();

  // Read .env-pull.json if it exists
  if (!existsSync(pullJsonPath)) {
    console.log(`No ${options.pullFile || '.env-pull.json'} found in this directory.`);
    console.log('Run /env skill or create one manually to track required keys.\n');

    if (projectEnv.size > 0) {
      console.log(`Project .env has ${projectEnv.size} key(s): ${[...projectEnv.keys()].join(', ')}`);
    } else {
      console.log('Project .env is empty or missing.');
    }
    console.log(`Global store has ${globalKeys.length} key(s): ${globalKeys.join(', ')}`);
    return;
  }

  let pullConfig;
  try {
    pullConfig = JSON.parse(readFileSync(pullJsonPath, 'utf-8'));
  } catch (e) {
    console.error(`Failed to parse ${pullJsonPath}: ${e.message}`);
    process.exit(1);
  }

  if (!pullConfig.mappings || typeof pullConfig.mappings !== 'object') {
    console.error('Invalid .env-pull.json: expected { "mappings": { ... } }');
    process.exit(1);
  }

  const mappings = Object.entries(pullConfig.mappings); // [localKey, globalKey][]

  const synced = [];
  const missingLocal = [];
  const missingGlobal = [];

  for (const [localKey, globalKey] of mappings) {
    const inProject = projectEnv.has(localKey);
    const inGlobal = globalKeySet.has(globalKey);

    if (inProject && inGlobal) {
      synced.push(localKey);
    } else if (!inGlobal) {
      missingGlobal.push({ localKey, globalKey });
    } else if (!inProject) {
      missingLocal.push({ localKey, globalKey });
    }
  }

  // Report
  if (synced.length) {
    console.log(`Synced (${synced.length}):`);
    for (const key of synced) {
      console.log(`  + ${key}`);
    }
  }

  if (missingLocal.length) {
    console.log(`\nMissing from project .env (${missingLocal.length}):`);
    for (const { localKey, globalKey } of missingLocal) {
      const label = localKey === globalKey ? localKey : `${localKey} (from ${globalKey})`;
      console.log(`  - ${label}`);
    }
    console.log('  Run: envall pull .env-pull.json');
  }

  if (missingGlobal.length) {
    console.log(`\nMissing from global store (${missingGlobal.length}):`);
    for (const { globalKey } of missingGlobal) {
      console.log(`  - ${globalKey}`);
    }
    console.log('  Run: envall set KEY or envall open');
  }

  if (!synced.length && !missingLocal.length && !missingGlobal.length) {
    console.log('No mappings defined in .env-pull.json.');
  }
}
