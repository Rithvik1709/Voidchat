#!/bin/sh
# Push the guard to a Hugging Face Space.
#   HF_TOKEN=hf_xxx SPACE=your-name/nullchat-guard ./deploy.sh
# The token needs "write" access. Create it at https://huggingface.co/settings/tokens
set -e
: "${HF_TOKEN:?Set HF_TOKEN to a Hugging Face write token}"
: "${SPACE:?Set SPACE to your-name/space-name}"

here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

user="${SPACE%%/*}"
git clone --quiet "https://${user}:${HF_TOKEN}@huggingface.co/spaces/${SPACE}" "$work/space"
cp "$here/app.py" "$here/guard.py" "$here/requirements.txt" "$here/README.md" "$work/space/"

cd "$work/space"
git add -A
if git diff --cached --quiet; then
  echo "Space is already up to date."
  exit 0
fi
git -c user.name="nullchat-deploy" -c user.email="deploy@nullchat.tech" commit --quiet -m "Deploy Nullchat guard"
git push --quiet
echo "Pushed. Watch the build at https://huggingface.co/spaces/${SPACE}"
