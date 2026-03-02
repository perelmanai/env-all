import { createInterface } from 'node:readline';
import { existsSync } from 'node:fs';
import { setKey } from '../lib/store.js';
import { regenerateAvailable } from '../lib/available.js';
import { config } from '../lib/config.js';

function promptHidden(prompt) {
  return new Promise((resolve, reject) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const originalWrite = process.stdout.write.bind(process.stdout);
    let muted = false;

    process.stdout.write = (chunk, encoding, callback) => {
      if (muted) {
        return typeof callback === 'function' ? callback() : true;
      }
      return originalWrite(chunk, encoding, callback);
    };

    rl.question(prompt, (answer) => {
      process.stdout.write = originalWrite;
      console.log(); // newline after hidden input
      rl.close();
      resolve(answer);
    });

    rl.on('error', (err) => {
      process.stdout.write = originalWrite;
      rl.close();
      reject(err);
    });

    // Start muting after prompt is written
    muted = true;
  });
}

export async function setCommand(keyValue, options) {
  if (!existsSync(config.dir)) {
    console.error('Not initialized. Run: envall init');
    process.exit(1);
  }

  const profile = options.profile || undefined;
  let key, value;

  if (keyValue.includes('=')) {
    const eqIndex = keyValue.indexOf('=');
    key = keyValue.slice(0, eqIndex);
    value = keyValue.slice(eqIndex + 1);
    console.warn('Warning: value may be saved in shell history. Use "envall set KEY" (without =) for hidden input.');
  } else {
    key = keyValue;
    value = await promptHidden(`Enter value for ${key}: `);
  }

  if (!key) {
    console.error('Key name cannot be empty.');
    process.exit(1);
  }

  setKey(key, value, profile);
  regenerateAvailable(profile);
  console.log(`Set ${key}`);
}
