import { mkdirSync, existsSync, chmodSync, copyFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { config } from '../lib/config.js';
import { writeStoreFile } from '../lib/store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function installSkill() {
  const skillSrc = join(__dirname, '..', '..', 'SKILL.md');
  const skillDir = join(homedir(), '.claude', 'skills', 'env');
  const skillDest = join(skillDir, 'SKILL.md');

  if (!existsSync(skillSrc)) {
    console.log('Skill file not found in package. Skipping.');
    return false;
  }

  mkdirSync(skillDir, { recursive: true });
  copyFileSync(skillSrc, skillDest);
  console.log(`Installed Claude Code skill: ${skillDest}`);
  console.log('Use /env in Claude Code to sync env vars into any project.');
  return true;
}

export async function initCommand() {
  // Set up global store
  if (existsSync(config.dir)) {
    console.log(`Already initialized: ${config.dir}`);
    // Stores created by older versions: make the directory and every store file owner-only
    chmodSync(config.dir, 0o700);
    for (const name of readdirSync(config.dir)) {
      if (name.startsWith('.env')) chmodSync(join(config.dir, name), 0o600);
    }
  } else {
    mkdirSync(config.dir, { recursive: true, mode: 0o700 });
    writeStoreFile(config.envFile, '');
    writeStoreFile(config.availableFile, '');

    console.log(`Created ${config.dir}`);
    console.log(`Global env file: ${config.envFile}`);
  }

  // Keep the store out of any git repo that contains it (dotfiles repos, a home directory under git)
  const storeGitignore = join(config.dir, '.gitignore');
  if (!existsSync(storeGitignore)) {
    writeStoreFile(storeGitignore, '*\n');
  }

  // Check for Claude Code skill
  const skillDest = join(homedir(), '.claude', 'skills', 'env', 'SKILL.md');
  if (existsSync(skillDest)) {
    return;
  }

  console.log('');
  console.log('How would you like to use env-all?');
  console.log('');
  console.log('  1. With Claude Code skill (recommended)');
  console.log('     Installs /env — Claude auto-syncs env vars when your project needs them');
  console.log('');
  console.log('  2. CLI only');
  console.log('     Use envall commands manually (set, pull, ui)');
  console.log('');
  const answer = await prompt('Choose [1/2] (default: 1): ');

  if (answer === '' || answer === '1') {
    installSkill();
  } else {
    console.log('You can install the skill later: envall init');
  }
}
