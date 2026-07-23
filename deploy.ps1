# Script untuk Build dan Deploy dari Windows PowerShell

# 1 & 2. Jalankan build murni di WSL (Linux Environment)
wsl -d Ubuntu -e bash /home/astrophile/projects/absensi-fix/build_all.sh

# 3. Sinkronisasi ke Drive E:
Write-Host "=== 3. SINKRONISASI KE DRIVE E: ===" -ForegroundColor Cyan
$source = "\\wsl.localhost\Ubuntu\home\astrophile\projects\absensi-fix"
$dest = "E:\SIMAS-NABASTALA\Setup Nebula Smart Presense"

if (Test-Path $dest) {
    Write-Host "Menyalin Frontend (dist)..."
    Remove-Item -Path "$dest\dist" -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item -Path "$source\dist" -Destination $dest -Recurse -Force
    
    Write-Host "Menyalin Backend (build)..."
    Remove-Item -Path "$dest\backend\build" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "$dest\backend\cek_device.js" -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path "$dest\backend\build"
    Copy-Item -Path "$source\backend\build\index.js" -Destination "$dest\backend\build\index.js" -Force
    Copy-Item -Path "$source\backend\package.json" -Destination "$dest\backend\package.json" -Force
    
    Write-Host "=== PROSES SINKRONISASI BERHASIL ===" -ForegroundColor Green
    Write-Host "Silakan compile menggunakan Inno Setup Compiler."
} else {
    Write-Warning "Folder tujuan tidak ditemukan: $dest"
}
