/**
 * ============================================================================
 * SISTEM INFORMASI PENDATAAN PKL SMKN 3 KENDARI
 * ============================================================================
 * File       : Code.gs (Entry Point & API Router)
 * Developer  : KP Informatika UHO 2026
 * Deskripsi  : 
 * Ini adalah file utama Google Apps Script. Berfungsi sebagai Web Server
 * yang merender halaman HTML dan bertindak sebagai REST API (Router) 
 * untuk menangani permintaan dari frontend (Siswa & Admin).
 * ============================================================================
 */


/**
 * FUNGSI HTTP GET (Entry Point Pertama Kali)
 * Dieksekusi otomatis ketika user membuka URL Web App.
 * Akan merender file 'index.html' sebagai kerangka utama (Single Page Application).
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Sistem Data PKL - SMKN 3 Kendari')
    // Mengizinkan aplikasi di-embed (misal di web sekolah)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    // Agar tampilan rapi di perangkat mobile (HP)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * FUNGSI INCLUDE HTML
 * Memungkinkan kita memanggil file HTML lain (seperti CSS, JS, atau halaman)
 * ke dalam file HTML utama. Membantu menjaga kode tetap terpisah dan rapi.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


/**
 * ============================================================================
 * CENTRAL API ROUTER
 * ============================================================================
 * Semua komunikasi dari Frontend (HTML/JS) ke Backend (Google Sheet) 
 * harus melewati fungsi 'api' ini. Fungsi ini menangani keamanan dan rute data.
 * * @param {string} action - Nama aksi/perintah (misal: 'login', 'getAdminData')
 * @param {object} data - Data/Payload yang dikirim dari frontend
 */
