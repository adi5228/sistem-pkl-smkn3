/**
 * SISTEM DATA SISWA PKL SMKN 3 KENDARI
 * Entry Point - Code.gs (Converted to .js for GitHub)
 * * Description:
 * Main router and entry point for the Google Apps Script Web App.
 * Handles HTTP GET requests and API routing for client-side calls.
 * * Features:
 * - HTML Template Serving
 * - API Routing (Login, Register, Dashboard, Admin CRUD)
 * - Session Management
 * - Role-based Access Control (Super Admin vs Admin Jurusan)
 */

/**
 * Serves the HTML page.
 * @param {Object} e - Event parameter.
 * @returns {HtmlOutput} The rendered HTML page.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Sistem Data PKL - SMKN 3 Kendari')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Helper function to include HTML partials.
 * @param {string} filename - The name of the HTML file to include.
 * @returns {string} The content of the file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Main API Router.
 * Handles all client-side requests via google.script.run.
 * * @param {string} action - The action name (e.g., 'login', 'getDashboardData').
 * @param {Object} data - The payload data sent from the client.
 * @returns {Object} Response object { success: boolean, ...data, error?: string }.
 */
function api(action, data) {
  data = data || {};

  // ---------------------------------------------------------------
  // 1. PUBLIC ACCESS (No Login Required)
  // ---------------------------------------------------------------
  
  if (action === 'login') {
    return AuthService.login(data.nisn, data.password); 
  }
  
  if (action === 'register') {
    return AuthService.register(data);
  }

  // ---------------------------------------------------------------
  // 2. AUTHENTICATED CHECK (Login Required)
  // ---------------------------------------------------------------
  const sessionToken = data.sessionToken;
  const authenticatedUser = AuthService.validateSessionToken(sessionToken);

  if (!authenticatedUser) {
    return { success: false, error: 'Sesi habis. Silakan login kembali.', sessionExpired: true };
  }

  const user = authenticatedUser;

  // --- GLOBAL JURUSAN ADMIN LOGIC ---
  // If the user is a JURUSAN ADMIN (not super admin '-'), 
  // Force all incoming data to match their specific jurusan.
  if (user.role === 'ADMIN' && user.jurusan !== '-') {
      // If jurusan is provided in payload, override it with admin's jurusan
      if (data.jurusan) data.jurusan = user.jurusan;
  }
  // ----------------------------------------

  switch (action) {
    // --- COMMON ROUTES ---
    case 'getDashboardData':
      return getDashboardData(user);

    // --- STUDENT ROUTES ---
    case 'getStudentProfile':
      return StudentService.getProfile(user); 
      
    case 'saveStudentProfile':
      return StudentService.saveProfile(user, data.formData);

    case 'uploadFoto':
      return StudentService.uploadFoto(data, user);
      
    case 'changePassword': 
      // For students (change own password)
      return StudentService.changePassword(user, data.newPassword);

    // --- ADMIN ROUTES ---
    
    // Update Admin Credentials (Self)
    case 'adminUpdateCredentials':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       return processAdminCredentialUpdate(user, data.newUsername, data.newPassword);

    // Get Student Detail (For Editing)
    case 'adminGetStudentDetail':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       // Double check validation for Jurusan Admin
       if (user.jurusan !== '-' && data.jurusan !== user.jurusan) {
          return { success: false, error: 'Akses ilegal ke jurusan lain.' };
       }
       return AdminService.getStudentDetail(data.nisn, data.jurusan);

    // Save Student Detail
    case 'adminSaveStudentDetail':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       // Force jurusan match
       if (user.jurusan !== '-') data.jurusan = user.jurusan;
       
       return AdminService.saveStudentDetail(data);

    // Admin Dashboard Stats
    case 'getAdminStats':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       return AdminService.getStats(data.year);

    case 'getDashboardYears':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       return AdminService.getDashboardYears();

    // Data Table
    case 'getAdminData':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       return AdminService.getDataByJurusan(data.jurusan, data.tahun);

    // Create User (Student)
    case 'adminCreateUser':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       
       // Jurusan Admin automatically fills jurusan parameter
       if (user.jurusan !== '-') {
          data.jurusan = user.jurusan; 
       } else {
          // Super Admin must select jurusan
          if (!data.jurusan) return { success: false, error: 'Jurusan harus dipilih.' };
       }
       
       return AdminService.createUser(data);
    
    // User Management List
    case 'getAdminUsers':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       // Pass user.jurusan to filter data in Service
       return AdminService.getAllUsers(user.jurusan);

    case 'adminDeleteUser':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       return AdminService.deleteStudent(data.nisn, data.jurusan);
       
    case 'adminResetPassword':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       return AdminService.resetPassword(data.nisn);

    case 'adminChangeJurusan':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       if (user.jurusan !== '-') return { success: false, error: 'Hanya Super Admin yang boleh memindahkan jurusan.' };
       return AdminService.changeJurusan(data.nisn, data.oldJurusan, data.newJurusan);

    // Tools / Export
    case 'adminExportSheet':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       return AdminService.exportJurusanToGoogleSheet(data.jurusan, data.tahun);
    
    case 'getAvailableYears':
       if (user.role !== 'ADMIN') return { success: false, error: 'Akses Ditolak' };
       return AdminService.getAvailableYears(data.jurusan);

    default:
      return { success: false, error: 'Aksi API tidak dikenal: ' + action };
  }
}

