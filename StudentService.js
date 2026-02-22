/**
 * ============================================================================
 * SISTEM INFORMASI PENDATAAN PKL SMKN 3 KENDARI
 * ============================================================================
 * File       : StudentService.gs
 * Deskripsi  : 
 * Backend khusus untuk menangani aktivitas Siswa (User Biasa).
 * Menangani logika pengambilan profil, pembaruan biodata, upload pas foto
 * ke Google Drive, dan penggantian password siswa.
 * ============================================================================
 */

var StudentService = {

  /**
   * ==========================================================================
   * 1. GET PROFILE (Mengambil Data Siswa)
   * ==========================================================================
   * Mengambil data biodata siswa dari sheet jurusan masing-masing
   * berdasarkan NISN user yang sedang login.
   * * @param {object} user - Data user dari session token
   */
  getProfile: function(user) {
    try {
      const sheetName = user.jurusan;
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(sheetName);
      
      if (!sheet) return { success: false, error: 'Sheet jurusan tidak ditemukan di database.' };
      
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return { success: false, error: 'Data kosong. Belum ada siswa di jurusan ini.' };

      // Ambil semua data sekaligus (Batch Read) untuk efisiensi eksekusi script
      // Kolom A sampai H (8 Kolom)
      const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
      let profile = null;
      
      for (let i = 0; i < data.length; i++) {
        // Pembersihan string: Hilangkan kutip (') dan spasi agar pencocokan akurat
        if (String(data[i][0]).replace("'", "").trim() === String(user.nisn).trim()) {
          
          const fotoId = data[i][5]; // Kolom F: ID File Google Drive
          let fotoUrl = null;
          
          // Generate URL Thumbnail resolusi 400px jika foto_id valid
          if (fotoId && fotoId.length > 5) {
             fotoUrl = "https://drive.google.com/thumbnail?id=" + fotoId + "&sz=w400";
          }
          
          profile = {
            nama: data[i][1],
            alamat: data[i][2],
            no_hp_siswa: String(data[i][3]), // Paksa jadi string agar 0 tidak hilang
            no_hp_orangtua: String(data[i][4]),
            foto_id: fotoId,
            foto_url: fotoUrl, 
            tahun_pkl: data[i][7] || "" // Kolom H: Tahun PKL
          };
          break; // Hentikan pencarian jika data sudah ketemu
        }
      }
      return { success: true, profile: profile };
    } catch (error) { 
      return { success: false, error: error.message }; 
    }
  },


  /**
   * ==========================================================================
   * 2. UPLOAD FOTO KE GOOGLE DRIVE
   * ==========================================================================
   * Mengkonversi data gambar Base64 dari frontend (Cropper.js) 
   * menjadi file fisik yang disimpan di folder Google Drive sekolah.
   */
  uploadFoto: function(params, user) {
    try {
      let fileData = params.fileData; 
      const mimeType = params.fileType || 'image/jpeg';
      
      if (!fileData) return { success: false, error: "Data foto kosong." };
      
      // Buang prefix 'data:image/jpeg;base64,' jika terbawa dari frontend
      if (fileData.indexOf('base64,') > -1) fileData = fileData.split('base64,')[1];

      // Tentukan atau Buat Folder Khusus di Google Drive
      const FOLDER_NAME = "FOTO_SISWA_PKL_SMKN3";
      let folders = DriveApp.getFoldersByName(FOLDER_NAME);
      let folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
      
      // Konversi Base64 kembali ke format Blob (File)
      const decoded = Utilities.base64Decode(fileData);
      
      // Format Nama File: "NISN_NamaSiswa.jpg"
      const blob = Utilities.newBlob(decoded, mimeType, user.nisn + "_" + user.nama);
      const file = folder.createFile(blob);
      
      // Set agar file bisa dilihat secara public (Wajib agar bisa tampil di HTML & Sheet)
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      return { 
        success: true, 
        fileId: file.getId(), 
        thumbnailLink: "https://drive.google.com/uc?export=view&id=" + file.getId() 
      };
      
    } catch (error) { 
      return { success: false, error: "Gagal upload: " + error.message }; 
    }
  },


  /**
   * ==========================================================================
   * 3. MENYIMPAN PERUBAHAN BIODATA SISWA
   * ==========================================================================
   * Menyimpan data teks dan foto ke Google Sheet.
   * Dilengkapi fitur Auto-Format untuk merapikan penulisan.
   */
  saveProfile: function(user, formData) {
    try {
      const sheetName = user.jurusan;
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return { success: false, error: 'Sheet jurusan tidak ditemukan.' };
      
      const data = sheet.getDataRange().getValues();
      let rowIndex = -1;
      const targetNisn = String(user.nisn).trim();
      
      // Cari Baris Siswa berdasarkan NISN
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).replace("'", "").trim() === targetNisn) {
          rowIndex = i + 1; // +1 karena Array index 0, Sheet mulai dari baris 1
          break;
        }
      }
      
      // --- FORMATTING TEKS OTOMATIS ---
      // 1. Nama: Title Case (Contoh: "budi santoso" -> "Budi Santoso")
      let rawNama = formData.nama || "";
      let formattedNama = String(rawNama).toLowerCase().replace(/\b\w/g, function(l) { return l.toUpperCase() });
      
      // 2. Alamat: UPPERCASE (Contoh: "jl. mawar" -> "JL. MAWAR")
      let formattedAlamat = String(formData.alamat || "").toUpperCase();
      // ---------------------------------

      const fotoId = formData.foto_id || ""; 
      const fotoUrl = formData.foto_url || "";
      const tahunPkl = formData.tahun_pkl || ""; 
      
      // --- PENGAMANAN ANGKA NOL (0) DI NO HP ---
      // Tambahkan awalan kutip satu (') agar Sheet tidak menganggapnya sebagai rumus matematika
      let hpSiswa = String(formData.no_hp_siswa).trim();
      if (!hpSiswa.startsWith("'")) hpSiswa = "'" + hpSiswa;

      let hpOrtu = String(formData.no_hp_orangtua).trim();
      if (!hpOrtu.startsWith("'")) hpOrtu = "'" + hpOrtu;

      // Pembuatan rumus Image untuk preview di Spreadsheet
      let rumusImage = "";
      if (fotoUrl) rumusImage = '=IMAGE("' + fotoUrl + '")';

      // PROSES PENYIMPANAN
      if (rowIndex === -1) {
        // KONDISI A: Insert Data Baru (Jika baris siswa belum ada di sheet jurusan)
        sheet.appendRow(["'" + user.nisn, formattedNama, formattedAlamat, hpSiswa, hpOrtu, fotoId, "", tahunPkl]);
        const lastRow = sheet.getLastRow();
        if (rumusImage) sheet.getRange(lastRow, 7).setFormula(rumusImage);
      } else {
        // KONDISI B: Update Data Lama (Timpa nilai sel secara spesifik)
        sheet.getRange(rowIndex, 2).setValue(formattedNama);   
        sheet.getRange(rowIndex, 3).setValue(formattedAlamat); 
        sheet.getRange(rowIndex, 4).setValue(hpSiswa); 
        sheet.getRange(rowIndex, 5).setValue(hpOrtu);
        
        // Update foto hanya jika siswa melakukan upload foto baru
        if (fotoId) {
          sheet.getRange(rowIndex, 6).setValue(fotoId); 
          sheet.getRange(rowIndex, 7).setFormula(rumusImage); 
        }
        
        if (tahunPkl) { 
           sheet.getRange(rowIndex, 8).setValue(tahunPkl);
        }
      }
      
      return { success: true, message: 'Biodata berhasil disimpan!' };
      
    } catch (error) { 
      return { success: false, error: error.message }; 
    }
  },


  /**
   * ==========================================================================
   * 4. GANTI PASSWORD (AKUN SISWA)
   * ==========================================================================
   * Mencari akun siswa di sheet 'users' dan menimpa password lamanya
   * dengan password baru yang sudah di-hash (MD5).
   */
  changePassword: function(user, newPassword) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('users');
      const data = sheet.getDataRange().getValues();
      const targetNisn = String(user.nisn).trim();

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === targetNisn) {
           
           // Generate Hash dari password baru
           const newHash = Utils.hashPassword(newPassword);
           
           // Simpan ke kolom B (Index 2)
           sheet.getRange(i + 1, 2).setValue(newHash); 
           
           return { success: true };
        }
      }
      return { success: false, error: "User tidak ditemukan di database." };
      
    } catch (e) { 
      return { success: false, error: e.message }; 
    }
  }
};
