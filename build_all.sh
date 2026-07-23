#!/bin/bash
set -e

source ~/.nvm/nvm.sh 2>/dev/null || true
nvm use 20 2>/dev/null || true

echo "=== 1. BUILD FRONTEND ==="
cd /home/astrophile/projects/absensi-fix
npm run build

echo "=== 2. BUILD BACKEND ==="
cd /home/astrophile/projects/absensi-fix/backend
npm run build
