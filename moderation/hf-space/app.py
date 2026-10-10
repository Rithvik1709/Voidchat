"""Nullchat guard on a free Hugging Face (Gradio) Space.

Llama Guard 3 1B via llama.cpp, behind POST /check that requires the x-guard-secret header.
Message text is never stored or logged; verdicts are cached in memory by hash only, so
several people in a room checking the same message cost one model call.
"""

import hashlib
import hmac
import os
import threading
import time
from collections import OrderedDict

import gradio as gr
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from huggingface_hub import hf_hub_download
from llama_cpp import Llama

from guard import DEFAULT_TERMINATE, build_prompt, build_transcript, parse_category_list, parse_verdict, should_terminate

MODEL_REPO = os.environ.get("GUARD_MODEL_REPO", "QuantFactory/Llama-Guard-3-1B-GGUF")
MODEL_FILE = os.environ.get("GUARD_MODEL_FILE", "Llama-Guard-3-1B.Q8_0.gguf")
SECRET = os.environ.get("GUARD_SECRET", "")
TERMINATE = parse_category_list(os.environ.get("TERMINATE_CATEGORIES")) or DEFAULT_TERMINATE
CACHE_TTL = 15 * 60
CACHE_MAX = 20_000

model_path = os.environ.get("GUARD_MODEL_PATH") or hf_hub_download(MODEL_REPO, MODEL_FILE)
llm = Llama(model_path=model_path, n_ctx=2048, n_threads=os.cpu_count() or 2, verbose=False)
model_lock = threading.Lock()  # one llama.cpp context: run one check at a time

cache = OrderedDict()  # hash -> (time, verdict)
cache_lock = threading.Lock()


def classify(transcript):
    with model_lock:
        out = llm(build_prompt(transcript), max_tokens=12, temperature=0, stop=["<|eot_id|>"])
    return parse_verdict(out["choices"][0]["text"])


def judge(room, context, message):
    key = hashlib.sha256(f"{room}|{message['id']}|{message['text']}".encode()).hexdigest()
    now = time.time()
    with cache_lock:
        hit = cache.get(key)
        if hit and now - hit[0] < CACHE_TTL:
            return hit[1]
    verdict = classify(build_transcript(context, message))
    with cache_lock:
        cache[key] = (now, verdict)
        while len(cache) > CACHE_MAX:
            cache.popitem(last=False)
    return verdict


def clean(m):
    if not isinstance(m, dict) or not isinstance(m.get("text"), str) or not m["text"].strip():
        return None
    return {"id": str(m.get("id", ""))[:64], "sender": str(m.get("sender", "?"))[:32], "text": m["text"][:2000]}


api = FastAPI()


@api.get("/health")
def health():
    return {"ok": bool(SECRET), "model": MODEL_FILE, "terminate": TERMINATE, "configured": bool(SECRET)}


@api.post("/check")
async def check(request: Request):
    if not SECRET:
        return JSONResponse({"error": "GUARD_SECRET is not set"}, status_code=503)
    given = request.headers.get("x-guard-secret", "")
    if not hmac.compare_digest(given.encode(), SECRET.encode()):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "bad json"}, status_code=400)

    room = str(body.get("room", ""))[:128] if isinstance(body, dict) else ""
    messages = [m for m in map(clean, (body.get("messages") or [])[:20]) if m] if isinstance(body, dict) else []
    context = [m for m in map(clean, (body.get("context") or [])[-6:]) if m] if isinstance(body, dict) else []
    if not room or not messages:
        return JSONResponse({"error": "nothing to check"}, status_code=400)

    try:
        flagged, history = [], list(context)
        for m in messages:
            # run the blocking model call off the event loop
            v = await run_in_thread(judge, room, history[-4:], m)
            flagged += [c for c in v["categories"] if c not in flagged]
            history.append(m)
    except Exception as err:  # message text is never included in logs
        print("check failed:", type(err).__name__)
        return JSONResponse({"error": "guard unavailable"}, status_code=502)
    return {"safe": not flagged, "categories": flagged, "terminate": should_terminate(flagged, TERMINATE)}


async def run_in_thread(fn, *args):
    import anyio

    return await anyio.to_thread.run_sync(lambda: fn(*args))


# A tiny page so the Space shows something friendly; the API lives alongside it.
with gr.Blocks(title="Nullchat Guard") as demo:
    gr.Markdown("### Nullchat guard is running\nThis Space only answers authenticated requests from the Nullchat app.")

app = gr.mount_gradio_app(api, demo, path="/")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 7860)))
