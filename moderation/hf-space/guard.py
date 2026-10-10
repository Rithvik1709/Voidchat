"""Pure logic for the Nullchat guard: building Llama Guard prompts and reading its answers.
Mirrors moderation/guard/verdict.mjs so both hosts make the same decisions."""

import re

CATEGORIES = {
    "S1": "Violent Crimes",
    "S2": "Non-Violent Crimes",
    "S3": "Sex-Related Crimes",
    "S4": "Child Sexual Exploitation",
    "S5": "Defamation",
    "S6": "Specialized Advice",
    "S7": "Privacy",
    "S8": "Intellectual Property",
    "S9": "Indiscriminate Weapons",
    "S10": "Hate",
    "S11": "Suicide & Self-Harm",
    "S12": "Sexual Content",
    "S13": "Elections",
}

# Categories that end a room unless overridden by TERMINATE_CATEGORIES
DEFAULT_TERMINATE = ["S1", "S2", "S3", "S4", "S9"]


def parse_category_list(value):
    """'S1, s4 ,S99' -> ['S1', 'S4'] (unknown codes are dropped)."""
    if not value:
        return []
    return [c for c in (p.strip().upper() for p in re.split(r"[\s,]+", str(value))) if c in CATEGORIES]


def parse_verdict(raw):
    """Llama Guard replies 'safe', or 'unsafe' plus a line of category codes.
    Anything unexpected counts as safe: a garbled answer must never close a room."""
    text = str(raw or "").strip().lower()
    if not text.startswith("unsafe"):
        return {"safe": True, "categories": []}
    categories = parse_category_list(text[len("unsafe"):].replace("\n", ","))
    return {"safe": len(categories) == 0, "categories": categories}


def should_terminate(categories, terminate_list):
    return any(c in terminate_list for c in categories)


def build_transcript(context, message, max_chars=2400):
    """A few earlier lines for context, then the message being checked last."""
    def line(m):
        text = re.sub(r"\s+", " ", str(m.get("text", "")))[:800]
        return f"{str(m.get('sender', '?'))[:32]}: {text}"

    lines = [line(m) for m in context] + [line(message)]
    out = "\n".join(lines)
    while len(out) > max_chars and len(lines) > 1:
        lines.pop(0)
        out = "\n".join(lines)
    return out[-max_chars:]


def build_prompt(transcript):
    """Llama Guard 3's own prompt format (the tokenizer adds the begin-of-text token)."""
    cats = "\n".join(f"{code}: {name}." for code, name in CATEGORIES.items())
    return (
        "<|start_header_id|>user<|end_header_id|>\n\n"
        "Task: Check if there is unsafe content in 'User' messages in conversations according our "
        "safety policy with the below categories.\n\n"
        f"<BEGIN UNSAFE CONTENT CATEGORIES>\n{cats}\n<END UNSAFE CONTENT CATEGORIES>\n\n"
        f"<BEGIN CONVERSATION>\n\nUser: {transcript}\n\n<END CONVERSATION>\n\n"
        "Provide your safety assessment for ONLY THE LAST User message in the above conversation:\n"
        " - First line must read 'safe' or 'unsafe'.\n"
        " - If unsafe, a second line must include a comma-separated list of violated categories."
        "<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n"
    )
