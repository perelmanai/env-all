import { homedir } from 'node:os';
import { join } from 'node:path';

const ENV_GLOBAL_DIR = join(homedir(), '.env-global');

export function validateProfile(profile) {
  if (!profile) return;
  if (/[\/\\]|\.\./.test(profile)) {
    console.error(`Invalid profile name: ${profile}`);
    process.exit(1);
  }
}

export const config = {
  dir: ENV_GLOBAL_DIR,
  envFile: join(ENV_GLOBAL_DIR, '.env'),
  availableFile: join(ENV_GLOBAL_DIR, '.env.available'),
  defaultProjectEnv: '.env',

  envFileForProfile(profile) {
    validateProfile(profile);
    if (!profile) return this.envFile;
    return join(ENV_GLOBAL_DIR, `.env.${profile}`);
  },

  availableFileForProfile(profile) {
    validateProfile(profile);
    if (!profile) return this.availableFile;
    return join(ENV_GLOBAL_DIR, `.env.${profile}.available`);
  },
};
