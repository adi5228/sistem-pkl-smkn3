/**
 * ============================================================================
 * SISTEM INFORMASI PENDATAAN PKL SMKN 3 KENDARI
 * ============================================================================
 * File       : Utils.gs
 * Deskripsi  : 
 * File ini berisi sekumpulan fungsi bantu (Utility Helper) yang dapat
 * dipanggil oleh modul lain (AuthService, AdminService, StudentService).
 * Mencakup fungsi Kriptografi (Keamanan), Formatting, dan dasar CRUD.
 * ============================================================================
 */

var Utils = {
  
  // ==========================================================================
  // 1. KEAMANAN & HELPER DASAR
  // ==========================================================================

  /**
   * Membuat Hash Password
   * Menggunakan algoritma MD5 bawaan Google Apps Script (Utilities).
   * Berfungsi agar password asli user tidak terlihat di Google Sheet.
   * * @param {string} password - Password mentah (Plain text)
   * @returns {string} - Teks Hash Hexadesimal
   */
  hashPassword: function(password) {
    var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, password);
    var txtHash = '';
    
    // Konversi array byte (rawHash) menjadi string hexadesimal
    for (var i = 0; i < rawHash.length; i++) {
      var hashVal = rawHash[i];
      if (hashVal < 0) {
        hashVal += 256; // Konversi byte negatif ke positif
      }
      if (hashVal.toString(16).length == 1) {
        txtHash += '0'; // Padding angka nol jika hanya 1 digit
      }
      txtHash += hashVal.toString(16);
    }
    return txtHash;
  },

  /**
   * Membuat Signature untuk Token (Opsional/Tingkat Lanjut)
   * Menggunakan HMAC-SHA256 untuk memverifikasi keaslian data.
   */
  computeHmac: function(message, key) {
    var signature = Utilities.computeHmacSignature(
      Utilities.MacAlgorithm.HMAC_SHA_256,
      message,
      key
    );
    return Utilities.base64Encode(signature);
  },

  /**
   * Generate ID Unik (UUID)
   * Biasa digunakan untuk membuat Session Token.
   */
  generateId: function() {
    return Utilities.getUuid();
  },
  
  /**
   * Memformat Tanggal ke bentuk yang rapi (YYYY-MM-DD HH:mm)
   */
  formatDate: function(date) {
    if (!date) return '';
    return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  },


  // ==========================================================================
  // 2. FUNGSI DATABASE (CRUD DASAR SPREADSHEET)
  // ==========================================================================

  /**
   * Map Row To Student (Helper Mapper)
   * Mengubah data baris dari Google Sheet (yang berupa Array [0,1,2...]) 
   * menjadi Object JSON yang rapi agar lebih mudah digunakan di Frontend.
   * * Struktur Kolom Sheet Jurusan:
   * [0]NISN, [1]Nama, [2]Alamat, [3]HP Siswa, [4]HP Ortu, [5]Foto ID, [6]Preview, [7]Tahun Masuk
   */
  mapRowToStudent: function(row) {
    return {
      nisn: row[0] ? String(row[0]) : "",
      nama: row[1] || "",
      alamat: row[2] || "",
      no_hp_siswa: row[3] || "",
      no_hp_orangtua: row[4] || "",
      foto_id: row[5] || "",
      foto_preview: row[6] || "",
      tahun_masuk: row[7] ? String(row[7]) : "" // Kolom H (Index 7)
    };
  },

  /**
   * MENGAMBIL DATA (READ)
   * Mengambil semua data siswa dari sheet jurusan tertentu.
   * Dilengkapi fitur Filter berdasarkan "Tahun Masuk".
   */
  getStudentsByJurusan: function(jurusan, filterTahun) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(jurusan);
    
    // Jika sheet jurusan tidak ada (misal salah ketik nama sheet), kembalikan array kosong
    if (!sheet) return [];
    
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return []; // Jika hanya ada header baris 1
    
    // Ambil Kolom A sampai H (8 Kolom) secara sekaligus (Efisiensi memori)
    var data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    
    // Map data array mentah ke object JSON
    var students = data.map(function(row) {
      return Utils.mapRowToStudent(row);
    });

    // Jika parameter filterTahun dikirim, saring data object tersebut
    if (filterTahun && filterTahun !== "" && filterTahun !== "Semua") {
      students = students.filter(function(s) {
        return String(s.tahun_masuk) === String(filterTahun);
      });
    }

    return students;
  },

  /**
   * MENAMBAH DATA (CREATE)
   * Menambahkan baris siswa baru ke sheet jurusan yang dituju.
   */
  addStudentToSheet: function(jurusan, data) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(jurusan);
    if (!sheet) return { success: false, message: "Sheet Jurusan tidak ditemukan" };

    // Cek duplikat NISN sederhana sebelum insert
    var existingData = sheet.getDataRange().getValues();
    for (var i = 1; i < existingData.length; i++) {
      if (String(existingData[i][0]) === String(data.nisn)) {
        return { success: false, message: "NISN sudah terdaftar!" };
      }
    }

    // Append baris baru (Sesuai urutan 8 Kolom)
    sheet.appendRow([
      "'" + data.nisn, // Pakai kutip (') agar angka 0 di depan NISN tidak hilang
      data.nama,
      data.alamat,
      data.no_hp_siswa,
      data.no_hp_orangtua,
      data.foto_id,
      data.foto_preview,
      data.tahun_masuk
    ]);

    return { success: true };
  },

  /**
   * MENGUBAH DATA (UPDATE)
   * Mencari baris siswa berdasarkan NISN, lalu menimpa datanya.
   */
  updateStudentInSheet: function(jurusan, nisn, data) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(jurusan);
    if (!sheet) return { success: false, message: "Sheet tidak ditemukan" };

    var values = sheet.getDataRange().getValues();
    
    // Loop cari baris siswa
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(nisn)) { // Cek NISN di Kolom A
        
        var rowIdx = i + 1; // +1 karena index array mulai dari 0, baris sheet dari 1
        
        // Menimpa sel secara spesifik
        sheet.getRange(rowIdx, 2).setValue(data.nama);
        sheet.getRange(rowIdx, 3).setValue(data.alamat);
        sheet.getRange(rowIdx, 4).setValue(data.no_hp_siswa);
        sheet.getRange(rowIdx, 5).setValue(data.no_hp_orangtua);
        
        // Hanya update foto jika ada gambar baru (tidak null/kosong)
        if (data.foto_id) sheet.getRange(rowIdx, 6).setValue(data.foto_id);
        if (data.foto_preview) sheet.getRange(rowIdx, 7).setValue(data.foto_preview);
        
        // Update Tahun Masuk
        if (data.tahun_masuk) sheet.getRange(rowIdx, 8).setValue(data.tahun_masuk);
        
        return { success: true };
      }
    }
    
    return { success: false, message: "NISN tidak ditemukan untuk diupdate" };
  },

  /**
   * MENGHAPUS DATA (DELETE)
   * Menghapus baris profil siswa di sheet Jurusan, 
   * DAN menghapus baris login siswa tersebut di sheet 'users'.
   */
  deleteStudentFromSheet: function(jurusan, nisn) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Hapus profil dari sheet Jurusan
    var sheet = ss.getSheetByName(jurusan);
    if (sheet) {
        var values = sheet.getDataRange().getValues();
        for (var i = 1; i < values.length; i++) {
          if (String(values[i][0]).replace("'","").trim() === String(nisn).trim()) {
            sheet.deleteRow(i + 1);
            break; // Keluar dari loop jurusan
          }
        }
    }
    
    // 2. Hapus akun dari sheet 'users' (Agar tidak bisa login lagi)
    var userSheet = ss.getSheetByName('users');
    if (userSheet) {
        var userValues = userSheet.getDataRange().getValues();
        for (var u = 1; u < userValues.length; u++) {
          if (String(userValues[u][0]).replace("'","").trim() === String(nisn).trim()) {
            userSheet.deleteRow(u + 1);
            break; // Keluar dari loop users
          }
        }
    }
    
    return { success: true, message: "Data Siswa berhasil dihapus permanen." };
  }
};
