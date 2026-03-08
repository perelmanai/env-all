import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { platform } from 'node:os';
import { randomBytes } from 'node:crypto';
import { readStore, setKey, removeKey } from '../lib/store.js';
import { regenerateAvailable } from '../lib/available.js';
import { readProjectEnv, setProjectKey } from '../lib/env-file.js';
import { parseEnvFile, serializeEntries } from '../lib/store.js';
import { config } from '../lib/config.js';
import { writeFileSync } from 'node:fs';

const TOKEN = randomBytes(16).toString('hex');

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function checkToken(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const t = url.searchParams.get('token') || req.headers['x-token'];
  if (t !== TOKEN) {
    json(res, 403, { error: 'Forbidden' });
    return false;
  }
  return true;
}

function removeProjectKey(filePath, keyToRemove) {
  const entries = parseEnvFile(filePath);
  const filtered = entries.filter((e) => !(e.type === 'pair' && e.key === keyToRemove));
  if (filtered.length === entries.length) return false;
  writeFileSync(filePath, serializeEntries(filtered), 'utf-8');
  return true;
}

function buildHTML(projectEnvPath, projectExists) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>envall</title>
<style>
  :root {
    --bg: #f5efe6; --bg-surface: #fff; --bg-muted: #ece6db;
    --text: #3d3929; --text-heading: #1a1610; --text-muted: #9a9080; --text-subtle: #6b5f4e;
    --border: #ddd5c8; --border-hover: #c4b9a8;
    --accent: #d97757; --accent-hover: #c4623f;
    --danger: #c0392b; --danger-bg: #fdf0ee;
    --divider: #ddd5c8;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #1a1714; --bg-surface: #262220; --bg-muted: #2e2a26;
      --text: #d4cbbe; --text-heading: #ece4d8; --text-muted: #7a7168; --text-subtle: #9a9080;
      --border: #3a3530; --border-hover: #524b44;
      --accent: #d97757; --accent-hover: #e8896b;
      --danger: #e07060; --danger-bg: #2e2220;
      --divider: #3a3530;
    }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Styrene A', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); padding: 1.5rem; }
  .header { text-align: center; margin-bottom: 1.5rem; }
  .header h1 { font-size: 1.25rem; font-weight: 600; color: var(--text-heading); }
  .header .subtitle { color: var(--text-muted); font-size: 0.8rem; margin-top: 0.15rem; }
  .panels { display: flex; gap: 1.5rem; align-items: flex-start; }
  .panel { flex: 1; min-width: 0; }
  .panel-title { font-size: 0.85rem; font-weight: 600; color: var(--text-heading); margin-bottom: 0.15rem; }
  .panel-path { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.75rem; word-break: break-all; }
  .key-row { display: flex; gap: 0.35rem; align-items: center; margin-bottom: 0.4rem; }
  .key-row input { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.8rem; padding: 0.4rem 0.5rem; border: 1px solid var(--border); border-radius: 5px; background: var(--bg-surface); color: var(--text); outline: none; transition: border-color 0.15s; min-width: 0; }
  .key-row input:focus { border-color: var(--accent); }
  .key-row input[readonly] { background: var(--bg-muted); color: var(--text-subtle); }
  .key-name { width: 170px; flex-shrink: 0; }
  .key-value { flex: 1; min-width: 0; }
  .btn { padding: 0.4rem 0.55rem; border: 1px solid var(--border); border-radius: 5px; background: var(--bg-surface); color: var(--text); cursor: pointer; font-size: 0.75rem; white-space: nowrap; transition: all 0.15s; }
  .btn:hover { background: var(--bg-muted); border-color: var(--border-hover); }
  .btn-icon { padding: 0.4rem 0.45rem; font-size: 0.8rem; line-height: 1; }
  .btn-danger { color: var(--danger); }
  .btn-danger:hover { background: var(--danger-bg); border-color: var(--danger); }
  .btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  .btn-primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
  .btn-update { background: var(--accent); color: #fff; border-color: var(--accent); display: none; }
  .btn-update:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
  .btn-update.visible { display: inline-block; }
  .btn-copied { background: var(--accent); color: #fff; border-color: var(--accent); }
  .add-row { display: flex; gap: 0.35rem; margin-top: 0.6rem; }
  .add-row input { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.8rem; padding: 0.4rem 0.5rem; border: 1px solid var(--border); border-radius: 5px; background: var(--bg-surface); color: var(--text); outline: none; transition: border-color 0.15s; min-width: 0; }
  .add-row input:focus { border-color: var(--accent); }
  .toast { position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%); background: var(--accent); color: #fff; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.8rem; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
  .toast.show { opacity: 1; }
  .empty { color: var(--text-muted); font-style: italic; font-size: 0.85rem; margin: 0.5rem 0; }
  .divider { width: 1px; background: var(--divider); align-self: stretch; flex-shrink: 0; }
</style>
</head>
<body>

<div class="header">
  <h1>envall</h1>
  <p class="subtitle">Cross-project environment variable manager</p>
</div>

<div class="panels">
  <div class="panel">
    <div class="panel-title">Global Store</div>
    <div class="panel-path">~/.env-global/.env</div>
    <div id="global-keys"></div>
    <div class="add-row">
      <input class="key-name" id="g-new-key" placeholder="KEY_NAME">
      <input class="key-value" id="g-new-value" type="password" placeholder="value">
      <button class="btn btn-primary" onclick="addGlobal()">Add</button>
    </div>
  </div>
  <div class="divider"></div>
  <div class="panel">
    <div class="panel-title">Project${projectExists ? '' : ' <span style="color:var(--danger);font-weight:400;font-size:0.75rem">(file does not exist yet)</span>'}</div>
    <div class="panel-path">${esc(projectEnvPath)}</div>
    <div id="project-keys"></div>
    <div class="add-row">
      <input class="key-name" id="p-new-key" placeholder="KEY_NAME">
      <input class="key-value" id="p-new-value" type="password" placeholder="value">
      <button class="btn btn-primary" onclick="addProject()">Add</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
const TOKEN = new URLSearchParams(location.search).get('token');
const headers = { 'Content-Type': 'application/json', 'X-Token': TOKEN };

let globalKeys = [];
let projectKeys = [];
let revealing = {};

async function load() {
  const [gRes, pRes] = await Promise.all([
    fetch('/api/global?token=' + TOKEN),
    fetch('/api/project?token=' + TOKEN),
  ]);
  globalKeys = await gRes.json();
  projectKeys = await pRes.json();
  render();
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1800);
}

function esc(s) { return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function rk(side, key) { return side + ':' + key; }

function renderPanel(containerId, keys, side) {
  const el = document.getElementById(containerId);
  if (keys.length === 0) {
    el.innerHTML = '<p class="empty">No keys.</p>';
    return;
  }
  let html = '';
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const id = rk(side, k.key);
    const type = revealing[id] ? 'text' : 'password';
    const eyeLabel = revealing[id] ? 'Hide' : 'Show';
    html += '<div class="key-row" id="row-' + side + '-' + i + '">'
      + '<input class="key-name" value="' + esc(k.key) + '" data-side="' + side + '" data-idx="' + i + '" data-field="name" data-orig="' + esc(k.key) + '">'
      + '<input class="key-value" type="' + type + '" value="' + esc(k.value) + '" data-side="' + side + '" data-idx="' + i + '" data-field="value" data-orig="' + esc(k.value) + '">'
      + '<button class="btn btn-icon btn-update" id="upd-' + side + '-' + i + '" onclick="updateKey(\\'' + side + '\\',' + i + ')">Update</button>'
      + '<button class="btn btn-icon" onclick="copyVal(\\'' + side + '\\',' + i + ')" title="Copy value" id="copy-' + side + '-' + i + '">Copy</button>'
      + '<button class="btn btn-icon" onclick="toggleReveal(\\'' + esc(id) + '\\')">' + eyeLabel + '</button>'
      + '<button class="btn btn-icon btn-danger" onclick="removeKey(\\'' + side + '\\',' + i + ')" title="Delete">Del</button>'
      + '</div>';
  }
  el.innerHTML = html;
}

function render() {
  renderPanel('global-keys', globalKeys, 'g');
  renderPanel('project-keys', projectKeys, 'p');
}

function toggleReveal(id) {
  revealing[id] = !revealing[id];
  render();
}

async function copyVal(side, idx) {
  const keys = side === 'g' ? globalKeys : projectKeys;
  const val = keys[idx].value;
  await navigator.clipboard.writeText(val);
  const btn = document.getElementById('copy-' + side + '-' + idx);
  btn.textContent = 'Copied';
  btn.classList.add('btn-copied');
  toast('Copied ' + keys[idx].key);
  setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('btn-copied'); }, 1500);
}