// --- HELPER FUNCTIONS ---

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  return sheet;
}

function getAppUrl() {
  return ScriptApp.getService().getUrl();
}

function getDashboardData(user) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('users');
    const data = sheet.getDataRange().getValues();
    const defaultHash = Utils.hashPassword('123456');
    let isDefault = false;

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
 * Local Function: Process Admin Credential Update (Self)
 * Handles updating username and password for the currently logged-in admin.
 */
function processAdminCredentialUpdate(user, newUsername, newPassword) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = getSheet('users');
    const data = sheet.getDataRange().getValues();
    
    // Check for duplicate username (if changed)
    if (newUsername !== user.nisn) {
      const exists = data.some((row, i) => i > 0 && String(row[0]) === String(newUsername));
      if (exists) {
        return { success: false, error: 'Username/ID "' + newUsername + '" sudah dipakai orang lain.' };
      }
    }

    let userFound = false;
    for (let i = 1; i < data.length; i++) {
      // Find row by current ID (user.nisn)
      if (String(data[i][0]) === String(user.nisn)) {
        
        // Update Username (Column 1 / Index 0)
        if (newUsername && newUsername !== '') {
          sheet.getRange(i + 1, 1).setValue(newUsername);
        }

        // Update Password (Column 2 / Index 1)
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
 * --- FUNGSI SETUP: GENERATE SEMUA AKUN ADMIN ---
 * Fungsi ini akan membuat:
 * 1. Akun Super Admin (Akses Semua)
 * 2. Akun Admin per Jurusan (TJKT, Perhotelan, Boga, Busana, Kecantikan)
 * * Cara Pakai:
 * 1. Pilih fungsi 'setupSystemAccounts' di toolbar atas.
 * 2. Klik 'Run'.
 * 3. Password default semua akun adalah: 123456
 */
// function setupSystemAccounts() {
//   const lock = LockService.getScriptLock();
//   try {
//     lock.waitLock(10000); // Tunggu antrian kunci max 10 detik
    
//     const ss = SpreadsheetApp.getActiveSpreadsheet();
//     let sheet = ss.getSheetByName('users');

//     // 1. Buat Sheet 'users' jika belum ada
//     if (!sheet) {
//       sheet = ss.insertSheet('users');
//       sheet.appendRow(['NISN', 'Password', 'Role', 'Jurusan', 'Nama', 'Token']);
//       // Format Header
//       sheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#f3f3f3');
//       // Format Kolom NISN jadi Text
//       sheet.getRange("A:A").setNumberFormat("@");
//       console.log("✅ Sheet 'users' berhasil dibuat.");
//     }

//     // 2. Daftar Akun yang akan dibuat
//     // Pastikan kode 'jurusan' SAMA PERSIS dengan value di <select> HTML
//     const accountsToCreate = [
//       { user: 'admin', name: 'Super Admin', role: 'ADMIN', jur: '-' },
//       { user: 'admin_tjkt', name: 'Admin TJKT', role: 'ADMIN', jur: 'tjkt' },
//       { user: 'admin_perhotelan', name: 'Admin Perhotelan', role: 'ADMIN', jur: 'perhotelan' },
//       { user: 'admin_boga', name: 'Admin Tata Boga', role: 'ADMIN', jur: 'tata_boga' },
//       { user: 'admin_busana', name: 'Admin Tata Busana', role: 'ADMIN', jur: 'tata_busana' },
//       { user: 'admin_kecantikan', name: 'Admin Kecantikan', role: 'ADMIN', jur: 'tata_kecantikan' }
//     ];

//     // 3. Persiapan Data
//     const currentData = sheet.getDataRange().getValues();
//     // Ambil list username yang sudah ada (Kolom A / Index 0)
//     const existingUsers = currentData.map(row => String(row[0])); 
    
//     // Pastikan library Utils ada
//     if (typeof Utils === 'undefined' || !Utils.hashPassword) {
//       throw new Error("Library Utils.js tidak ditemukan! Pastikan file Utils ada.");
//     }

//     const defaultPass = '123456';
//     const passHash = Utils.hashPassword(defaultPass);
//     let createdCount = 0;

//     // 4. Loop Pembuatan Akun
//     accountsToCreate.forEach(acc => {
//       // Cek apakah username sudah ada di database?
//       if (!existingUsers.includes(acc.user)) {
        
//         sheet.appendRow([
//           "'" + acc.user, // Username (NISN) pakai kutip satu
//           passHash,       // Password Hash
//           acc.role,       // Role
//           acc.jur,        // Kode Jurusan
//           acc.name,       // Nama Lengkap
//           ''              // Token kosong
//         ]);
        
//         console.log(`➕ Dibuat: ${acc.name} (${acc.user})`);
//         createdCount++;
//       } else {
//         console.log(`⏭️ Skip: ${acc.user} (Sudah ada)`);
//       }
//     });

//     // 5. Laporan Akhir
//     console.log('-------------------------------------------');
//     if (createdCount > 0) {
//       console.log(`✅ SELESAI: ${createdCount} akun baru berhasil dibuat.`);
//       console.log(`🔑 Password Default: ${defaultPass}`);
//     } else {
//       console.log('ℹ️ INFO: Semua akun admin sudah tersedia. Tidak ada yang dibuat.');
//     }
//     console.log('-------------------------------------------');

//   } catch (e) {
//     console.error('❌ ERROR: ' + e.message);
//   } finally {
//     lock.releaseLock();
//   }
// }