/**
 * AdminService.gs (Disimpan sebagai .js untuk Repository GitHub)
 * * Deskripsi:
 * Backend khusus untuk Admin (Super Admin & Admin Jurusan).
 * Fitur: CRUD Siswa, Manajemen User, Dashboard Statistik, dan Export Data.
 * * Dependencies:
 * - Google Apps Script (SpreadsheetApp, DriveApp, UrlFetchApp, Utilities, LockService)
 * - Utils.gs
 */

var AdminService = {
  
  // ====================================================================
  // 1. MANAJEMEN USER & ADMIN
  // ====================================================================

  /**
   * Update Username/Password Admin Sendiri
   */
  updateAdminSelf: function(currentNisn, newUsername, newPassword) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000); 
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('users');
      const data = sheet.getDataRange().getValues();
      
      // 1. Cek Username Baru (Jika diganti)
      if (newUsername && newUsername !== currentNisn) {
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]) === String(newUsername)) {
            return { success: false, error: 'Username "' + newUsername + '" sudah digunakan.' };
          }
        }
      }

      // 2. Cari Admin & Update
      let userFound = false;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(currentNisn)) {
          
          if (newUsername && newUsername !== '') {
            sheet.getRange(i + 1, 1).setValue(newUsername);
          }

          if (newPassword && newPassword !== '') {
            const newHash = Utils.hashPassword(newPassword);
            sheet.getRange(i + 1, 2).setValue(newHash);
          }

          userFound = true;
          break;
        }
      }

      if (!userFound) return { success: false, error: 'Data admin tidak ditemukan.' };
      
      return { success: true, message: 'Profil berhasil diperbarui. Silakan login ulang.' };

    } catch (e) {
      return { success: false, error: 'Gagal update profil: ' + e.message };
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Buat User Baru (Siswa) - Updated dengan Tahun
   */
  createUser: function(formData) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(5000);
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('users');
      const data = sheet.getDataRange().getValues();
      
      // Cek Duplikat NISN
      for(let i=1; i<data.length; i++){ 
        if(String(data[i][0]) === String(formData.nisn)) {
           return { success: false, error: 'NISN/Username sudah terdaftar!' }; 
        }
      }

      // 1. Masukkan ke Sheet 'users' (Login)
      const passHash = Utils.hashPassword(formData.password);
      // Format: [NISN, Pass, Role, Jurusan, Nama, Token]
      // Note: Tambahkan tanda kutip satu (') pada NISN agar angka 0 tidak hilang
      sheet.appendRow(["'" + formData.nisn, passHash, 'SISWA', formData.jurusan, formData.nama, '']);

      // 2. Masukkan ke Sheet Jurusan (Biodata)
      const sheetJur = ss.getSheetByName(formData.jurusan);
      if(sheetJur) { 
        // [UPDATED] Ambil tahun dari form, jika kosong pakai tahun sekarang
        const tahunPkl = formData.tahun || new Date().getFullYear(); 
        
        // Format Sheet Jurusan: [NISN, Nama, Alamat, HP_S, HP_O, Foto, Formula, Tahun]
        sheetJur.appendRow(["'" + formData.nisn, formData.nama, "", "", "", "", "", tahunPkl]); 
      } else {
        return { success: false, error: 'Sheet jurusan ' + formData.jurusan + ' tidak ditemukan. User login dibuat, tapi data siswa gagal.' };
      }

      return { success: true, message: 'User berhasil dibuat.' };
    } catch (error) { 
      return { success: false, error: error.message }; 
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Mengambil semua user dengan Filter Jurusan
   */
  getAllUsers: function(requestorJurusan) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('users');
      if (!sheet) return { success: false, error: 'Sheet users error' };
      
      const data = sheet.getDataRange().getValues();
      let users = [];
      
      for (let i = 1; i < data.length; i++) { 
        if (data[i][0]) {
           const rowJurusan = data[i][3];
           
           // LOGIKA FILTER:
           if (requestorJurusan === '-' || String(rowJurusan) === String(requestorJurusan)) {
              users.push({ 
                  nisn: data[i][0], 
                  role: data[i][2], 
                  jurusan: rowJurusan, 
                  nama: data[i][4] 
              }); 
           }
        }
      }
      return { success: true, users: users.reverse() };
    } catch (e) { return { success: false, error: e.message }; }
  },

  deleteStudent: function(nisn, jurusan) { 
    try { return Utils.deleteStudentFromSheet(jurusan, nisn); } 
    catch (error) { return { success: false, error: error.message }; } 
  },
  
  resetPassword: function(nisn) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('users');
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) { 
        if (String(data[i][0]).trim() === String(nisn).trim()) { 
           const defaultPass = Utils.hashPassword("123456"); 
           sheet.getRange(i + 1, 2).setValue(defaultPass); 
           return { success: true, message: "Password direset ke 123456" }; 
        } 
      }
      return { success: false, error: "User tidak ditemukan" };
    } catch (e) { return { success: false, error: e.message }; }
  },
  
  changeJurusan: function(nisn, oldJurusan, newJurusan) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheetUsers = ss.getSheetByName('users');
      const sheetOld = ss.getSheetByName(oldJurusan);
      const sheetNew = ss.getSheetByName(newJurusan);
      
      if (!sheetNew) return { success: false, error: 'Jurusan baru tidak ditemukan.' };
      
      // Update di 'users'
      const dataUsers = sheetUsers.getDataRange().getValues();
      let userFound = false; let namaUser = ""; 
      for (let i = 1; i < dataUsers.length; i++) { 
        if (String(dataUsers[i][0]) === String(nisn)) { 
           sheetUsers.getRange(i + 1, 4).setValue(newJurusan); 
           namaUser = dataUsers[i][4]; 
           userFound = true; 
           break; 
        } 
      }
      if (!userFound) return { success: false, error: 'User tidak ditemukan.' };
      
      // Pindahkan Data di Sheet Jurusan
      if (sheetOld) {
        const dataOld = sheetOld.getDataRange().getValues();
        let rowDataToMove = null; let rowIndexToDelete = -1;
        for (let i = 1; i < dataOld.length; i++) { 
           if (String(dataOld[i][0]).replace("'", "") === String(nisn)) { 
              rowDataToMove = dataOld[i]; 
              rowIndexToDelete = i + 1; 
              break; 
           } 
        }
        if (rowDataToMove) { 
           sheetNew.appendRow(rowDataToMove); 
           sheetOld.deleteRow(rowIndexToDelete); 
        } else { 
           // Jika data tidak ada di sheet lama, buat baru kosong
           const currentYear = new Date().getFullYear(); 
           sheetNew.appendRow(["'" + nisn, namaUser, "", "", "", "", "", currentYear]); 
        }
      }
      return { success: true, message: `Berhasil pindah ke ${newJurusan.toUpperCase()}` };
    } catch (e) { return { success: false, error: e.message }; }
  },

  // ====================================================================
  // 2. DATA SISWA (READ & EXPORT)
  // ====================================================================

  getDataByJurusan: function(jurusan, filterTahun) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(jurusan);
      if (!sheet) return { success: false, error: 'Sheet jurusan tidak ditemukan.' };
      
      const data = sheet.getDataRange().getDisplayValues(); 
      let students = [];
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0]) { 
           const tahunPkl = data[i][7] || ""; 
           if (filterTahun && filterTahun !== "" && filterTahun !== "Semua") {
             if (String(tahunPkl) !== String(filterTahun)) continue;
           }

           const fotoId = data[i][5]; 
           let cleanUrl = "";
           if (fotoId && fotoId.length > 5 && !fotoId.toLowerCase().includes("undefined")) {
              cleanUrl = "https://drive.google.com/thumbnail?id=" + fotoId + "&sz=w400";
           }

           students.push({
             nisn: String(data[i][0]),
             nama: String(data[i][1]),
             alamat: String(data[i][2]),
             hp_siswa: String(data[i][3]),
             hp_ortu: String(data[i][4]),
             foto_url: cleanUrl,
             tahun_pkl: tahunPkl
           });
        }
      }
      // Sorting by NISN
      students.sort(function(a, b) {
        return String(a.nisn).localeCompare(String(b.nisn));
      });
      return { success: true, students: students };
    } catch (error) { return { success: false, error: error.message }; }
  },

  // ====================================================================
  // 3. FITUR EDIT PROFIL LENGKAP (ADMIN)
  // ====================================================================

  getStudentDetail: function(nisn, jurusan) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(jurusan);
      const data = sheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).replace("'","") === String(nisn)) {
           return {
             success: true,
             data: {
               nisn: data[i][0],
               nama: data[i][1],
               alamat: data[i][2],
               hp_siswa: data[i][3],
               hp_ortu: data[i][4],
               foto_id: data[i][5],
               tahun_pkl: data[i][7]
             }
           };
        }
      }
      return { success: false, error: 'Siswa tidak ditemukan' };
    } catch (e) { return { success: false, error: e.message }; }
  },

  saveStudentDetail: function(form) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(form.jurusan);
      const data = sheet.getDataRange().getValues();
      
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).replace("'","") === String(form.nisn)) {
          rowIndex = i + 1;
          break;
        }
      }
      
      if (rowIndex === -1) return { success: false, error: 'Data siswa tidak ditemukan.' };

      // Update Data Teks
      sheet.getRange(rowIndex, 2).setValue(form.nama);
      sheet.getRange(rowIndex, 3).setValue(form.alamat);
      sheet.getRange(rowIndex, 4).setValue("'" + form.hp_siswa);
      sheet.getRange(rowIndex, 5).setValue("'" + form.hp_ortu);
      sheet.getRange(rowIndex, 8).setValue(form.tahun_pkl);

      // Handle Foto Upload
      if (form.fotoData && form.fotoData.data) {
         try {
            const folderName = "FOTO_PKL_" + form.jurusan.toUpperCase();
            const folders = DriveApp.getFoldersByName(folderName);
            let folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
            
            const blob = Utilities.newBlob(Utilities.base64Decode(form.fotoData.data), form.fotoData.mime, form.nisn + "_" + form.nama);
            const file = folder.createFile(blob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            
            const fileId = file.getId();
            sheet.getRange(rowIndex, 6).setValue(fileId);
            sheet.getRange(rowIndex, 7).setFormula(`=IMAGE("https://drive.google.com/thumbnail?id=${fileId}&sz=w200")`);
            
         } catch (errFoto) {
            return { success: false, error: "Gagal upload foto: " + errFoto.message };
         }
      }

      return { success: true, message: 'Data siswa berhasil diperbarui.' };

    } catch (e) { return { success: false, error: e.message }; }
  },

  exportJurusanToGoogleSheet: function(jurusan, filterTahun) {
    try {
      const ssSource = SpreadsheetApp.getActiveSpreadsheet();
      const sheetSource = ssSource.getSheetByName(jurusan);
      if (!sheetSource) return { success: false, error: 'Jurusan tidak ditemukan' };

      const data = sheetSource.getDataRange().getDisplayValues();
      let namaFile = "Laporan " + jurusan.toUpperCase();
      if (filterTahun && filterTahun !== "" && filterTahun !== "Semua") {
         namaFile += " Angkatan " + filterTahun;
      }
      namaFile += " (" + new Date().toLocaleDateString() + ")";

      const newSS = SpreadsheetApp.create(namaFile);
      const targetSheet = newSS.getActiveSheet();
      
      targetSheet.appendRow(["No", "NISN", "Nama Siswa", "HP Siswa", "HP Ortu", "Alamat", "Foto Siswa"]);
      targetSheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#e0e0e0")
        .setHorizontalAlignment("center").setVerticalAlignment("middle")
        .setBorder(true, true, true, true, true, true);
      targetSheet.setFrozenRows(1);
      
      let rawRows = [];
      for (let i = 1; i < data.length; i++) {
        let row = data[i];
        if(!row[0]) continue; 
        let tahunPkl = row[7]; 
        if (filterTahun && filterTahun !== "" && filterTahun !== "Semua") {
             if (String(tahunPkl) !== String(filterTahun)) continue;
        }
        rawRows.push(row);
      }

      rawRows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
      
      let textData = [];
      let photoQueue = []; 
      let nomorUrut = 1; 

      for (let i = 0; i < rawRows.length; i++) {
        let row = rawRows[i];
        let fotoId = row[5]; 
        let cleanId = "";
        if (fotoId && fotoId.length > 5 && !fotoId.toLowerCase().includes("undefined")) {
            if (fotoId.includes("drive.google.com") || fotoId.includes("/d/")) {
                if (fotoId.includes("/d/")) cleanId = fotoId.split("/d/")[1].split("/")[0];
                else if (fotoId.includes("id=")) cleanId = fotoId.split("id=")[1].split("&")[0];
            } else if (!fotoId.startsWith("http")) { cleanId = fotoId.trim(); }
        }
        
        let hpSiswa = String(row[3]).replace(/'/g, "").trim();
        let hpOrtu = String(row[4]).replace(/'/g, "").trim();
        if(hpSiswa.length > 5 && !hpSiswa.startsWith("0")) hpSiswa = "0" + hpSiswa;
        if(hpOrtu.length > 5 && !hpOrtu.startsWith("0")) hpOrtu = "0" + hpOrtu;

        textData.push([nomorUrut, row[0], row[1], hpSiswa, hpOrtu, row[2], ""]);
        if (cleanId) photoQueue.push({ rowIndex: textData.length + 1, id: cleanId });
        nomorUrut++;
      }
      
      if (textData.length > 0) {
        targetSheet.getRange(2, 4, textData.length, 2).setNumberFormat("@"); 
        const range = targetSheet.getRange(2, 1, textData.length, 7);
        range.setValues(textData);
        range.setBorder(true, true, true, true, true, true);
        range.setVerticalAlignment("middle").setHorizontalAlignment("left");
        targetSheet.getRange(2, 1, textData.length, 2).setHorizontalAlignment("center");
        targetSheet.getRange(2, 4, textData.length, 2).setHorizontalAlignment("center");
        targetSheet.getRange(2, 6, textData.length, 1).setWrap(true);
        targetSheet.setColumnWidth(1, 40); targetSheet.setColumnWidth(2, 100); 
        targetSheet.setColumnWidth(3, 200); targetSheet.setColumnWidth(4, 110); 
        targetSheet.setColumnWidth(5, 110); targetSheet.setColumnWidth(6, 250); 
        targetSheet.setColumnWidth(7, 140); 
        targetSheet.setRowHeights(2, textData.length, 170); 
      } else { return { success: false, error: "Tidak ada data." }; }
      
      photoQueue.forEach(item => {
        try {
           let blob = null;
           try { blob = DriveApp.getFileById(item.id).getBlob(); } 
           catch (e) {
               try {
                   const res = UrlFetchApp.fetch("https://drive.google.com/uc?export=download&id=" + item.id, {muteHttpExceptions: true});
                   if (res.getResponseCode() === 200) blob = res.getBlob();
               } catch (err2) {}
           }
           if (blob) {
               const img = targetSheet.insertImage(blob, 7, item.rowIndex);
               img.setWidth(120).setHeight(160); 
               img.setAnchorCellXOffset(10).setAnchorCellYOffset(5);
           }
        } catch (e) {}
      });
      return { success: true, url: newSS.getUrl(), message: "File siap!" };
    } catch (e) { return { success: false, error: e.message }; }
  },

  // ====================================================================
  // 4. STATISTIK & HELPER
  // ====================================================================

  getDashboardYears: function() {
    const jurusans = ['tata_kecantikan', 'tata_busana', 'tata_boga', 'perhotelan', 'tjkt'];
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let years = new Set();
    jurusans.forEach(j => {
      let sheet = ss.getSheetByName(j);
      if (sheet) {
        let data = sheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) { if (data[i][7]) years.add(data[i][7]); }
      }
    });
    return Array.from(years).sort().reverse();
  },

  getStats: function(filterYear, specificJurusanOnly) {
    const jurusans = ['tata_kecantikan', 'tata_busana', 'tata_boga', 'perhotelan', 'tjkt'];
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let stats = {}; let total = 0;
    
    jurusans.forEach(j => {
      if (specificJurusanOnly && specificJurusanOnly !== j) { 
         stats[j] = 0; 
         return; 
      }
      
      let sheet = ss.getSheetByName(j);
      let count = 0;
      if (sheet) {
        if (!filterYear || filterYear == "") { 
           count = sheet.getLastRow() - 1; 
           if (count < 0) count = 0; 
        } else {
           const data = sheet.getDataRange().getValues();
           for (let i = 1; i < data.length; i++) { 
              if (String(data[i][7]) == String(filterYear)) count++; 
           }
        }
      }
      stats[j] = count; 
      total += count;
    });
    return { success: true, stats: stats, total: total };
  },

  getAvailableYears: function(jurusan) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(jurusan);
      if (!sheet) return { success: false, years: [] };
      const data = sheet.getDataRange().getValues();
      let years = new Set(); 
      for (let i = 1; i < data.length; i++) { if (data[i][7]) years.add(data[i][7]); }
      return { success: true, years: Array.from(years).sort().reverse() };
    } catch (e) { return { success: false, error: e.message }; }
  }
};