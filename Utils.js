/**
 * Utils.gs (Disimpan sebagai .js untuk Repository GitHub)
 * * Deskripsi:
 * Kumpulan fungsi helper (Utility) untuk keamanan, format data, 
 * dan operasi CRUD dasar ke Spreadsheet (Create, Read, Update, Delete).
 * * Dependencies:
 * - Google Apps Script (Utilities, SpreadsheetApp, Session)
 */

var Utils = {
  
  // ====================================================================
  // 1. KEAMANAN & HELPER UMUM
  // ====================================================================

  /**
   * Membuat Hash Password (MD5 simple)
   * Digunakan untuk mengenkripsi password user sebelum disimpan.
   */
  hashPassword: function(password) {
    var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, password);
    var txtHash = '';
    for (var i = 0; i < rawHash.length; i++) {
      var hashVal = rawHash[i];
      if (hashVal < 0) {
        hashVal += 256;
      }
      if (hashVal.toString(16).length == 1) {
        txtHash += '0';
      }
      txtHash += hashVal.toString(16);
    }
    return txtHash;
  },

  /**
   * Membuat Signature HMAC-SHA256
   * Digunakan untuk keamanan token sesi.
   */
  computeHmac: function(message, key) {
    var signature = Utilities.computeHmacSignature(
      Utilities.MacAlgorithm.HMAC_SHA_256,
      message,
      key
    );
    return Utilities.base64Encode(signature);
  },

  generateId: function() {
    return Utilities.getUuid();
  },
  
  formatDate: function(date) {
    if (!date) return '';
    return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  },

  // ====================================================================
  // 2. FUNGSI DATABASE (CRUD SPREADSHEET)
  // ====================================================================

  /**
   * Mengubah Array Baris menjadi Object Siswa yang rapi
   * Struktur Kolom Sheet Jurusan:
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
   * Mengambil semua siswa dari jurusan tertentu.
   * Mendukung filter berdasarkan tahun.
   */
  getStudentsByJurusan: function(jurusan, filterTahun) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(jurusan);
    
    if (!sheet) return [];
    
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return []; // Hanya header
    
    // Ambil Kolom A sampai H (8 Kolom)
    // getRange(baris_mulai, kolom_mulai, jumlah_baris, jumlah_kolom)
    var data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    
    // Map data array ke object
    var students = data.map(function(row) {
      return Utils.mapRowToStudent(row);
    });

    // Jika ada filter tahun, saring datanya
    if (filterTahun && filterTahun !== "" && filterTahun !== "Semua") {
      students = students.filter(function(s) {
        return String(s.tahun_masuk) === String(filterTahun);
      });
    }

    return students;
  },

  /**
   * MENAMBAH DATA (CREATE)
   * Menambahkan siswa baru ke sheet jurusan
   */
  addStudentToSheet: function(jurusan, data) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(jurusan);
    if (!sheet) return { success: false, message: "Sheet Jurusan tidak ditemukan" };

    // Cek duplikat NISN sederhana
    var existingData = sheet.getDataRange().getValues();
    for (var i = 1; i < existingData.length; i++) {
      if (String(existingData[i][0]) === String(data.nisn)) {
        return { success: false, message: "NISN sudah terdaftar!" };
      }
    }

    // Append baris baru (8 Kolom)
    sheet.appendRow([
      "'" + data.nisn, // Pakai kutip biar string (menjaga angka 0 di depan)
      data.nama,
      data.alamat,
      data.no_hp_siswa,
      data.no_hp_orangtua,
      data.foto_id,
      data.foto_preview,
      data.tahun_masuk // Simpan Tahun Masuk
    ]);

    return { success: true };
  },

  /**
   * MENGUBAH DATA (UPDATE)
   * Mencari NISN dan mengupdate data baris tersebut
   */
  updateStudentInSheet: function(jurusan, nisn, data) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(jurusan);
    if (!sheet) return { success: false, message: "Sheet tidak ditemukan" };

    var values = sheet.getDataRange().getValues();
    
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(nisn)) { // Cek NISN (Kolom A)
        // Update Kolom B sampai H (Index 2, kolom 2-8)
        var rowIdx = i + 1;
        
        sheet.getRange(rowIdx, 2).setValue(data.nama);
        sheet.getRange(rowIdx, 3).setValue(data.alamat);
        sheet.getRange(rowIdx, 4).setValue(data.no_hp_siswa);
        sheet.getRange(rowIdx, 5).setValue(data.no_hp_orangtua);
        
        // Hanya update foto jika ada data baru, jika kosong biarkan yang lama
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
   * Menghapus siswa dari sheet Jurusan DAN sheet Users (Login)
   */
  deleteStudentFromSheet: function(jurusan, nisn) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(jurusan);
    
    // 1. Hapus dari Sheet Jurusan
    if (sheet) {
        var values = sheet.getDataRange().getValues();
        for (var i = 1; i < values.length; i++) {
          // Gunakan replace untuk handle format string NISN (misal '00123)
          if (String(values[i][0]).replace("'","") === String(nisn)) {
            sheet.deleteRow(i + 1);
            break; 
          }
        }
    }

    // 2. Hapus dari Sheet 'users' (Agar tidak bisa login lagi)
    var userSheet = ss.getSheetByName('users');
    if (userSheet) {
        var userValues = userSheet.getDataRange().getValues();
        for (var u = 1; u < userValues.length; u++) {
          if (String(userValues[u][0]) === String(nisn)) {
            userSheet.deleteRow(u + 1);
            return { success: true, message: "Data siswa dan akun login berhasil dihapus." };
          }
        }
    }
    
    // Jika hanya terhapus di jurusan atau tidak ketemu di users, tetap return sukses
    return { success: true, message: "Data siswa dihapus (Akun login mungkin sudah tidak ada)." };
  }
};