# Sistem Informasi Logbook & Pendataan PKL - SMKN 3 Kendari

![Google Apps Script](https://img.shields.io/badge/Backend-Google%20Apps%20Script-blue)
![Google Sheets](https://img.shields.io/badge/Database-Google%20Sheets-green)
![Bootstrap 5](https://img.shields.io/badge/Frontend-Bootstrap%205-purple)

Aplikasi berbasis web (*Web App*) Serverless untuk manajemen data siswa Praktik Kerja Lapangan (PKL). Aplikasi ini menangani pendaftaran siswa, manajemen biodata, upload foto, dan pengelolaan data oleh Admin Sekolah serta Admin Jurusan.

## 🌟 Fitur Utama

* **Multi-Role Access:**
    * **Super Admin:** Akses penuh ke semua jurusan & manajemen akun admin.
    * **Admin Jurusan:** Terkunci hanya pada data jurusan masing-masing.
    * **Siswa:** Registrasi mandiri, edit biodata, dan upload foto.
* **Automated Setup:** Script inisialisasi untuk membuat akun admin otomatis.
* **Mobile Responsive:** Tampilan optimal di Smartphone & Desktop.
* **Anti-Sandbox Logic:** Bypass keamanan browser modern (iframe redirect) dengan metode konfirmasi user.
* **Secure Data:** Password hashing (MD5) dan perlindungan data NISN (format teks).
* **Export Excel:** Fitur unduh rekap data siswa per angkatan beserta foto.

---

## 📂 Struktur File

| Nama File di GitHub | Nama di Apps Script | Fungsi Utama |
| :--- | :--- | :--- |
| `Code.js` | `Code.gs` | Router utama API, inisialisasi sistem, & helper HTML. |
| `AuthService.js` | `AuthService.gs` | Login, Validasi Sesi, Registrasi Siswa. |
| `AdminService.js` | `AdminService.gs` | CRUD Admin, Dashboard Statistik, Export Data. |
| `StudentService.js` | `StudentService.gs` | Profil Siswa, Ganti Password, Upload Foto. |
| `Utils.js` | `Utils.gs` | Utility (Hash Password, Format Tanggal, CRUD Sheet). |
| `login.html` | `login.html` | Halaman Login & Registrasi. |
| `admin.html` | `admin.html` | Dashboard Admin (SPA). |
| `dashboard.html` | `dashboard.html` | Dashboard Siswa (SPA). |
| `index.html` | `index.html` | Halaman utama & Routing logic. |

---

## 🚀 Panduan Instalasi (Deployment)

### Langkah 1: Persiapan Database
1.  Buat **Google Spreadsheet** baru di Google Drive.
2.  Beri nama (misal: `DB_PKL_SMKN3_2026`).
3.  **PENTING:** Anda tidak perlu membuat sheet manual. Script inisialisasi akan melakukannya untuk Anda (lihat Langkah 3).

### Langkah 2: Pemasangan Kode
1.  Di Spreadsheet, klik menu **Ekstensi** > **Apps Script**.
2.  Salin semua kode dari repository ini ke dalam editor Apps Script.
    * **Catatan:** File `.js` di GitHub harus diubah namanya menjadi `.gs` di Editor Google.
3.  **Konfigurasi Keamanan:**
    * Buka `AuthService.gs`.
    * Cari variabel `SESSION_SECRET`.
    * Ganti `'GANTI_DENGAN_TEXT_RAHASIA_ANDA'` dengan teks acak yang panjang (misal: `kuncirahasia_sekolah_12345`).

### Langkah 3: Inisialisasi Akun Admin (PENTING)
Di dalam file `Code.gs` (bagian paling bawah), terdapat fungsi `setupSystemAccounts` yang mungkin sedang dijadikan komentar (`//`).

1.  Buka `Code.gs`.
2.  Hapus tanda komentar (`/* ... */`) pada fungsi `setupSystemAccounts` jika ada, agar kodenya aktif.
3.  Pilih fungsi **`setupSystemAccounts`** pada dropdown menu di atas editor.
4.  Klik tombol **Jalankan (Run)**.
5.  Berikan izin (Review Permissions) jika diminta.
6.  **Hasil:** Script akan otomatis membuat sheet `users` dan mengisi akun-akun berikut dengan password default **`123456`**:
    * `admin` (Super Admin)
    * `admin_tjkt`
    * `admin_perhotelan`
    * `admin_boga`
    * `admin_busana`
    * `admin_kecantikan`
7.  **Saran:** Setelah dijalankan, jadikan fungsi tersebut komentar lagi agar tidak dijalankan tidak sengaja.

### Langkah 4: Deploy Web App
1.  Klik tombol **Terapkan (Deploy)** (Warna Biru) -> **Penerapan Baru (New Deployment)**.
2.  Pilih jenis: **Aplikasi Web**.
3.  Konfigurasi:
    * **Execute as:** **Me (Saya)**.
    * **Who has access:** **Anyone (Siapa saja)**.
4.  Klik **Deploy**.
5.  Salin URL Web App yang diberikan.

---

## 📖 Cara Penggunaan

### Login Admin
1.  Buka URL Aplikasi.
2.  Gunakan username default (misal: `admin`) dan password `123456`.
3.  **Wajib:** Segera ganti password melalui menu "Pengaturan Akun".

### Login Siswa
1.  Siswa menekan tombol **"Daftar Akun Sendiri"**.
2.  Mengisi NISN, Nama, Jurusan, dan Password.
3.  Login menggunakan data tersebut.

### Format Sheet Database
Jika Anda perlu mengedit manual, pastikan nama Sheet sesuai dengan kode jurusan di sistem:
* `users`: Database akun login.
* `tjkt`: Teknik Jaringan Komputer.
* `perhotelan`: Akomodasi Perhotelan.
* `tata_boga`: Kuliner.
* `tata_busana`: Busana.
* `tata_kecantikan`: Kecantikan.

---

## ⚠️ Troubleshooting & Catatan Keamanan

1.  **Error "Unsafe attempt to initiate navigation"**:
    * Ini wajar karena kebijakan keamanan browser Chrome/Safari terhadap iframe.
    * **Solusi:** Aplikasi ini menggunakan tombol konfirmasi manual ("Klik Disini untuk Lanjut") saat login/logout. Jangan ubah logika ini.

2.  **Angka 0 di depan NISN hilang**:
    * Sistem sudah otomatis menambahkan tanda kutip (`'`) saat menyimpan data agar terbaca sebagai Teks.
    * Jika input manual di Excel/Sheet, pastikan format kolom adalah **Plain Text**.

3.  **Perubahan Kodingan**:
    * Jika Anda mengubah kode `.gs` atau `.html`, Anda harus melakukan **Deploy Ulang** (Manage Deployments -> Edit -> New Version) agar perubahan tampil di user.

---

## 👨‍💻 Pengembang
Project ini dibuat sebagai dedikasi untuk **SMKN 3 Kendari**.
* **Tech Stack:** Google Apps Script.
* **Lisensi:** Open Source (Untuk kalangan pendidikan).
