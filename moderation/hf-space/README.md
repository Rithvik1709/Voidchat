---
title: Nullchat Guard
emoji: 🔥
colorFrom: red
colorTo: gray
sdk: gradio
sdk_version: 6.30.0
app_file: app.py
pinned: false
---

Room safety guard for Nullchat: Llama Guard 3 1B behind a small authenticated API.
Requests must carry the `x-guard-secret` header. Message text is never stored or logged.
