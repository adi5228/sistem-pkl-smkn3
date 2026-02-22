/**
 * ============================================================================
 * SISTEM INFORMASI PENDATAAN PKL SMKN 3 KENDARI
 * ============================================================================
 * File       : AuthService.gs
 * Deskripsi  : 
 * Modul ini menangani semua hal yang berkaitan dengan Autentikasi User.
 * Mulai dari fungsi Login, Pembuatan & Validasi Token Sesi (Security), 
 * hingga pendaftaran akun mandiri oleh siswa.
 * ============================================================================
 */

var AuthService = {
  
  // --- KONFIGURASI KEAMANAN ---
  // ⚠️ PENTING: JANGAN PERNAH PUSH SECRET KEY ASLI ANDA KE GITHUB!
  // Ganti string di bawah ini dengan kombinasi acak yang panjang di environment production Anda.
  // Contoh: 'x8s9d7f98s7df89s7d9f87s9d8f7s9d8f7s98d7f'
  SESSION_SECRET: 'GANTI_DENGAN_KODE_RAHASIA_ANDA_DISINI', 
  
  /**
   * ==========================================================================
   * 1. FUNGSI LOGIN
   * ==========================================================================
   * Menerima NISN dan Password, mencocokkannya dengan database.
   * Jika cocok, membuat token UUID baru agar browser mengenali user.
   */
  login: function(nisn, password) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('users');
      if (!sheet) return { success: false, error: 'Database users tidak ditemukan.' };
      
      const data = sheet.getDataRange().getValues();
      
      // Hash password yang diinput user untuk dicocokkan dengan hash di database
      const inputHash = Utils.hashPassword(password);
      
      // Looping cari user (Mulai i = 1 untuk melewati baris Header/Judul Tabel)
      for (let i = 1; i < data.length; i++) {
        const dbNisn = String(data[i][0]).trim();
        const dbPass = data[i][1];
        
        // Cek kecocokan Username (NISN) dan Password
        if (dbNisn === String(nisn).trim() && dbPass === inputHash) {
          
          // Generate Token Sesi Baru yang unik menggunakan format UUID
          const token = Utilities.getUuid();
          
          // Simpan token tersebut ke database (Kolom F / index 5)
          sheet.getRange(i + 1, 6).setValue(token);
          
          return { 
            success: true, 
            sessionToken: token, 
            role: data[i][2],    // Mengembalikan Role (ADMIN/SISWA)
            jurusan: data[i][3]  // Mengembalikan Jurusan asal user
          };
        }
      }
      // Jika looping selesai tapi tidak ada yang cocok
      return { success: false, error: 'NISN atau Password salah.' };
      
    } catch (e) {
      return { success: false, error: 'Login Error: ' + e.message };
    }
  },


  /**
   * ==========================================================================
   * 2. FUNGSI VALIDASI TOKEN (Keamanan API)
   * ==========================================================================
   * Setiap kali browser meminta data, ia akan mengirim token.
   * Fungsi ini mengecek apakah token tersebut ada di dalam database.
   * Jika ya, maka user dianggap sah. Jika tidak, permintaan ditolak.
   */
  validateSessionToken: function(token) {
    if (!token) return null; // Tolak jika tidak ada token
    
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
    // Token tidak ditemukan (Mungkin sudah dihapus admin / expired)
    return null;
  },


  /**
   * ==========================================================================
   * 3. FUNGSI REGISTRASI MANDIRI (Siswa Daftar Sendiri)
   * ==========================================================================
   * Mengizinkan siswa mendaftarkan akunnya sendiri dari halaman Login.
   * Menggunakan LockService agar jika ada 2 siswa mendaftar bersamaan, 
   * data tidak bertumpuk / error.
   */
  register: function(form) {
    // Kunci script eksekusi antrian selama max 5 detik
    const lock = LockService.getScriptLock(); 
    try {
      lock.waitLock(5000); 
      
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheetUsers = ss.getSheetByName('users');
      
      // 1. Validasi Keberadaan Sheet Jurusan
      // Pastikan jurusan yang dipilih siswa benar-benar ada database-nya
      const sheetJurusan = ss.getSheetByName(form.jurusan);
      if (!sheetJurusan) {
        return { success: false, error: 'Jurusan tidak ditemukan dalam sistem.' };
      }

      // 2. Cek Duplikasi NISN
      // Mencegah 1 NISN dipakai untuk membuat 2 akun berbeda
      const dataUsers = sheetUsers.getDataRange().getValues();
      for (let i = 1; i < dataUsers.length; i++) {
        if (String(dataUsers[i][0]).trim() === String(form.nisn).trim()) {
          return { success: false, error: 'NISN ini sudah terdaftar! Silakan Login.' };
        }
      }

      // --- FORMATTING TEXT OTOMATIS ---
      // Rapikan format nama menjadi Title Case (Huruf Besar di Awal Kata)
      let rawNama = form.nama || "";
      let formattedNama = String(rawNama).toLowerCase().replace(/\b\w/g, function(l) { return l.toUpperCase() });

      // 3. Simpan Akun Login ke sheet 'users'
      const passHash = Utils.hashPassword(form.password);
      
      // Format Kolom Users: [NISN, PasswordHash, Role, Jurusan, Nama, Token]
      // Tambahkan kutip (') di depan NISN agar tidak diubah formatnya oleh Google Sheets
      sheetUsers.appendRow([
        "'" + form.nisn, 
        passHash, 
        'SISWA', 
        form.jurusan, 
        formattedNama, 
        ''
      ]);

      // 4. Buat Baris Data Profil Baru di Sheet Jurusan
      // Ambil input tahun dari form, jika tidak diisi, gunakan tahun saat ini
      const tahunPkl = form.tahun || new Date().getFullYear();
      
      // Format Kolom Jurusan: [NISN, Nama, Alamat, HP_Siswa, HP_Ortu, FotoID, FotoPreview, Tahun]
      sheetJurusan.appendRow([
        "'" + form.nisn, 
        formattedNama, 
        "", // Alamat (Kosong dulu)
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
      lock.releaseLock(); // Wajib lepaskan kunci agar orang lain bisa memproses data
    }
  }
};
