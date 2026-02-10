/**
 * StudentService.gs (Disimpan sebagai .js untuk Repository GitHub)
 * * Deskripsi:
 * Backend khusus untuk menangani aktivitas Siswa (User Biasa).
 * Fitur: Melihat profil, edit biodata, upload foto, dan ganti password.
 * * Dependencies:
 * - Google Apps Script (SpreadsheetApp, DriveApp, Utilities)
 * - Utils.gs
 */

var StudentService = {

  /**
   * Mengambil Profil Siswa Berdasarkan User Login
   */
  getProfile: function(user) {
    try {
      const sheetName = user.jurusan;
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return { success: false, error: 'Sheet jurusan tidak ditemukan' };
      
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return { success: false, error: 'Data kosong' };

      // Ambil semua data sekaligus untuk efisiensi
      const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
      let profile = null;
      
      for (let i = 0; i < data.length; i++) {
        // Cek NISN (Pakai String() dan bersihkan tanda kutip agar aman)
        if (String(data[i][0]).replace("'", "").trim() === String(user.nisn).trim()) {
          const fotoId = data[i][5];
          let fotoUrl = null;
          if (fotoId && fotoId.length > 5) {
             fotoUrl = "https://drive.google.com/thumbnail?id=" + fotoId + "&sz=w400";
          }
          profile = {
            nama: data[i][1],
            alamat: data[i][2],
            no_hp_siswa: String(data[i][3]), // Pastikan terbaca string
            no_hp_orangtua: String(data[i][4]),
            foto_id: fotoId,
            foto_url: fotoUrl, 
            tahun_pkl: data[i][7] || "" 
          };
          break;
        }
      }
      return { success: true, profile: profile };
    } catch (error) { return { success: false, error: error.message }; }
  },

  /**
   * Upload Foto Siswa ke Google Drive
   */
  uploadFoto: function(params, user) {
    try {
      let fileData = params.fileData; 
      const mimeType = params.fileType || 'image/jpeg';
      if (!fileData) return { success: false, error: "Data foto kosong." };
      if (fileData.indexOf('base64,') > -1) fileData = fileData.split('base64,')[1];

      // Folder khusus foto
      const FOLDER_NAME = "FOTO_SISWA_PKL_SMKN3";
      let folders = DriveApp.getFoldersByName(FOLDER_NAME);
      let folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
      
      const decoded = Utilities.base64Decode(fileData);
      const blob = Utilities.newBlob(decoded, mimeType, user.nisn + "_" + user.nama);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      return { success: true, fileId: file.getId(), thumbnailLink: "https://drive.google.com/uc?export=view&id=" + file.getId() };
    } catch (error) { return { success: false, error: "Gagal upload: " + error.message }; }
  },

  /**
   * Menyimpan Perubahan Profil Siswa
   */
  saveProfile: function(user, formData) {
    try {
      const sheetName = user.jurusan;
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return { success: false, error: 'Jurusan error' };
      
      const data = sheet.getDataRange().getValues();
      let rowIndex = -1;
      const targetNisn = String(user.nisn).trim();
      
      // Cari Baris Siswa
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).replace("'", "").trim() === targetNisn) {
          rowIndex = i + 1; break;
        }
      }
      
      const fotoId = formData.foto_id || ""; 
      const fotoUrl = formData.foto_url || "";
      const tahunPkl = formData.tahun_pkl || ""; 
      
      // [PENTING] Tambahkan tanda kutip satu (') agar angka 0 di depan HP tidak hilang
      let hpSiswa = String(formData.no_hp_siswa).trim();
      if (!hpSiswa.startsWith("'")) hpSiswa = "'" + hpSiswa;

      let hpOrtu = String(formData.no_hp_orangtua).trim();
      if (!hpOrtu.startsWith("'")) hpOrtu = "'" + hpOrtu;

      let rumusImage = "";
      if (fotoUrl) rumusImage = '=IMAGE("' + fotoUrl + '")';

      if (rowIndex === -1) {
        // INSERT DATA BARU (Jika belum ada di sheet jurusan)
        sheet.appendRow(["'" + user.nisn, formData.nama, formData.alamat, hpSiswa, hpOrtu, fotoId, "", tahunPkl]);
        const lastRow = sheet.getLastRow();
        if (rumusImage) sheet.getRange(lastRow, 7).setFormula(rumusImage);
      } else {
        // UPDATE DATA LAMA
        sheet.getRange(rowIndex, 2).setValue(formData.nama);
        sheet.getRange(rowIndex, 3).setValue(formData.alamat);
        
        // Simpan HP dengan format teks (kutip satu)
        sheet.getRange(rowIndex, 4).setValue(hpSiswa); 
        sheet.getRange(rowIndex, 5).setValue(hpOrtu);
        
        if (fotoId) {
          sheet.getRange(rowIndex, 6).setValue(fotoId); 
          sheet.getRange(rowIndex, 7).setFormula(rumusImage); 
        }
        if (tahunPkl) { 
           sheet.getRange(rowIndex, 8).setValue(tahunPkl);
        }
      }
      return { success: true, message: 'Data berhasil disimpan!' };
    } catch (error) { return { success: false, error: error.message }; }
  },

  /**
   * Mengganti Password Siswa
   */
  changePassword: function(user, newPassword) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('users');
      const data = sheet.getDataRange().getValues();
      const targetNisn = String(user.nisn).trim();

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === targetNisn) {
           const newHash = Utils.hashPassword(newPassword);
           sheet.getRange(i + 1, 2).setValue(newHash); 
           return { success: true };
        }
      }
      return { success: false, error: "User tidak ditemukan" };
    } catch (e) { return { success: false, error: e.message }; }
  }
};