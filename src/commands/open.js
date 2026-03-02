import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { platform } from 'node:os';
import { config } from '../lib/config.js';

export function openCommand(options) {
  if (!existsSync(config.dir)) {
    console.error('Not initialized. Run: envall init');
    process.exit(1);
  }

  const profile = options.profile || undefined;
  const filePath = config.envFileForProfile(profile);

  let cmd;
  if (platform() === 'darwin') {
    cmd = `open -t "${filePath}"`;
  } else {
    const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
    cmd = `${editor} "${filePath}"`;
  }

  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch {
    console.error(`Failed to open editor. Set $EDITOR or $VISUAL.`);
    process.exit(1);
  }
}