async function addGlobal() {
  const key = document.getElementById('g-new-key').value.trim();
  const value = document.getElementById('g-new-value').value;
  if (!key) return;
  await fetch('/api/global', { method: 'POST', headers, body: JSON.stringify({ key, value }) });
  document.getElementById('g-new-key').value = '';
  document.getElementById('g-new-value').value = '';
  toast('Added ' + key);
  await load();
}

async function addProject() {
  const key = document.getElementById('p-new-key').value.trim();
  const value = document.getElementById('p-new-value').value;
  if (!key) return;
  await fetch('/api/project', { method: 'POST', headers, body: JSON.stringify({ key, value }) });
  document.getElementById('p-new-key').value = '';
  document.getElementById('p-new-value').value = '';
  toast('Added ' + key);
  await load();
}

async function removeKey(side, idx) {
  const keys = side === 'g' ? globalKeys : projectKeys;
  const k = keys[idx].key;
  if (!confirm('Delete ' + k + '?')) return;
  const endpoint = side === 'g' ? '/api/global/' : '/api/project/';
  await fetch(endpoint + encodeURIComponent(k), { method: 'DELETE', headers });
  delete revealing[rk(side, k)];
  toast('Deleted ' + k);
  await load();
}

// Show Update button when name or value is edited
document.addEventListener('input', (e) => {
  const field = e.target.dataset.field;
  if (field !== 'name' && field !== 'value') return;
  const side = e.target.dataset.side;
  const idx = e.target.dataset.idx;
  const row = document.getElementById('row-' + side + '-' + idx);
  const nameInput = row.querySelector('[data-field="name"]');
  const valInput = row.querySelector('[data-field="value"]');
  const dirty = nameInput.value !== nameInput.dataset.orig || valInput.value !== valInput.dataset.orig;
  const btn = document.getElementById('upd-' + side + '-' + idx);
  btn.classList.toggle('visible', dirty);
});

