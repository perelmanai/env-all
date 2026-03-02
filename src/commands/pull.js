import { createInterface } from 'node:readline';
import { readFileSync, existsSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { readStore } from '../lib/store.js';
import { regenerateAvailable } from '../lib/available.js';
import { readProjectEnv, setProjectKey } from '../lib/env-file.js';
import { config } from '../lib/config.js';

function promptConflict(key, localValue, globalValue) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(`\nConflict: ${key}`);
    console.log(`  Local:  ${localValue}`);
    console.log(`  Global: ${globalValue}`);
    rl.question('  [s]kip / [o]verwrite / [S]kip all / [O]verwrite all: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptChoice(question, choices) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    for (let i = 0; i < choices.length; i++) {
      console.log(`  ${i + 1}) ${choices[i]}`);
    }
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptText(question, defaultValue) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const suffix = defaultValue ? ` (${defaultValue}): ` : ': ';
    rl.question(question + suffix, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

/**
 * Parse a key spec like "GLOBAL_KEY" or "GLOBAL_KEY:LOCAL_KEY".
 * Returns { globalKey, localKey }.
 */
function parseKeySpec(spec) {
  const colonIndex = spec.indexOf(':');
  if (colonIndex === -1) {
    return { globalKey: spec, localKey: spec };
  }
  return {
    globalKey: spec.slice(0, colonIndex),
    localKey: spec.slice(colonIndex + 1),
  };
}

/**
 * Parse a .env-pull.json file into an array of { globalKey, localKey }.
 */
function parsePullJson(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);

  if (!data.mappings || typeof data.mappings !== 'object') {
    console.error(`Invalid pull JSON: expected { "mappings": { "PROJECT_KEY": "GLOBAL_KEY", ... } }`);
    process.exit(1);
  }

  return Object.entries(data.mappings).map(([localKey, globalKey]) => ({
    globalKey,
    localKey,
  }));
}

/**
 * Ensure .env is listed in the nearest .gitignore.
 * Checks the directory containing the target env file.
 */
function ensureGitignore(envFilePath) {
  const dir = dirname(envFilePath);
  const gitignorePath = resolve(dir, '.gitignore');

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8');
    const lines = content.split('\n').map((l) => l.trim());
    if (lines.includes('.env')) return;
    // .env not in gitignore — append it
    const separator = content.endsWith('\n') ? '' : '\n';
    appendFileSync(gitignorePath, `${separator}.env\n`, 'utf-8');
    console.log('  Added .env to .gitignore');
  } else {
    writeFileSync(gitignorePath, '.env\n', 'utf-8');
    console.log('  Created .gitignore with .env');
  }
}

/**
 * Interactive key selection mode.
 * Shows available global keys, lets user pick and optionally rename.
 */
async function interactivePull(store) {
  const keys = [...store.keys()];
  if (keys.length === 0) {
    console.log('No keys in global store.');
    return [];
  }

  console.log('\nAvailable global keys:');
  for (let i = 0; i < keys.length; i++) {
    console.log(`  ${i + 1}) ${keys[i]}`);
  }

  const answer = await promptText('\nEnter numbers to pull (comma-separated, e.g. 1,3,5)', '');
  if (!answer) return [];

  const indices = answer.split(',').map((s) => parseInt(s.trim(), 10) - 1);
  const specs = [];

  for (const idx of indices) {
    if (idx < 0 || idx >= keys.length || isNaN(idx)) continue;
    const globalKey = keys[idx];
    const localKey = await promptText(`  Local name for ${globalKey}`, globalKey);
    specs.push({ globalKey, localKey });
  }

  return specs;
}

