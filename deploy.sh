#!/bin/bash
# Script untuk Build dan Deploy Otomatis ke folder Kompilasi Windows E:

# Hentikan script jika ada error
set -e

echo "=== 1. BUILD FRONTEND ==="
npm run build

echo "=== 2. BUILD BACKEND ==="
cd backend
npm run build
cd ..

echo "=== 3. DEPLOY KE E: DRIVE (SETUP NEBULA SMART PRESENSE) ==="
DEST_DIR="/mnt/e/SIMAS-NABASTALA/Setup Nebula Smart Presense"

if [ -d "$DEST_DIR" ]; then
    echo "Folder tujuan ditemukan di: $DEST_DIR"
    
    # Hapus dan salin dist frontend
    echo "Menyalin file Frontend (dist)..."
    rm -rf "$DEST_DIR/dist"
    cp -r dist "$DEST_DIR"
    
    # Hapus dan salin build backend (obfuscated bundle)
    echo "Menyalin file Backend (build)..."
    rm -rf "$DEST_DIR/backend/build"
    mkdir -p "$DEST_DIR/backend/build"
    cp backend/build/index.js "$DEST_DIR/backend/build/index.js"
    
    # Salin package.json backend
    cp backend/package.json "$DEST_DIR/backend/package.json"
    
    echo "=== PROSES DEPLOY BERHASIL ==="
    echo "Silakan jalankan Inno Setup Compiler pada Windows untuk mengompilasi installer."
else
    echo "Error: Folder tujuan $DEST_DIR tidak ditemukan!"
    echo "Pastikan Drive E: terpasang dan nama folder sudah benar."
    exit 1
fi
