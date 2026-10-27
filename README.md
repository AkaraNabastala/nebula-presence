# Nebula Smart Presence

**Nebula Smart Presence** (sebelumnya SI-MAS) adalah sistem absensi dan manajemen identitas cerdas berbasis perangkat keras keras (RFID) dan lisensi anti-pembajakan. Sistem ini dirancang untuk penggunaan di Instansi Perusahaan maupun Sekolah dengan tingkat keamanan kelas tinggi.

## 🌟 Fitur Unggulan

- **Absensi RFID dan manajemen identitas** untuk sekolah dan organisasi.
- **Mode Edukasi & Korporat** dengan dukungan terminologi dan jadwal yang fleksibel.
- **Auto Alfa & Cron Jobs** untuk kalkulasi ketidakhadiran terjadwal.
- **Lisensi berbasis perangkat** dengan validasi aktivasi.

> **Catatan keamanan:** fitur pemulihan kata sandi melalui kode lama sementara dinonaktifkan karena protokol sebelumnya menggunakan kata sandi tetap dan secret yang tertanam dalam aplikasi. Jangan mengembalikan alur tersebut sebelum mekanisme pemulihan satu kali, kedaluwarsa, dan ditandatangani secara aman tersedia.

## 🛠 Teknologi

- **Frontend**: React (Vite), TailwindCSS, Lucide-React.
- **Backend**: Node.js, Express.js, PostgreSQL (pg), node-cron.
- **Keamanan**: `node-machine-id` (Hardware ID Fingerprinting), `bcrypt` & `crypto` (Hashing & Salt: `NebulaTech_MasterReset_2026`).

## 🔐 Konfigurasi keamanan

Backend harus memiliki variabel lingkungan `JWT_SECRET` yang kuat dan unik. Aplikasi tidak lagi memakai secret JWT bawaan. Jika variabel ini tidak diatur, login dan endpoint terlindungi akan menolak permintaan sampai konfigurasi diperbaiki.

Buat secret acak di lingkungan server (contoh Linux):

```bash
openssl rand -hex 32
```

Simpan hasilnya di file `backend/.env` sebagai `JWT_SECRET=<hasil-random>`. Jangan commit file `.env` atau membagikan nilainya. Setelah melakukan rotasi secret, token login lama harus dianggap tidak berlaku dan pengguna perlu login kembali.

### Aktivasi lisensi

Gunakan proses penerbitan lisensi yang terpisah. Kunci privat penerbitan lisensi tidak boleh ditanamkan di aplikasi klien. Kode lisensi lama yang berjenis reset kata sandi akan ditolak; kode tersebut tidak akan mengubah kata sandi administrator.

## 📜 Hak Cipta & Kepemilikan
Dikembangkan oleh **Nebula Tech Digital Solution**. Seluruh logika lisensi dan hak milik intelektual sepenuhnya dilindungi oleh hukum.
