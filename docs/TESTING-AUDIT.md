# Panduan Uji Coba Nebula Presence (Branch Audit)

> Jalankan hanya pada salinan pengujian. Jangan gunakan database sekolah yang aktif untuk percobaan pertama. Jangan menyalin file `.env` atau token rahasia ke GitHub.

## 1. Ambil branch perbaikan

Di komputer Windows yang sudah memasang Git dan Node.js:

```powershell
git clone https://github.com/AkaraNabastala/nebula-presence.git
cd nebula-presence
git fetch origin
git checkout audit-and-fixes-2026-10
```

Jika repositori sudah ada di komputer:
```powershell
git fetch origin
git checkout audit-and-fixes-2026-10
git pull
```

## 2. Siapkan salinan data

1. Tutup Nebula Presence.
2. Buat salinan folder data aplikasi `%USERPROFILE%\.nebula-presence-app` ke lokasi cadangan lain.
3. Catat jumlah siswa, guru, jadwal, dan beberapa catatan absensi yang sudah ada.
4. Jangan menghapus atau mengganti database asli. Uji coba awal harus memakai komputer uji atau profil Windows uji yang terpisah.

## 3. Pasang dependensi dan jalankan tes otomatis

```powershell
cd backend
npm install
npm test
```

Catat seluruh hasil tes, termasuk nama tes yang gagal. Tes yang berhasil belum membuktikan seluruh alur aplikasi aman; uji manual di bawah tetap diperlukan.

## 4. Uji sinkronisasi setelah perubahan

Gunakan portal uji, bukan portal produksi, dan gunakan akun/token uji.

1. Aktifkan sinkronisasi dengan URL portal uji dan token uji.
2. Catat jumlah antrean absensi yang belum tersinkron.
3. Jalankan sinkronisasi saat internet tersedia. Periksa apakah data sampai ke portal dan antrean berkurang sesuai respons server.
4. Matikan koneksi internet, lalu jalankan sinkronisasi. Aplikasi tidak boleh menghapus data lokal.
5. Pulihkan internet dan jalankan sinkronisasi kembali.
6. Jika endpoint penarikan pembaruan portal tidak tersedia/gagal, status sinkronisasi seharusnya menunjukkan kondisi sebagian/peringatan, bukan sukses penuh. Cursor penarikan tidak boleh maju ketika pull gagal.
7. Uji izin yang disetujui hanya dengan data uji. Periksa catatan hadir/pulang agar tidak tertimpa.

## 5. Uji alur absensi inti

- Satu siswa melakukan absensi masuk sekali pada tanggal sekolah yang sama.
- Coba absensi masuk kedua kali; aplikasi harus mengikuti aturan duplikasi yang berlaku.
- Catat absensi pulang secara terpisah.
- Coba akun guru mengakses kelas binaan dan kelas yang bukan binaannya.
- Koreksi satu catatan dengan akun yang berwenang, lalu periksa apakah riwayat koreksi tersedia.
- Tutup dan buka kembali aplikasi; pastikan data uji tetap ada.
- Uji backup dan pemulihan hanya menggunakan salinan database.

## 6. Catat hasil

Untuk setiap kasus, tulis: tanggal/jam, langkah, hasil yang diharapkan, hasil aktual, dan tangkapan layar/log yang tidak mengandung token, PIN, kata sandi, atau data pribadi siswa.

**Penting:** Branch audit ini belum dinyatakan lulus pengujian runtime/integrasi. Jangan gabungkan ke `main` atau gunakan untuk absensi sekolah aktif sebelum hasil pengujian ditinjau.
