# AUDIT v1.3 — Portal Absensi

- Tanggal audit: 28 Oktober 2026
- Versi dokumen: v1.3
- Proyek: Portal Absensi
- Fokus: autentikasi, biodata guru dan siswa, sinkronisasi,
  build frontend, runtime server, dan integritas data.

> Dokumen ini mencatat hasil pekerjaan yang dilaporkan.
> Status yang belum dibuktikan melalui pengujian ulang ditandai
> sebagai perlu verifikasi.

## 1. Ringkasan

Portal Absensi menjalani pemeriksaan terhadap endpoint biodata,
hak akses berdasarkan peran pengguna, database lokal, frontend,
dan runtime Node.js.

Lokasi repositori perlu dipastikan karena pemeriksaan sebelumnya
tidak menemukan direktori ~/projects/portal-absensi pada salah
satu lingkungan yang digunakan.

## 2. Perbaikan Biodata Guru

Masalah yang dilaporkan:
- Permintaan endpoint biodata siswa menghasilkan HTTP 403
  ketika dipanggil dari alur akun guru.

Perbaikan yang dilaporkan:
- Frontend diarahkan agar pengguna dengan peran TEACHER
  menggunakan endpoint /api/teacher/personal-details/:teacherId.

Verifikasi yang diperlukan:
- Akun guru dapat membuka biodatanya sendiri.
- Akun siswa tidak dapat membaca biodata guru tanpa izin.
- Backend tetap memvalidasi peran dan identitas pengguna.
- Frontend yang aktif menggunakan hasil build terbaru.

Status: Perbaikan dilaporkan dilakukan; hasil pengujian otorisasi
perlu dikonfirmasi melalui log dan pengujian terbaru.

## 3. Build Frontend dan Runtime

Perubahan yang dilaporkan:
- Build frontend dijalankan menggunakan Node.js 24 melalui NVM.
- Build Portal Absensi dilaporkan berhasil dalam sekitar 1,28 detik.
- Skrip start_server.sh dibuat untuk membantu menjalankan server.

Verifikasi yang diperlukan:
- Pastikan Node.js dan dependensi backend sesuai.
- Pastikan server berjalan pada port yang dikonfigurasi.
- Pastikan endpoint kesehatan atau halaman utama merespons.
- Simpan hasil build dan smoke test terbaru.

Status: Build dan smoke test dilaporkan dijalankan; perlu konfirmasi
hasil akhir yang dapat direproduksi.

## 4. Database dan Data Pengguna

Pemeriksaan yang dilaporkan:
- Pemeriksaan file database Portal.
- Pemeriksaan skema dan isi tabel anggota serta guru.
- Pemeriksaan endpoint biodata dan izin akses.

Verifikasi yang diperlukan:
- Pastikan database yang diperiksa adalah database yang digunakan
  server aktif.
- Pastikan data guru dan siswa tetap utuh.
- Jangan mengubah atau menghapus data berdasarkan hasil pemeriksaan
  yang gagal tanpa memahami penyebabnya.
- Pastikan backup tersedia sebelum perubahan database.

Status: Pemeriksaan telah dilaporkan; integritas data perlu
dikonfirmasi dengan database aktif.

## 5. Sinkronisasi dengan Nebula Presence

Verifikasi yang diperlukan:
- Pastikan data kelas dan anggota diterima dengan benar.
- Pastikan jadwal pelajaran tampil di Portal.
- Pastikan hubungan guru, kelas, dan mata pelajaran valid.
- Pastikan log presensi tidak terduplikasi setelah sinkronisasi ulang.
- Cocokkan log Portal dengan hasil sinkronisasi Nebula Presence.

Status: Keberhasilan sinkronisasi perlu dibuktikan dari log kedua
aplikasi dan data yang tersimpan.

## 6. Daftar Aktivitas yang Dilaporkan

- Pemeriksaan lokasi repositori Portal Absensi.
- Pemeriksaan isi direktori dan status Git.
- Pemeriksaan endpoint biodata personal.
- Pemeriksaan kode frontend App.jsx.
- Pemeriksaan definisi canAccessDivision.
- Pemeriksaan skema dan isi tabel guru serta anggota.
- Pemeriksaan riwayat commit dan perubahan frontend.
- Build frontend dengan Node.js 24.
- Pembuatan skrip start_server.sh.
- Smoke test server Portal Absensi.

Catatan: Perintah yang gagal atau berhenti tidak dianggap sebagai
pengujian yang berhasil tanpa bukti dari pengujian pengganti.

## 7. Keamanan

- Jangan memasukkan rahasia dari file .env ke dalam laporan.
- Pastikan file .env dan database tidak ikut terunggah ke repositori.
- Rotasi rahasia yang pernah terekspos.
- Pastikan endpoint biodata memeriksa otorisasi di backend.

Status: Memerlukan verifikasi konfigurasi dan pengujian keamanan.

## 8. Kriteria Penutupan Audit

Audit Portal Absensi dapat dinyatakan tuntas setelah:
1. Build frontend terbaru berhasil.
2. Server dapat dijalankan dengan runtime yang sesuai.
3. Akun guru dan siswa memiliki akses sesuai perannya.
4. Endpoint biodata guru dan siswa lolos pengujian otorisasi.
5. Data hasil sinkronisasi sesuai dengan Nebula Presence.
6. Database dan backup telah diperiksa.
7. Seluruh pengujian gagal atau terhenti telah dianalisis.
8. Status Git telah ditinjau dan tidak ada rahasia yang terunggah.

---

Akhir dokumen — AUDIT v1.3 Portal Absensi