function api(action, data) {
  data = data || {};

  // ---------------------------------------------------------------
  // 1. PUBLIC ACCESS (Bebas Akses Tanpa Login)
  // ---------------------------------------------------------------
  // Menangani permintaan login dan registrasi siswa baru.
  if (action === 'login') {
    return AuthService.login(data.nisn, data.password); 
  }
  if (action === 'register') {
    return AuthService.register(data);
  }

  // ---------------------------------------------------------------
  // 2. AUTHENTICATED CHECK (Verifikasi Keamanan Sesi)
  // ---------------------------------------------------------------
  // Semua request selain login/register wajib menyertakan 'sessionToken'.
  const sessionToken = data.sessionToken;
  const authenticatedUser = AuthService.validateSessionToken(sessionToken);

  // Jika token tidak valid / sudah dihapus admin / kadaluarsa
  if (!authenticatedUser) {
    return { success: false, error: 'Sesi habis. Silakan login kembali.', sessionExpired: true };
  }

  const user = authenticatedUser; // Data user yang sedang login

  // --- LOGIKA GLOBAL: PEMBATASAN AKSES ADMIN JURUSAN ---
  // Jika yang login adalah ADMIN, tapi BUKAN Super Admin (kode: '-'),
  // maka paksa paksa (override) payload jurusannya. 
  // Ini mencegah Admin TJKT "mengintip" atau mengedit data anak Boga.
  if (user.role === 'ADMIN' && user.jurusan !== '-') {
      if (data.jurusan) data.jurusan = user.jurusan;
  }
  // ------------------------------------------------------


  // ---------------------------------------------------------------
  // 3. ROUTING BERDASARKAN ACTION (SWITCH CASE)
  // ---------------------------------------------------------------
  switch (action) {

    // ---------------- COMMON (Siswa & Admin) ----------------
    case 'getDashboardData':
      return getDashboardData(user); // Ambil data ringkasan awal saat sukses login


    // ---------------- RUTE KHUSUS SISWA --------------------
    case 'getStudentProfile':
      return StudentService.getProfile(user); 
      
    case 'saveStudentProfile':
      return StudentService.saveProfile(user, data.formData);

    case 'uploadFoto':
      return StudentService.uploadFoto(data, user);
      
    case 'changePassword': 
      return StudentService.changePassword(user, data.newPassword);


    // ---------------- RUTE KHUSUS ADMIN --------------------
    
    // Update Profil Admin Sendiri (Ubah Username/Pass)
    case 'adminUpdateCredentials':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       return processAdminCredentialUpdate(user, data.newUsername, data.newPassword);

    // Ambil Data Detail 1 Siswa (Untuk diedit di modal)
    case 'adminGetStudentDetail':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       // Validasi tambahan: Admin jurusan tidak boleh buka modal detail jurusan lain
       if (user.jurusan !== '-' && data.jurusan !== user.jurusan) {
          return { success: false, error: 'Akses ilegal ke jurusan lain.' };
       }
       return AdminService.getStudentDetail(data.nisn, data.jurusan);

    // Simpan Perubahan Data Siswa (Via Admin)
    case 'adminSaveStudentDetail':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       if (user.jurusan !== '-') data.jurusan = user.jurusan; // Paksa keamanan jurusan
       return AdminService.saveStudentDetail(data);

    // Data untuk Chart/Grafik
    case 'getAdminStats':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       return AdminService.getStats(data.year);

    // Ambil daftar tahun angkatan untuk filter
    case 'getDashboardYears':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       return AdminService.getDashboardYears();

    // Data Tabel Siswa
    case 'getAdminData':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       return AdminService.getDataByJurusan(data.jurusan, data.tahun);

    // Buat Akun Siswa Baru (Bypass Registrasi Mandiri)
    case 'adminCreateUser':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       if (user.jurusan !== '-') {
          data.jurusan = user.jurusan; // Admin biasa otomatis
       } else {
          // Super admin harus pilih jurusan di form
          if (!data.jurusan) return { success: false, error: 'Jurusan harus dipilih.' };
       }
       return AdminService.createUser(data);
    
    // Ambil Daftar Semua User Login
    case 'getAdminUsers':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       // Kirim parameter jurusan admin agar list user terfilter otomatis
       return AdminService.getAllUsers(user.jurusan);

    // Hapus Siswa Total (Dari list user & list jurusan)
    case 'adminDeleteUser':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       return AdminService.deleteStudent(data.nisn, data.jurusan);
       
    // Kembalikan Password ke 123456
    case 'adminResetPassword':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       return AdminService.resetPassword(data.nisn);

    // Pindah Jurusan Siswa (Hanya untuk Super Admin)
    case 'adminChangeJurusan':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       if (user.jurusan !== '-') return { success: false, error: 'Hanya Super Admin yang boleh memindahkan jurusan.' };
       return AdminService.changeJurusan(data.nisn, data.oldJurusan, data.newJurusan);

    // Export Data ke Google Sheet Baru (Beserta Foto)
    case 'adminExportSheet':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       return AdminService.exportJurusanToGoogleSheet(data.jurusan, data.tahun);
    
    // Dropdown Tahun
    case 'getAvailableYears':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       return AdminService.getAvailableYears(data.jurusan);

    // Rute Tidak Ditemukan
    default:
      return { success: false, error: 'Aksi API tidak dikenal: ' + action };
  }
}


/**
 * ============================================================================
 * HELPER FUNCTIONS (Fungsi Bantuan Internal)
 * ============================================================================
 */

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  // Jika sheet terhapus/belum ada, otomatis buatkan baru
  if (!sheet) sheet = ss.insertSheet(sheetName);
  return sheet;
}

// Mendapatkan URL Web App ini sendiri (Digunakan untuk force-refresh)
function getAppUrl() {
  return ScriptApp.getService().getUrl();
}

/**
 * Mengambil data awal saat dashboard pertama kali dimuat (Siswa & Admin).
 * Bertugas mengecek apakah password user masih default (123456)
 * agar frontend bisa memberikan peringatan ganti password.
 */
