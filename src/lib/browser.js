import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

// Browsers that open a private window from the command line.
// Extensions are off in private windows unless the user has allowed them there.
const PRIVATE_BROWSERS = [
  {
    name: 'Google Chrome',
    bundleId: 'com.google.chrome',
    commands: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'],
    flag: '--incognito',
  },
  {
    name: 'Microsoft Edge',
    bundleId: 'com.microsoft.edgemac',
    commands: ['microsoft-edge', 'microsoft-edge-stable'],
    flag: '--inprivate',
  },
  {
    name: 'Brave Browser',
    bundleId: 'com.brave.browser',
    commands: ['brave-browser', 'brave'],
    flag: '--incognito',
  },
  // Linux only: on macOS a second Firefox launch can fail while Firefox is already running
  { name: 'Firefox', commands: ['firefox'], flag: '--private-window' },
];

/**
 * Bundle id of the macOS default browser, or null when it cannot be read
 * (Safari, the system default, leaves no entry).
 */
function macDefaultBrowserId() {
  const result = spawnSync(
    'defaults',
    ['read', 'com.apple.LaunchServices/com.apple.launchservices.secure', 'LSHandlers'],
    { encoding: 'utf-8' },
  );
  const match = (result.stdout || '').match(
    /LSHandlerRoleAll = "?([^";\s]+)"?;(?:\s*LSHandlerRole\w+ = [^;]+;)*\s*LSHandlerURLScheme = https;/,
  );
  return match ? match[1].toLowerCase() : null;
}

function macAppInstalled(name) {
  return ['/Applications', join(homedir(), 'Applications')].some((dir) => existsSync(join(dir, `${name}.app`)));
}

function openPrivateMac(url) {
  const installed = PRIVATE_BROWSERS.filter((b) => b.bundleId && macAppInstalled(b.name));
  const defaultId = macDefaultBrowserId();
  const browser = installed.find((b) => b.bundleId === defaultId) || installed[0];
  if (!browser) return null;

  // -n: a running browser hands the request to itself and opens the private window
  const result = spawnSync('open', ['-na', browser.name, '--args', browser.flag, url], { stdio: 'ignore' });
  return result.status === 0 ? browser.name : null;
}

function openPrivateLinux(url) {
  const available = [];
  for (const browser of PRIVATE_BROWSERS) {
    const command = browser.commands.find((c) => spawnSync('which', [c], { stdio: 'ignore' }).status === 0);
    if (command) available.push({ ...browser, command });
  }

  // e.g. "google-chrome.desktop", "firefox.desktop"
  const desktop = (spawnSync('xdg-settings', ['get', 'default-web-browser'], { encoding: 'utf-8' }).stdout || '').trim();
  const browser = available.find((b) => b.commands.some((c) => desktop.startsWith(c))) || available[0];
  if (!browser) return null;

  const child = spawn(browser.command, [browser.flag, url], { detached: true, stdio: 'ignore' });
  child.on('error', () => {});
  child.unref();
  return browser.name;
}

/**
 * Open a URL in a private browser window, preferring the default browser.
 * Returns the browser's name, or null when no browser with a private-window option was found.
 */
export function openPrivateWindow(url) {
  if (platform() === 'darwin') return openPrivateMac(url);
  if (platform() === 'linux') return openPrivateLinux(url);
  return null;
}

/**
 * Open a URL in the default browser. Returns false when nothing could be opened.
 */
export function openDefaultBrowser(url) {
  const opener = { darwin: 'open', linux: 'xdg-open' }[platform()];
  if (!opener) return false;
  return spawnSync(opener, [url], { stdio: 'ignore' }).status === 0;
}
