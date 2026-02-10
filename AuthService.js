/**
 * AuthService.gs (Disimpan sebagai .js untuk Repository GitHub)
 * * Deskripsi:
 * Layanan backend untuk menangani otentikasi pengguna, validasi sesi,
 * dan pendaftaran siswa baru ke dalam Google Spreadsheet.
 * * Dependencies:
 * - Google Apps Script (SpreadsheetApp, Utilities, LockService)
 * - Utils.gs (Custom utility functions)
 * * Catatan Deployment:
 * - Ubah ekstensi kembali menjadi .gs saat diupload ke Google Apps Script Editor.
 * - Ganti SESSION_SECRET dengan string acak yang aman.
 */

var AuthService = {
  
  // --- KONFIGURASI ---
  // [PENTING] Ganti ini dengan text acak rahasia saat deploy (JANGAN UPLOAD KEY ASLI KE GITHUB)
  SESSION_SECRET: 'GANTI_DENGAN_TEXT_RAHASIA_ANDA', 
  
  // ------------------------------------------------------------------------
  // 1. FUNGSI LOGIN
  // ------------------------------------------------------------------------
  login: function(nisn, password) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('users');
      if (!sheet) return { success: false, error: 'Database users tidak ditemukan.' };
      
      const data = sheet.getDataRange().getValues();
      
      // Hash password yang diinput user untuk dicocokkan
      const inputHash = Utils.hashPassword(password);
      
      // Loop cari user (Mulai baris ke-2 karena ada header)
      for (let i = 1; i < data.length; i++) {
        const dbNisn = String(data[i][0]).trim();
        const dbPass = data[i][1];
        
        // Cek kecocokan
        if (dbNisn === String(nisn).trim() && dbPass === inputHash) {
          
          // Generate Token Sesi Baru (UUID)
          const token = Utilities.getUuid();
          
          // Simpan token ke database (Kolom F / index 5)
          sheet.getRange(i + 1, 6).setValue(token);
          
          return { 
            success: true, 
            sessionToken: token, 
            role: data[i][2], // Role (ADMIN/SISWA)
            jurusan: data[i][3] // Jurusan
          };
        }
      }
      return { success: false, error: 'NISN atau Password salah.' };
      
    } catch (e) {
      return { success: false, error: 'Login Error: ' + e.message };
    }
  },

  // ------------------------------------------------------------------------
  // 2. FUNGSI VALIDASI TOKEN (Cek apakah user sedang login)
  // ------------------------------------------------------------------------
  validateSessionToken: function(token) {
    if (!token) return null;
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('users');
    if (!sheet) return null;
    
    const data = sheet.getDataRange().getValues();
    
    // Cari token di database
    for (let i = 1; i < data.length; i++) {
      // Kolom F (index 5) adalah session_token
      if (String(data[i][5]) === String(token)) { 
        return {
          nisn: data[i][0],
          role: data[i][2],
          jurusan: data[i][3],
          nama_lengkap: data[i][4]
        };
      }
    }
    return null;
  },

  // ------------------------------------------------------------------------
  // 3. FUNGSI REGISTRASI MANDIRI (Siswa Daftar Sendiri)
  // ------------------------------------------------------------------------
  register: function(form) {
    const lock = LockService.getScriptLock(); // Tambahkan Lock agar aman dari double input
    try {
      lock.waitLock(5000); 
      
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheetUsers = ss.getSheetByName('users');
      
      // Pastikan jurusan yang dipilih valid (Sheetnya ada)
      const sheetJurusan = ss.getSheetByName(form.jurusan);
      if (!sheetJurusan) {
        return { success: false, error: 'Jurusan tidak ditemukan dalam sistem.' };
      }

      // A. Cek Duplikasi NISN (Looping sheet users)
      const dataUsers = sheetUsers.getDataRange().getValues();
      for (let i = 1; i < dataUsers.length; i++) {
        if (String(dataUsers[i][0]).trim() === String(form.nisn).trim()) {
          return { success: false, error: 'NISN ini sudah terdaftar! Silakan Login.' };
        }
      }

      // B. Simpan Akun Login ke sheet 'users'
      const passHash = Utils.hashPassword(form.password);
      
      // Format Kolom Users: [NISN, PasswordHash, Role, Jurusan, Nama, Token]
      // Note: NISN ditambah kutip satu (') agar tetap terbaca sebagai string di Google Sheet (menjaga angka 0 di depan)
      sheetUsers.appendRow([
        "'" + form.nisn, 
        passHash, 
        'SISWA', 
        form.jurusan, 
        form.nama, 
        ''
      ]);

      // C. Simpan Data Profil ke Sheet Jurusan
      // Menggunakan input tahun dari form, default ke tahun sekarang jika kosong
      const tahunPkl = form.tahun || new Date().getFullYear();
      
      // Format Kolom Jurusan: [NISN, Nama, Alamat, HP Siswa, HP Ortu, FotoID, FotoPreview, Tahun]
      sheetJurusan.appendRow([
        "'" + form.nisn, 
        form.nama, 
        "", // Alamat (Kosong)
        "", // HP Siswa (Kosong)
        "", // HP Ortu (Kosong)
        "", // Foto ID (Kosong)
        "", // Foto Preview (Kosong)
        tahunPkl
      ]);

      return { success: true, message: 'Pendaftaran Berhasil! Silakan Login.' };

    } catch (e) {
      return { success: false, error: 'Register Error: ' + e.message };
    } finally {
      lock.releaseLock(); // Lepaskan kunci
    }
  }
};