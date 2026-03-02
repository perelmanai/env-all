# env-all

**Store your API keys once. Use them in every project.**

Tired of copying the same `OPENAI_API_KEY` into every new project's `.env`? env-all keeps all your keys in one place (`~/.env-global/.env`) and lets you pull them into any project with a single command.

```
npm install -g env-all
```

---

## Quick Start

### With Claude Code Skill

```bash
mkdir -p ~/.claude/skills/env
cp skill.md ~/.claude/skills/env/SKILL.md
```

Then use it by typing /env in Claude Code in any project. Claude will install env-all, scan your project for required env vars, and pull them from your global store automatically.

### With simple UI

```bash
npm install -g env-all
envall init
envall ui
```

This opens a split-screen editor with your global key store on the left and the current project's `.env` on the right. Add keys, copy values between sides, and manage everything visually.

### CLI only

```bash
npm install -g env-all
envall init

# Add keys from the terminal (hidden input, not saved to shell history)
envall set OPENAI_API_KEY
envall set STRIPE_SECRET_KEY
envall set DATABASE_URL

# In any project directory, pull what you need
cd ~/my-project
envall pull OPENAI_API_KEY STRIPE_SECRET_KEY DATABASE_URL
```

Either way, env-all adds `.env` to your `.gitignore` automatically.

---

## Why

- **One source of truth.** Stop maintaining the same keys across 15 projects.
- **Rename on pull.** `envall pull OPENAI_API_KEY:VITE_OPENAI_API_KEY` handles framework prefixes.
- **AI-friendly.** AI coding assistants can scan your project, generate a `.env-pull.json` mapping, and pull keys automatically -- without ever seeing the actual values.
- **Zero dependencies.** Just `commander` for CLI parsing. No runtime overhead in your projects.
- **Browser UI.** `envall ui` opens a split-screen editor showing your global keys alongside the current project's `.env`.

---

## Commands

| Command | Description |
|---------|-------------|
| `envall init` | Create `~/.env-global/` directory |
| `envall set KEY` | Store a key (prompts for hidden input) |
| `envall set KEY=VALUE` | Store a key (value in shell history) |
| `envall get KEY` | Show a key (masked). Add `--unmask` for raw value |
| `envall list` | List all keys with masked values |
| `envall rm KEY` | Remove a key |
| `envall open` | Open `~/.env-global/.env` in your editor |
| `envall pull KEY [...]` | Pull keys into project `.env` |
| `envall pull file.json` | Pull keys defined in a JSON mapping file |
| `envall pull -i` | Interactively pick keys to pull |
| `envall status` | Show sync status for current project |
| `envall ui` | Browser-based key manager |

All commands support `--profile <name>` for multiple environments (dev, staging, prod).

---

## Pulling Keys

### Basic

```bash
envall pull OPENAI_API_KEY DATABASE_URL
```

### Rename on pull

When your framework needs a prefix:

```bash
envall pull OPENAI_API_KEY:VITE_OPENAI_API_KEY
envall pull OPENAI_API_KEY:NEXT_PUBLIC_OPENAI_API_KEY
```

The same global key can map to multiple project keys:

```bash
envall pull OPENAI_API_KEY OPENAI_API_KEY:VITE_OPENAI_API_KEY
```

### Pull from a JSON mapping file

For projects with many keys or framework-specific prefixes, define a `.env-pull.json` once and reuse it:

```json
{
  "mappings": {
    "OPENAI_API_KEY": "OPENAI_API_KEY",
    "VITE_OPENAI_API_KEY": "OPENAI_API_KEY",
    "NEXT_PUBLIC_STRIPE_KEY": "STRIPE_SECRET_KEY",
    "DATABASE_URL": "DATABASE_URL"
  }
}
```

```bash
envall pull .env-pull.json
```

The left side is the key name your project expects, the right side is the key name in your global store. This lets you map one global key to multiple project keys with different names (e.g. framework prefixes like `VITE_`, `NEXT_PUBLIC_`).

Commit `.env-pull.json` to your repo so teammates (and AI assistants) can run `envall pull .env-pull.json` to set up their `.env` in one step.

#### Let your AI coding agent generate it

AI coding assistants like Claude Code can create `.env-pull.json` automatically. The agent:

1. Scans your project source for `process.env.*`, `import.meta.env.*`, SDK imports, and config files
2. Reads `~/.env-global/.env.available` (key names only -- never the actual values)
3. Writes a `.env-pull.json` mapping project needs to your available global keys
4. Runs `envall pull .env-pull.json --skip`

The agent never sees your secrets. See the [AI Assistant Integration](#ai-assistant-integration) section below for setup details.

### Conflict handling

When a key already exists in your project `.env` with a different value, env-all prompts you:

```
Conflict: OPENAI_API_KEY
  Local:  sk-old...
  Global: sk-new...
  [s]kip / [o]verwrite / [S]kip all / [O]verwrite all:
```

Or skip the prompt with `--overwrite` or `--skip`.

---

## Profiles

Keep separate key sets for different environments:

```bash
envall set STRIPE_KEY --profile=prod
envall set STRIPE_KEY --profile=dev

envall pull STRIPE_KEY --profile=prod
envall list --profile=dev
```

Each profile is stored as `~/.env-global/.env.<name>`.

---

## Browser UI

```bash
envall ui
```

Opens a split-screen editor in your browser with your global store on the left and the current project's `.env` on the right. Copy values to clipboard and paste where needed -- the same flow as copying keys from an API provider dashboard.

---

## AI Assistant Integration

env-all is designed so AI coding assistants (Claude Code, Cursor, etc.) can set up project env vars without ever reading your actual keys.

### How it works

1. `~/.env-global/.env.available` contains only key **names** (no values), auto-generated from your store.
2. The AI reads `.env.available` to see what keys you have.
3. The AI reads your project code to determine what keys it needs.
4. The AI writes a `.env-pull.json` mapping and runs `envall pull .env-pull.json`.
5. The AI never sees `~/.env-global/.env` or any actual values.

### Claude Code skill

Copy [`skill.md`](skill.md) to `~/.claude/skills/env/SKILL.md`:

```bash
mkdir -p ~/.claude/skills/env
cp skill.md ~/.claude/skills/env/SKILL.md
```

Then run `/env` in any project to have Claude scan your code, generate a `.env-pull.json` mapping, and pull keys automatically.

<details>
<summary><strong>How .env.available works</strong></summary>

Every time you modify the store (`set`, `rm`, `open`), env-all regenerates `~/.env-global/.env.available`. This file contains one key name per line:

```
OPENAI_API_KEY
STRIPE_SECRET_KEY
DATABASE_URL
```

No values. This file is safe for AI assistants to read.

It's also regenerated at the start of `pull` and `status`, so manual edits to `~/.env-global/.env` are always picked up.

</details>

<details>
<summary><strong>Security</strong></summary>

- `~/.env-global/.env` is created with `chmod 600` (owner read/write only).
- `envall set KEY` prompts for hidden input -- the value never appears in shell history.
- `envall set KEY=VALUE` warns you about shell history exposure.
- `envall get` shows masked values by default. `--unmask` is required for raw output.
- `envall list` always masks values.
- `envall pull` output only shows key names, never values.
- `envall ui` binds to `127.0.0.1` only, with a one-time auth token in the URL.
- Profile names are validated to prevent path traversal.
- `.env` is added to `.gitignore` automatically on pull.

env-all stores keys unencrypted, the same as any `.env` file. It is designed for local development, not production secret management.

</details>

---

## License

MIT
