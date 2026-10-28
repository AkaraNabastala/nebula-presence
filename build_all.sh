#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # Vite 7 memerlukan Node.js versi yang kompatibel.
    source "$HOME/.nvm/nvm.sh"
    nvm use 24
fi

echo
echo "========== VERSI RUNTIME =========="
node --version
npm --version

echo
echo "========== 1/2 BUILD FRONTEND =========="
npm run build

echo
echo "========== 2/2 BUILD BACKEND =========="
if [ ! -f backend/package.json ]; then
    echo "GAGAL: backend/package.json tidak ditemukan."
    exit 1
fi

npm --prefix backend run build

echo
echo "========== HASIL BUILD =========="
if [ ! -s dist/index.html ]; then
    echo "GAGAL: hasil build frontend dist/index.html tidak ditemukan."
    exit 1
fi

if [ ! -s backend/build/index.js ]; then
    echo "GAGAL: hasil build backend/build/index.js tidak ditemukan."
    exit 1
fi

echo "BERHASIL: artefak build frontend dan backend ditemukan."
echo "Catatan: keberhasilan build belum membuktikan server berjalan atau semua fitur lolos pengujian."