function getDashboardData(user) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('users');
    const data = sheet.getDataRange().getValues();
    const defaultHash = Utils.hashPassword('123456');
    let isDefault = false;

    // Cek password hash
    for(let i=1; i<data.length; i++) {
       if(String(data[i][0]) == String(user.nisn)) {
          if(data[i][1] == defaultHash) {
             isDefault = true;
          }
          break;
       }
    }

    return {
      success: true,
      data: {
        user: {
          nisn: user.nisn,
          nama: user.nama || user.nama_lengkap,
          role: user.role,
          jurusan: user.jurusan,
          tahun_pkl: user.tahun_pkl || '',
          isDefaultPassword: isDefault
        },
        isAdmin: (user.role === 'ADMIN')
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Mengelola pembaruan kredensial (Username & Password) untuk Admin sendiri.
 * Menggunakan LockService untuk mencegah konflik jika 2 admin update data
 * di detik yang sama.
 */
function processAdminCredentialUpdate(user, newUsername, newPassword) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = getSheet('users');
    const data = sheet.getDataRange().getValues();
    
    // Cek Duplikasi Username Baru (jika username diganti)
    if (newUsername !== user.nisn) {
      const exists = data.some((row, i) => i > 0 && String(row[0]) === String(newUsername));
      if (exists) {
        return { success: false, error: 'Username/ID "' + newUsername + '" sudah dipakai orang lain.' };
      }
    }

    let userFound = false;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(user.nisn)) {
        
        // Update Username 
        if (newUsername && newUsername !== '') {
          sheet.getRange(i + 1, 1).setValue(newUsername);
        }

        // Update Password 
        if (newPassword && newPassword !== '') {
          const newHash = Utils.hashPassword(newPassword);
          sheet.getRange(i + 1, 2).setValue(newHash);
        }

        userFound = true;
        break;
      }
    }

    if (!userFound) return { success: false, error: 'Data admin tidak ditemukan di database.' };

    return { success: true, message: 'Profil admin berhasil diperbarui. Silakan login ulang dengan data baru.' };

  } catch (e) {
    return { success: false, error: 'Gagal update admin: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}


/**
 * ============================================================================
 * ONE-TIME SETUP & MAINTENANCE SCRIPTS
 * ============================================================================
 * Kumpulan fungsi di bawah ini dibiarkan sebagai komentar.
 * Hanya dijalankan SECARA MANUAL dari dalam editor Apps Script oleh Developer
 * saat pertama kali setup server, atau saat perbaikan data massal.
 * ----------------------------------------------------------------------------
 */

/**
 * --- SETUP AWAL: GENERATE SEMUA AKUN ADMIN ---
 * Cara Pakai:
 * 1. Buka file ini di Editor Apps Script.
 * 2. Hilangkan tanda komentar (//) pada seluruh fungsi setupSystemAccounts.
 * 3. Pilih fungsi 'setupSystemAccounts' di toolbar menu atas.
 * 4. Klik 'Run' (Jalankan).
 * 5. Jadikan komentar kembali setelah selesai.
 */

// function setupSystemAccounts() {
//   const lock = LockService.getScriptLock();
//   try {
//     lock.waitLock(10000); 
    
//     const ss = SpreadsheetApp.getActiveSpreadsheet();
//     let sheet = ss.getSheetByName('users');

//     // 1. Buat Sheet 'users' jika belum ada
//     if (!sheet) {
//       sheet = ss.insertSheet('users');
//       sheet.appendRow(['NISN', 'Password', 'Role', 'Jurusan', 'Nama', 'Token']);
//       sheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#f3f3f3');
//       sheet.getRange("A:A").setNumberFormat("@"); // Format text untuk NISN
//       console.log("✅ Sheet 'users' berhasil dibuat.");
//     }

//     // 2. Daftar Akun Default (Pass Default: 123456)
//     const accountsToCreate = [
//       { user: 'admin', name: 'Super Admin', role: 'ADMIN', jur: '-' },
//       { user: 'admin_tjkt', name: 'Admin TJKT', role: 'ADMIN', jur: 'tjkt' },
//       { user: 'admin_perhotelan', name: 'Admin Perhotelan', role: 'ADMIN', jur: 'perhotelan' },
//       { user: 'admin_boga', name: 'Admin Tata Boga', role: 'ADMIN', jur: 'tata_boga' },
//       { user: 'admin_busana', name: 'Admin Tata Busana', role: 'ADMIN', jur: 'tata_busana' },
//       { user: 'admin_kecantikan', name: 'Admin Kecantikan', role: 'ADMIN', jur: 'tata_kecantikan' }
//     ];

//     const currentData = sheet.getDataRange().getValues();
//     const existingUsers = currentData.map(row => String(row[0])); 
    
//     if (typeof Utils === 'undefined' || !Utils.hashPassword) {
//       throw new Error("Library Utils.js tidak ditemukan!");
//     }

//     const defaultPass = '123456';
//     const passHash = Utils.hashPassword(defaultPass);
//     let createdCount = 0;

//     accountsToCreate.forEach(acc => {
//       if (!existingUsers.includes(acc.user)) {
//         sheet.appendRow(["'" + acc.user, passHash, acc.role, acc.jur, acc.name, '']);
//         console.log(`➕ Dibuat: ${acc.name} (${acc.user})`);
//         createdCount++;
//       } else {
//         console.log(`⏭️ Skip: ${acc.user} (Sudah ada)`);
//       }
//     });

//     console.log('-------------------------------------------');
//     if (createdCount > 0) console.log(`✅ SELESAI: ${createdCount} akun admin baru dibuat.`);
//     else console.log('ℹ️ INFO: Semua akun admin sudah ada.');
//     console.log('-------------------------------------------');

//   } catch (e) { console.error('❌ ERROR: ' + e.message); } 
//   finally { lock.releaseLock(); }
// }


/**
 * --- MAINTENANCE: RAPIKAN FORMAT DATA LAMA MASSAL ---
 * Fungsi ini memperbaiki data lama yang diinput sebelum sistem Auto-Format ditambahkan.
 * Cara Kerja: Mengubah Nama menjadi 'Title Case', dan Alamat menjadi 'UPPERCASE'.
 */

// function fixAllDataFormats() {
//   const jurusans = ['tjkt', 'perhotelan', 'tata_boga', 'tata_busana', 'tata_kecantikan'];
//   const ss = SpreadsheetApp.getActiveSpreadsheet();
//   let totalFixed = 0;

//   console.log("🚀 Memulai proses perbaikan format data...");

//   jurusans.forEach(jur => {
//     const sheet = ss.getSheetByName(jur);
//     if (sheet) {
//       const lastRow = sheet.getLastRow();
      
//       if (lastRow > 1) {
//         // Ambil kolom B (Nama) & C (Alamat)
//         const range = sheet.getRange(2, 2, lastRow - 1, 2);
//         const data = range.getValues();
        
//         let updatedData = data.map(row => {
//           let nama = String(row[0]);
//           let alamat = String(row[1]);

//           // Format Nama (Title Case)
//           let fixedNama = nama.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
//           // Format Alamat (UPPERCASE)
//           let fixedAlamat = alamat.toUpperCase();

//           return [fixedNama, fixedAlamat];
//         });

//         range.setValues(updatedData);
//         console.log(`✅ Jurusan ${jur.toUpperCase()}: ${updatedData.length} siswa diperbarui.`);
//         totalFixed += updatedData.length;
//       } else {
//         console.log(`ℹ️ Jurusan ${jur.toUpperCase()}: Data kosong.`);
//       }
//     } else {
//       console.log(`⚠️ Jurusan ${jur.toUpperCase()}: Sheet tidak ditemukan.`);
//     }
//   });

//   console.log('-------------------------------------------');
//   console.log(`🎉 SELESAI! Total ${totalFixed} data siswa telah dirapikan.`);
// }
