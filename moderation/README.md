# Nullchat room guard

A safety agent that watches every room and ends it when someone discusses something
seriously harmful or illegal. It runs **Llama Guard 3 1B** on a free Hugging Face Space
you control, so message text never goes to an outside AI company.

## How it works

```
member's browser ──(decrypted text, every ~3s)──▶ Next.js /api/groups/:id/moderate
                                                        │  checks the room proof
                                                        ▼
                              Hugging Face Space (one container, needs secret)
                                guard API  ──▶  ollama + llama-guard3:1b
                                (caches verdicts by hash)
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
`TERMINATE_CATEGORIES` variable on the Space, no redeploy of the app needed.

## Deploy on Hugging Face Spaces (free)

A free **Gradio** Space on "CPU basic" hardware runs the guard (`moderation/hf-space`):
a small Python app that loads Llama Guard 3 1B with llama.cpp and serves the same
`/health` and `/check` endpoints as the Node guard, so the app side doesn't change.

### 1. Create the Space

1. Sign in at huggingface.co → **New → Space**.
2. Name it, e.g. `nullchat-guard`. **SDK: Gradio** (blank template). **Hardware: CPU basic (free)**.
   Keep it **Public**. The guard still refuses every request without your secret.
3. Space → **Settings → Variables and secrets**:

   | Type | Name | Value |
   |---|---|---|
   | Secret | `GUARD_SECRET` | a long random string, e.g. output of `openssl rand -hex 32` |
   | Variable | `TERMINATE_CATEGORIES` | optional, defaults to `S1,S2,S3,S4,S9` |

### 2. Push the code

Create a token with **write** access at <https://huggingface.co/settings/tokens>, then:

```bash
cd moderation/hf-space
HF_TOKEN=hf_xxx SPACE=your-name/nullchat-guard ./deploy.sh
```

The first start installs the packages and downloads the model (~1.6 GB), so it takes a few minutes. When the
Space shows **Running**, check `https://your-name-nullchat-guard.hf.space/health`. You
should see `{"ok":true,...}`.

### 3. Connect the app (Vercel)

In the Vercel project → **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `MODERATION_URL` | `https://your-name-nullchat-guard.hf.space` |
| `MODERATION_SECRET` | the same value as `GUARD_SECRET` |

Redeploy. Without these two variables the app simply skips the check, which is also
what happens in local development.

### Free-tier behaviour

A free Space **sleeps after about 48 hours with no traffic**. The next check wakes it,
which takes a few minutes (it re-downloads the model); until then rooms carry on unchecked (the guard fails open) and
checking resumes by itself once it's awake. Any activity in a room keeps it awake.

## Paid alternative: Railway

`moderation/ollama` and `moderation/guard` deploy as two Railway services if you ever want
an always-on host:

1. Service **`ollama`**: root directory `moderation/ollama`, no public domain, at least 2 GB RAM.
2. Service **`guard`**: root directory `moderation/guard`, variables `GUARD_SECRET` and
   `OLLAMA_URL=http://${{ollama.RAILWAY_PRIVATE_DOMAIN}}:11434`, generate a public domain on port 8080.
3. Point `MODERATION_URL` / `MODERATION_SECRET` in Vercel at it as above.

## Tests

```bash
cd moderation/hf-space && python3 -m unittest test_guard   # Space: verdict parsing and decisions
cd moderation/guard && node --test      # Node guard (Railway option)
cd chat-app && npx vitest run tests/moderation.test.ts tests/api/moderate.test.ts
```

## Known limits

- A 1B model is fast and cheap but not perfect. In local testing it caught bomb-making
  and account-hacking talk, but missed a plain "I sell coke" message. For stronger
  coverage, point `GUARD_MODEL_REPO` / `GUARD_MODEL_FILE` at a Llama Guard 3 8B GGUF; it is
  much slower on the free CPU Space.
- Only text is checked, not images or voice notes.
- The check sees message text in plain form on your own servers while it is judged.
