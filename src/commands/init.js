import { mkdirSync, existsSync, writeFileSync, chmodSync, copyFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { config } from '../lib/config.js';

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
  const skillSrc = join(__dirname, '..', '..', 'skill.md');
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
  } else {
    mkdirSync(config.dir, { recursive: true });
    writeFileSync(config.envFile, '', 'utf-8');
    chmodSync(config.envFile, 0o600);
    writeFileSync(config.availableFile, '', 'utf-8');

    console.log(`Created ${config.dir}`);
    console.log(`Global env file: ${config.envFile}`);
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