export async function pullCommand(keySpecs, options) {
  if (!existsSync(config.dir)) {
    console.error('Not initialized. Run: envall init');
    process.exit(1);
  }

  const profile = options.profile || undefined;
  const envFile = resolve(options.env || config.defaultProjectEnv);

  // Regenerate .env.available in case .env was manually edited
  regenerateAvailable(profile);

  const store = readStore(profile);

  // Determine key specs from arguments
  let specs;

  if (options.interactive) {
    // Interactive mode: let user pick from available keys
    specs = await interactivePull(store);
    if (specs.length === 0) {
      console.log('Nothing selected.');
      return;
    }
  } else if (!keySpecs || keySpecs.length === 0) {
    console.error('Specify keys to pull. Examples:');
    console.error('  envall pull OPENAI_API_KEY DATABASE_URL');
    console.error('  envall pull OPENAI_API_KEY:VITE_OPENAI_API_KEY');
    console.error('  envall pull .env-pull.json');
    console.error('  envall pull -i');
    process.exit(1);
  } else if (keySpecs.length === 1 && keySpecs[0].endsWith('.json')) {
    // JSON file mode
    const jsonPath = resolve(keySpecs[0]);
    if (!existsSync(jsonPath)) {
      console.error(`File not found: ${jsonPath}`);
      process.exit(1);
    }
    specs = parsePullJson(jsonPath);
  } else {
    // Key spec mode
    specs = keySpecs.map(parseKeySpec);
  }

  // Ensure .env is in .gitignore before writing any keys
  ensureGitignore(envFile);

  const projectEnv = existsSync(envFile) ? readProjectEnv(envFile) : new Map();

  let conflictPolicy = null; // null = ask, 'skip' = skip all, 'overwrite' = overwrite all

  if (options.overwrite) conflictPolicy = 'overwrite';
  if (options.skip) conflictPolicy = 'skip';

  let added = 0;
  let skipped = 0;
  let overwritten = 0;
  const missing = [];

  for (const { globalKey, localKey } of specs) {
    const globalValue = store.get(globalKey);
    if (globalValue === undefined) {
      missing.push(globalKey);
      continue;
    }

    const localValue = projectEnv.get(localKey);

    // Key doesn't exist locally — just add it
    if (localValue === undefined) {
      setProjectKey(envFile, localKey, globalValue);
      projectEnv.set(localKey, globalValue); // update in-memory for subsequent iterations
      added++;
      console.log(`  + ${localKey}`);
      continue;
    }

    // Same value — skip silently
    if (localValue === globalValue) {
      skipped++;
      continue;
    }

    // Conflict
    if (conflictPolicy === 'skip') {
      skipped++;
      continue;
    }

    if (conflictPolicy === 'overwrite') {
      setProjectKey(envFile, localKey, globalValue);
      projectEnv.set(localKey, globalValue);
      overwritten++;
      console.log(`  ~ ${localKey} (overwritten)`);
      continue;
    }

    // Interactive conflict resolution
    const answer = await promptConflict(localKey, localValue, globalValue);

    switch (answer) {
      case 'o':
        setProjectKey(envFile, localKey, globalValue);
        projectEnv.set(localKey, globalValue);
        overwritten++;
        console.log(`  ~ ${localKey} (overwritten)`);
        break;
      case 'O':
        setProjectKey(envFile, localKey, globalValue);
        projectEnv.set(localKey, globalValue);
        overwritten++;
        conflictPolicy = 'overwrite';
        console.log(`  ~ ${localKey} (overwritten)`);
        break;
      case 'S':
        skipped++;
        conflictPolicy = 'skip';
        break;
      case 's':
      default:
        skipped++;
        break;
    }
  }

  // Summary
  console.log('');
  const parts = [];
  if (added) parts.push(`${added} added`);
  if (overwritten) parts.push(`${overwritten} overwritten`);
  if (skipped) parts.push(`${skipped} skipped`);
  if (missing.length) parts.push(`${missing.length} not found`);
  console.log(parts.join(', ') || 'Nothing to do.');

  if (missing.length) {
    console.log(`\nMissing from global store: ${missing.join(', ')}`);
  }
}
