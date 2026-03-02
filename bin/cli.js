#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from '../src/commands/init.js';
import { setCommand } from '../src/commands/set.js';
import { getCommand } from '../src/commands/get.js';
import { listCommand } from '../src/commands/list.js';
import { rmCommand } from '../src/commands/rm.js';
import { openCommand } from '../src/commands/open.js';
import { pullCommand } from '../src/commands/pull.js';
import { statusCommand } from '../src/commands/status.js';
import { uiCommand } from '../src/commands/ui.js';

const program = new Command();

program
  .name('envall')
  .description('Cross-project environment variable manager')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize ~/.env-global/ directory')
  .action(initCommand);

program
  .command('set <key-value>')
  .description('Store a key globally. Use KEY=VALUE or just KEY to be prompted for the value')
  .option('-p, --profile <name>', 'Use a named profile')
  .action(setCommand);

program
  .command('get <key>')
  .description('Show a key (masked by default). Use --unmask to reveal the value')
  .option('--unmask', 'Show the actual value instead of masked')
  .option('-p, --profile <name>', 'Use a named profile')
  .action(getCommand);

program
  .command('list')
  .alias('ls')
  .description('List all keys with masked values')
  .option('-p, --profile <name>', 'Use a named profile')
  .action(listCommand);

program
  .command('rm <key>')
  .description('Remove a key')
  .option('-p, --profile <name>', 'Use a named profile')
  .action(rmCommand);

program
  .command('open')
  .description('Open ~/.env-global/.env in your editor')
  .option('-p, --profile <name>', 'Use a named profile')
  .action(openCommand);

program
  .command('pull [keys...]')
  .alias('fill')
  .description('Pull keys from global store into project .env. Accepts KEY, GLOBAL:LOCAL, or a .json file')
  .option('-e, --env <file>', 'Target env file (default: ./.env)')
  .option('-p, --profile <name>', 'Use a named profile')
  .option('-i, --interactive', 'Interactively select keys from global store')
  .option('--overwrite', 'Overwrite conflicts without prompting')
  .option('--skip', 'Skip conflicts without prompting')
  .action(pullCommand);

program
  .command('status')
  .description('Show sync status between .env-pull.json, global store, and project .env')
  .option('-e, --env <file>', 'Target env file (default: ./.env)')
  .option('-f, --pull-file <file>', 'Pull config file (default: .env-pull.json)')
  .option('-p, --profile <name>', 'Use a named profile')
  .action(statusCommand);

program
  .command('ui')
  .description('Open a browser-based UI to manage keys')
  .option('-e, --env <file>', 'Project env file (default: ./.env)')
  .option('-p, --profile <name>', 'Use a named profile')
  .action(uiCommand);

program.parse();
