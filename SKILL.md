---
name: env
description: Sync global environment variables into this project. Use when setting up .env files, pulling API keys, or configuring environment variables for a project. IMPORTANT — automatically invoke this skill whenever a command, build, or test fails due to a missing or invalid environment variable or API key. Common symptoms include "API key not set", "ANTHROPIC_API_KEY not found", "missing environment variable", "API connection error", "authentication failed", "unauthorized", or missing .env file. Do not ask the user to manually set keys — run this skill to pull them from the global store first.
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
- `OPENAI_API_KEY` vs `OPENAI_KEY`
- `STRIPE_SECRET_KEY` vs `STRIPE_API_KEY` vs `STRIPE_KEY`

**Project-specific keys stay out.** The global store is for account-level credentials that are the same in every project (LLM provider keys, third-party API keys). Do not map a key whose value belongs to one project, even when a key with that name exists in the global store:
- URLs, hosts and connection strings: `DATABASE_URL`, `REDIS_URL`, `SUPABASE_URL`, `NEXT_PUBLIC_APP_URL`, anything ending in `_URL`, `_URI`, `_HOST` or `_ENDPOINT`
- Keys issued per project or per app: Supabase and Firebase project keys, webhook signing secrets, OAuth client IDs and secrets
- Secrets generated for one app: `NEXTAUTH_SECRET`, `JWT_SECRET`, `SESSION_SECRET`

Leave these out of `.env-pull.json`. The user sets them in this project's `.env`. When unsure whether a key is project-specific, ask the user before mapping it.

**One-to-many**: A single global key can map to multiple project keys. For example, global `STRIPE_PUBLISHABLE_KEY` might be needed as both `STRIPE_PUBLISHABLE_KEY` (server) and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client) in the same project.

**Public prefixes expose the value.** `VITE_`, `NEXT_PUBLIC_`, `REACT_APP_`, `NUXT_PUBLIC_`, `EXPO_PUBLIC_` and `PUBLIC_` put the value into the JavaScript every visitor downloads. When the code asks for a public-prefixed name, map it so the project runs, and note every case where the global key is a secret (anything other than a publishable or anon key) so you can report it in Step 8.

## Step 5: Write .env-pull.json

Write a `.env-pull.json` file in the project root with the mappings. Left side is the project key name, right side is the global key name:

```json
{
  "mappings": {
    "OPENAI_API_KEY": "OPENAI_API_KEY",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "STRIPE_PUBLISHABLE_KEY",
    "ANTHROPIC_API_KEY": "ANTHROPIC_API_KEY"
  }
}
```

## Step 6: Pull

Run `envall pull .env-pull.json --skip` to copy keys into the project `.env` without overwriting existing values.

## Step 7: Handle missing keys

If any required keys are NOT in the global store, run `envall ui` **in the background** to open the browser UI so the user can add them. It is a server that keeps running until stopped, so a foreground call never returns. Tell the user which keys are missing and that they can paste the values into the UI, and ask them to reply when they are done. Project-specific values (Step 4) go in the Project panel of the same UI, not the Global Store panel.

After the user confirms, stop the background `envall ui` process, then run `envall pull .env-pull.json --skip` again to pull the newly added keys.

## Step 8: Report results

Tell the user:
- Which keys were synced successfully
- Which keys were missing and added via the UI
- Which project-specific keys were left out, for the user to set in this project's `.env`
- Which secret keys were mapped to a public-prefixed name (`VITE_`, `NEXT_PUBLIC_`, ...): tell the user the value is readable by anyone who opens the app in a browser, and that a deployed app should keep the key unprefixed and call the provider from a server route
- Remind the user they can run `envall status` to check sync state later

## Rules

- **NEVER read `~/.env-global/.env`** — only read `.env.available`
- **NEVER run `envall get --unmask`** — only use `envall get` (masked output) if checking key existence
- **NEVER log or display key values** — only key names
- Use `envall pull` for all key copying — never use grep/sed on the global .env file directly
