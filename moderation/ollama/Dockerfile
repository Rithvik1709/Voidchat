# Private model service: Ollama with Llama Guard 3 1B baked into the image,
# so a fresh deploy never waits on a model download.
FROM ollama/ollama:latest

RUN (ollama serve > /dev/null 2>&1 &) && sleep 6 && ollama pull llama-guard3:1b

# Listen on IPv6 so Railway's private network can reach it; keep the model loaded.
ENV OLLAMA_HOST=[::]:11434 \
    OLLAMA_KEEP_ALIVE=-1 \
    OLLAMA_NUM_PARALLEL=2

EXPOSE 11434
