<div align="center">
  <img src="https://wsrv.nl/?url=uho.ac.id/wp-content/uploads/2022/11/logo-7.png&bg=white&pad=20" alt="Logo UHO" width="500"/>
  
  <h1>🎓 Sistem Informasi Pendataan PKL <br> SMKN 3 Kendari</h1>
  <p><i>Aplikasi Web Single Page Application (SPA) berbasis Google Apps Script & Google Sheets</i></p>
</div>

---

Sistem Informasi ini dirancang khusus untuk mendigitalkan dan mempermudah proses pendataan biodata serta pas foto siswa yang akan melaksanakan Praktik Kerja Lapangan (PKL) di SMKN 3 Kendari. Menggabungkan kemudahan Google Sheets sebagai *database* dengan antarmuka web modern yang responsif.

## 👨‍💻 Tim Pengembang (Kerja Praktik)
Proyek ini dibangun dengan penuh dedikasi oleh Tim Kerja Praktik (KP) Mahasiswa **Teknik Informatika, Universitas Halu Oleo (UHO) - 2026**:

| Nama | NIM / Stambuk | Peran / Kontribusi |
| :--- | :---: | :--- |
| **Adi Setiawan** | `E1E123023` | *Fullstack Development & Backend Logic* |
| **Indah Lestari** | `E1E123004` | *UI/UX Design & Frontend Integration* |
| **Nirmala** | `E1E123012` | *System Testing & Database Management* |

❤️

---

## ✨ Fitur Utama

### 👨‍🎓 Fitur Siswa
* **Registrasi Mandiri:** Siswa dapat mendaftarkan akunnya sendiri menggunakan NISN.
* **Auto-Formatting:** Nama otomatis dikapitalisasi pada awal kata (*Title Case*), dan Alamat otomatis menjadi huruf besar (*UPPERCASE*).
* **Upload & Crop Foto:** Terintegrasi dengan `Cropper.js` untuk memastikan foto yang diunggah memiliki rasio standar pas foto **3:4**.
* **Keamanan Akun:** Peringatan wajib ganti password jika masih menggunakan password bawaan (default).
* **Responsive UI:** Tampilan ramah seluler (Mobile-friendly) sangat nyaman diakses via HP.

### 👨‍💼 Fitur Admin (Super Admin & Admin Jurusan)
* **Dashboard Interaktif:** Menampilkan grafik statistik (Bar & Pie Chart) jumlah siswa per jurusan menggunakan `Chart.js`.
* **Multi-Role Access:** * *Super Admin:* Memiliki akses penuh ke semua data jurusan.
  * *Admin Jurusan:* Sistem otomatis mengunci akses agar admin hanya bisa melihat data siswanya sendiri.
* **Manajemen User:** Reset password siswa, tambah akun, hapus akun, dan pindah jurusan siswa (khusus Super Admin).
* **Export Laporan Premium:** Export data siswa ke file Google Spreadsheet baru, lengkap dengan **Foto Fisik (Thumbnail)** yang tertata rapi di dalam tabel laporan, siap cetak!

---

