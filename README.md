# Nebula Smart Presence

**Nebula Smart Presence** (sebelumnya SI-MAS) adalah sistem absensi dan manajemen identitas cerdas berbasis perangkat keras keras (RFID) dan lisensi anti-pembajakan. Sistem ini dirancang untuk penggunaan di Instansi Perusahaan maupun Sekolah dengan tingkat keamanan kelas tinggi.

## 🌟 Fitur Unggulan

- **Anti-Resale & Hardware Locked**: Lisensi diikat secara presisi dengan `Machine ID` dari perangkat (*hardware*) klien. Klien tidak bisa mengubah nama instansi/perusahaan, menyalin file lisensi ke komputer lain, atau menjual kembali (*resale*) aplikasi ini.
- **Smart UI/UX**: Antarmuka modern, *compact*, efisien, dengan efek gradien dan animasi premium.
- **Mode Edukasi & Korporat**: Mendukung terminologi dinamis (Karyawan vs Siswa) dan jadwal kerja/belajar yang fleksibel (Shift, Libur, dll).
- **Auto Alfa & Cron Jobs**: Sistem secara otomatis mengkalkulasi ketidakhadiran (ALFA) pada pukul 23:55 setiap harinya (dengan mengecualikan hari libur operasional instansi).
- **Support & Monetization Funnel**: 
  - Dilengkapi fitur "Lupa Kata Sandi" yang dikunci ke perangkat keras.
  - Untuk mereset kata sandi, klien diwajibkan menghubungi Teknisi Nebula Tech (pesan WA terintegrasi otomatis dengan `Machine ID`).
  - *Developer* dapat menggunakan `generator_reset.js` untuk membuat kode reset khusus dan menagihkan layanan dukungan (monetisasi sekunder).

## 🛠 Teknologi

- **Frontend**: React (Vite), TailwindCSS, Lucide-React.
- **Backend**: Node.js, Express.js, PostgreSQL (pg), node-cron.
- **Keamanan**: `node-machine-id` (Hardware ID Fingerprinting), `bcrypt` & `crypto` (Hashing & Salt: `NebulaTech_MasterReset_2026`).

## 🔑 Mode Pengembang (Developer)

### 1. Menghasilkan Lisensi Klien (Aktivasi)
Gunakan API/Skrip *License Generator* terpisah untuk mencetak file `license.key` yang terenkripsi. Pada saat men-generate lisensi, isi variabel `Owner` dengan nama sekolah/perusahaan klien. Nama ini akan menjadi judul utama aplikasi secara permanen!

### 2. Mengatasi Klien Lupa Password (Mesin Cuan)
Saat klien mengeklik "Lupa Kata Sandi", klien akan mengirimkan `Machine ID` (contoh: `8c9e...`). 
Jalankan perintah ini di Terminal Anda:
```bash
node generator_reset.js <MACHINE_ID_DARI_KLIEN>
```
Sistem akan memberikan **6 Digit Kode Reset**.
Berikan kode tersebut kepada klien. Jika dimasukkan, kata sandi Super Admin akan kembali menjadi `admin`.

## 📜 Hak Cipta & Kepemilikan
Dikembangkan oleh **Nebula Tech Digital Solution**. Seluruh logika lisensi dan hak milik intelektual sepenuhnya dilindungi oleh hukum.