async function updateKey(side, idx) {
  const row = document.getElementById('row-' + side + '-' + idx);
  const nameInput = row.querySelector('[data-field="name"]');
  const valInput = row.querySelector('[data-field="value"]');
  const origKey = nameInput.dataset.orig;
  const newKey = nameInput.value.trim();
  const newVal = valInput.value;
  if (!newKey) return;
  const endpoint = side === 'g' ? '/api/global' : '/api/project';
  const delEndpoint = side === 'g' ? '/api/global/' : '/api/project/';
  if (newKey !== origKey) {
    // Rename: delete old, create new
    await fetch(delEndpoint + encodeURIComponent(origKey), { method: 'DELETE', headers });
    await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ key: newKey, value: newVal }) });
    delete revealing[rk(side, origKey)];
    toast('Renamed ' + origKey + ' → ' + newKey);
  } else {
    await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ key: newKey, value: newVal }) });
    toast('Updated ' + newKey);
  }
  await load();
}

load();
</script>
</body>
</html>`;
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function uiCommand(options) {
  if (!existsSync(config.dir)) {
    console.error('Not initialized. Run: envall init');
    process.exit(1);
  }

  const profile = options.profile || undefined;
  const projectEnvPath = resolve(options.env || config.defaultProjectEnv);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Serve HTML
    if (req.method === 'GET' && url.pathname === '/') {
      if (!checkToken(req, res)) return;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(buildHTML(projectEnvPath, existsSync(projectEnvPath)));
      return;
    }

    // --- Global APIs ---
    if (req.method === 'GET' && url.pathname === '/api/global') {
      if (!checkToken(req, res)) return;
      const store = readStore(profile);
      json(res, 200, [...store.entries()].map(([key, value]) => ({ key, value })));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/global') {
      if (!checkToken(req, res)) return;
      try {
        const { key, value } = await parseBody(req);
        if (!key) return json(res, 400, { error: 'key required' });
        setKey(key, value, profile);
        regenerateAvailable(profile);
        json(res, 200, { ok: true });
      } catch (e) {
        json(res, 400, { error: e.message });
      }
      return;
    }

    if (req.method === 'DELETE' && url.pathname.startsWith('/api/global/')) {
      if (!checkToken(req, res)) return;
      const key = decodeURIComponent(url.pathname.slice('/api/global/'.length));
      const removed = removeKey(key, profile);
      if (!removed) return json(res, 404, { error: 'not found' });
      regenerateAvailable(profile);
      json(res, 200, { ok: true });
      return;
    }

    // --- Project APIs ---
    if (req.method === 'GET' && url.pathname === '/api/project') {
      if (!checkToken(req, res)) return;
      const env = existsSync(projectEnvPath) ? readProjectEnv(projectEnvPath) : new Map();
      json(res, 200, [...env.entries()].map(([key, value]) => ({ key, value })));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/project') {
      if (!checkToken(req, res)) return;
      try {
        const { key, value } = await parseBody(req);
        if (!key) return json(res, 400, { error: 'key required' });
        setProjectKey(projectEnvPath, key, value);
        json(res, 200, { ok: true });
      } catch (e) {
        json(res, 400, { error: e.message });
      }
      return;
    }

    if (req.method === 'DELETE' && url.pathname.startsWith('/api/project/')) {
      if (!checkToken(req, res)) return;
      const key = decodeURIComponent(url.pathname.slice('/api/project/'.length));
      const removed = removeProjectKey(projectEnvPath, key);
      if (!removed) return json(res, 404, { error: 'not found' });
      json(res, 200, { ok: true });
      return;
    }

    json(res, 404, { error: 'not found' });
  });

  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}/?token=${TOKEN}`;
    console.log(`envall UI: ${url}`);
    console.log(`Project env:  ${projectEnvPath}`);
    console.log('Press Ctrl+C to stop.\n');

    try {
      if (platform() === 'darwin') {
        execSync(`open "${url}"`);
      } else if (platform() === 'linux') {
        execSync(`xdg-open "${url}"`);
      }
    } catch {
      // Browser open failed, user can copy the URL
    }
  });
}