## 🛠️ Teknologi yang Digunakan
* **Backend & Server:** Google Apps Script (GAS)
* **Database:** Google Sheets
* **Storage:** Google Drive API
* **Frontend:** HTML5, CSS3, Vanilla JavaScript
* **UI Framework:** Bootstrap 5.1.3 & Bootstrap Icons
* **Library Tambahan:** * [SweetAlert2](https://sweetalert2.github.io/) *(Pop-up Alerts)*
  * [Cropper.js](https://fengyuanchen.github.io/cropperjs/) *(Image Cropping)*
  * [Chart.js](https://www.chartjs.org/) *(Data Visualization)*
  * [Animate.css](https://animate.style/) *(UI Animations)*

---

## 📂 Struktur File Repository

| Nama File | Deskripsi |
| :--- | :--- |
| `Code.gs` | *Entry point* server, HTTP GET Loader, dan Router API utama. |
| `AuthService.gs` | Menangani Logika Login, Registrasi, dan Validasi Session Token. |
| `AdminService.gs` | Menangani fungsi Dashboard, Manajemen User, CRUD Admin, dan Export Data. |
| `StudentService.gs` | Menangani fungsi Profil Siswa, Simpan Biodata, Upload Foto, dan Ganti Password. |
| `Utils.gs` | Helper kriptografi (Hashing MD5), Generator ID, dan operasi inti ke Spreadsheet. |
| `index.html` | Kerangka awal SPA & Script penentu *Routing* halaman (Loading Screen). |
| `login.html` | Antarmuka halaman Login dan Form Pendaftaran Siswa. |
| `dashboard.html` | Antarmuka panel Siswa (Form pengisian biodata & foto). |
| `admin.html` | Antarmuka panel Admin (Tabel data, manajemen user, grafik statistik). |

---

## 🗄️ Persiapan Database (Google Sheets)

Buatlah sebuah file Google Sheets baru di Google Drive Anda, lalu buat *Sheet (Tab)* dengan nama-nama persis seperti berikut (Huruf kecil semua):

1. **`users`**
   * Baris 1 (Header): `NISN` | `Password` | `Role` | `Jurusan` | `Nama` | `Token`
2. **`tjkt`**
3. **`perhotelan`**
4. **`tata_boga`**
5. **`tata_busana`**
6. **`tata_kecantikan`**
   * *Header untuk Sheet Jurusan (Poin 2-6):* `NISN` | `Nama` | `Alamat` | `HP_Siswa` | `HP_Ortu` | `FotoID` | `Preview` | `TahunMasuk`

---

## 🚀 Panduan Instalasi & Deployment

1. **Siapkan Spreadsheet:** Ikuti panduan pembuatan database di atas.
2. **Buka Editor Script:** Pada Google Sheets, klik menu **Ekstensi > Apps Script**.
3. **Salin Kode:** Buat file `.gs` (Script) dan `.html` sesuai dengan tabel struktur file di atas, lalu *copy-paste* semua kodenya.
4. **Keamanan (Sangat Penting):** Buka file `AuthService.gs` dan ubah variabel `SESSION_SECRET` dengan kode/teks acak milik Anda sendiri.
5. **Setup Akun Admin Awal:** * Buka file `Code.gs`.
   * Hapus tanda komentar (`//`) pada blok fungsi `setupSystemAccounts()`.
   * Pilih nama fungsi tersebut di *dropdown* menu atas, lalu klik tombol **Jalankan (Run)**.
   * *Pastikan untuk mengembalikan tanda komentar (`//`) setelah sukses dijalankan.*
6. **Deploy Aplikasi:**
   * Klik tombol biru **Terapkan (Deploy) > Deployment Baru**.
   * Pilih jenis: **Aplikasi Web (Web App)**.
   * Setel Akses: **Siapa saja (Anyone)**.
   * Klik **Terapkan**.
   * Izinkan (Otorisasi) akses akun Google yang diminta.
7. **Selesai:** Salin URL Web App yang diberikan. Aplikasi siap digunakan!

---

## ⚠️ Catatan Maintenance
Jika Anda melakukan perubahan pada kode (HTML/JS/GS) di kemudian hari, Anda **WAJIB** melakukan Deploy Ulang agar perubahannya muncul:
1. Klik **Terapkan > Kelola Penerapan**.
2. Klik ikon pensil (Edit) pada versi yang sedang aktif.
3. Pada dropdown Versi, pilih **Versi Baru**.
4. Klik **Terapkan**. (Langkah ini menjaga agar URL Link aplikasi sekolah tidak berubah).

---
<p align="center">
  <b>Dibuat untuk memenuhi tugas Kerja Praktik (KP) Tahun 2026.</b><br>
  <i>Fakultas Teknik - Universitas Halu Oleo</i>
</p>
