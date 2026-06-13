#!/bin/bash
set -e
cd "$(dirname "$0")"
echo ">>> Installing dependencies in $(pwd)"
/usr/local/bin/npm install 2>&1 || /opt/homebrew/bin/npm install 2>&1 || npm install 2>&1
echo ">>> Starting dev server"
PORT=3737 npm run dev
