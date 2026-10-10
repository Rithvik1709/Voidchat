# Nullchat room guard

A safety agent that watches every room and ends it when someone discusses something
seriously harmful or illegal. It runs **Llama Guard 3 1B** on your own Railway project,
so message text never goes to an outside AI company.

## How it works

```
member's browser ──(decrypted text, every ~3s)──▶ Next.js /api/groups/:id/moderate
                                                        │  checks the room proof
                                                        ▼
                                          guard (Railway, public, needs secret)
                                                        │  caches verdicts by hash
                                                        ▼
                                    ollama + llama-guard3:1b (Railway, private only)
```

- Every member's browser checks the messages it can read, so one person turning it off
  in their own browser is still checked by everyone else's.
- When the verdict includes a **severe category**, the **server** deletes the room and its
  media; browsers then show the normal "room closed" screen. A browser can never end a
  room just by claiming a bad verdict.
- The same message checked by several members costs one model call (in-memory cache,
  keyed by a hash; no text is stored or logged anywhere).
- If the guard is down, rooms keep working (fail open).

### What ends a room

Default `TERMINATE_CATEGORIES=S1,S2,S3,S4,S9`:

| Code | Category | Ends room by default |
|---|---|---|
| S1 | Violent crimes | yes |
| S2 | Non-violent crimes (fraud, hacking, drug dealing…) | yes |
| S3 | Sex-related crimes | yes |
| S4 | Child sexual exploitation | yes |
| S9 | Indiscriminate weapons (bombs, chemical…) | yes |
| S5–S8, S10–S13 | Defamation, specialised advice, privacy, IP, hate, self-harm, sexual content, elections | no |

Self-harm (S11) deliberately does **not** end a room. Change the list with the
`TERMINATE_CATEGORIES` variable on the guard service, no redeploy of the app needed.

## Deploy on Railway

You need a Railway account and this repo on GitHub.

### 1. Model service (`ollama`)

1. Railway → **New Project** → **Deploy from GitHub repo** → pick this repo.
2. Rename the service to **`ollama`**.
3. **Settings → Source → Root Directory:** `moderation/ollama`
4. Do **not** generate a public domain. It should only be reachable inside the project.
5. **Settings → Resources:** give it at least **2 GB RAM** (the model needs ~1 GB).

The first build downloads the model into the image (~1 GB), so it takes a few minutes.

### 2. Guard service (`guard`)

1. In the same project: **New → GitHub Repo** → this repo again. Rename it **`guard`**.
2. **Root Directory:** `moderation/guard`
3. **Variables:**

   | Name | Value |
   |---|---|
   | `GUARD_SECRET` | a long random string, e.g. output of `openssl rand -hex 32` |
   | `OLLAMA_URL` | `http://${{ollama.RAILWAY_PRIVATE_DOMAIN}}:11434` |
   | `TERMINATE_CATEGORIES` | optional, defaults to `S1,S2,S3,S4,S9` |

4. **Settings → Networking → Generate Domain** (port `8080`). Copy the URL.
5. Check it: open `https://<your-guard-domain>/health`. You should see `{"ok":true,...}`.

### 3. Connect the app (Vercel)

In the Vercel project → **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `MODERATION_URL` | `https://<your-guard-domain>` |
| `MODERATION_SECRET` | the same value as `GUARD_SECRET` |

Redeploy. Without these two variables the app simply skips the check, which is also
what happens in local development.

## Tests

```bash
cd moderation/guard && node --test      # verdict parsing and decisions
cd chat-app && npx vitest run tests/moderation.test.ts tests/api/moderate.test.ts
```

## Known limits

- A 1B model is fast and cheap but not perfect. In local testing it caught bomb-making
  and account-hacking talk, but missed a plain "I sell coke" message. For stronger
  coverage, switch `GUARD_MODEL=llama-guard3:8b` (and the `ollama pull` line in
  `ollama/Dockerfile`); that needs much more RAM, ideally a GPU.
- Only text is checked, not images or voice notes.
- The check sees message text in plain form on your own servers while it is judged.
