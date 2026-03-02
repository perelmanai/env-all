---
name: env
description: Sync environment variables in ~/.env-all/.env into this project. Use when setting up .env files, pulling API keys, or configuring environment variables for a project.
---

# /env — Sync global environment variables into this project

You are setting up environment variables for the current project using the `envall` CLI tool. Follow these steps exactly.

## Step 1: Ensure envall is installed

Run `which envall`. If not found, run `npm install -g env-all`. Then run `envall init` if `~/.env-global/` does not exist.

## Step 2: Analyze project needs

Read the project source code to identify all required environment variables. Look for:
- `process.env.VARIABLE_NAME`
- `import.meta.env.VARIABLE_NAME`
- `.env.example` or `.env.template` files
- Framework config files (next.config.*, vite.config.*, etc.)
- SDK imports that imply API keys (e.g., `openai` package -> needs `OPENAI_API_KEY`)

## Step 3: Read available global keys

Read the file `~/.env-global/.env.available`. This file contains only key names (no values), one per line.

**NEVER read `~/.env-global/.env` directly** — that file contains secret values.
**NEVER run `envall get --unmask`** — that exposes secret values.

## Step 4: Map project needs to global keys

Compare the keys the project needs to the available global keys. Handle naming differences using these known framework prefix patterns:

| Framework | Prefix | Example |
|-----------|--------|---------|
| Vite | `VITE_` | `VITE_OPENAI_API_KEY` |
| Next.js (client) | `NEXT_PUBLIC_` | `NEXT_PUBLIC_STRIPE_KEY` |
| Create React App | `REACT_APP_` | `REACT_APP_API_URL` |
| Nuxt (client) | `NUXT_PUBLIC_` | `NUXT_PUBLIC_API_KEY` |
| Nuxt (server) | `NUXT_` | `NUXT_SECRET_KEY` |
| Expo | `EXPO_PUBLIC_` | `EXPO_PUBLIC_API_URL` |
| SvelteKit | `PUBLIC_` | `PUBLIC_API_KEY` |

Also handle common naming variations:
- `DATABASE_URL` vs `DB_URL` vs `POSTGRES_URL`
- `OPENAI_API_KEY` vs `OPENAI_KEY`
- `STRIPE_SECRET_KEY` vs `STRIPE_API_KEY` vs `STRIPE_KEY`

**One-to-many**: A single global key can map to multiple project keys. For example, global `OPENAI_API_KEY` might be needed as both `OPENAI_API_KEY` (server) and `NEXT_PUBLIC_OPENAI_API_KEY` (client) in the same project.

## Step 5: Write .env-pull.json

Write a `.env-pull.json` file in the project root with the mappings. Left side is the project key name, right side is the global key name:

```json
{
  "mappings": {
    "OPENAI_API_KEY": "OPENAI_API_KEY",
    "NEXT_PUBLIC_OPENAI_API_KEY": "OPENAI_API_KEY",
    "DATABASE_URL": "DATABASE_URL"
  }
}
```

## Step 6: Pull

Run `envall pull .env-pull.json --skip` to copy keys into the project `.env` without overwriting existing values.

## Step 7: Report results

Tell the user:
- Which keys were synced successfully
- Which keys the project needs but are NOT in the global store (the user needs to add them with `envall set KEY` or `envall open`)
- Remind the user they can run `envall status` to check sync state later

## Rules

- **NEVER read `~/.env-global/.env`** — only read `.env.available`
- **NEVER run `envall get --unmask`** — only use `envall get` (masked output) if checking key existence
- **NEVER log or display key values** — only key names
- Use `envall pull` for all key copying — never use grep/sed on the global .env file directly
