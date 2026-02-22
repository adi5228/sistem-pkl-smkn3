/**
 * ============================================================================
 * SISTEM INFORMASI PENDATAAN PKL SMKN 3 KENDARI
 * ============================================================================
 * File       : AdminService.gs
 * Deskripsi  : 
 * Backend khusus untuk menangani aktivitas Admin (Super Admin & Admin Jurusan).
 * Fitur: Manajemen User, CRUD Profil Siswa, Dashboard Statistik, Pindah Jurusan, 
 * dan Export Data ke file Google Spreadsheet baru lengkap dengan foto.
 * ============================================================================
 */

var AdminService = {
  
  // ==========================================================================
  // 1. MANAJEMEN USER & ADMIN (Keamanan Akun)
  // ==========================================================================

  /**
   * Update Username & Password Admin Sendiri
   * Memungkinkan admin mengganti NISN/Username dan Password login mereka.
   * Dilengkapi pengunci (LockService) agar proses update aman dari tabrakan data.
   */
  updateAdminSelf: function(currentNisn, newUsername, newPassword) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000); // Tunggu max 10 detik jika ada proses lain
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('users');
      const data = sheet.getDataRange().getValues();
      
      // A. Validasi Ketersediaan Username Baru (Mencegah Duplikat)
      if (newUsername && newUsername !== currentNisn) {
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]) === String(newUsername)) {
            return { success: false, error: 'Username "' + newUsername + '" sudah digunakan.' };
          }
        }
      }

      // B. Cari Data Admin yang sedang login dan lakukan Update
      let userFound = false;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(currentNisn)) {
          
          // Ganti Username (Kolom A / Index 1)
          if (newUsername && newUsername !== '') {
            sheet.getRange(i + 1, 1).setValue(newUsername);
          }

          // Ganti Password dengan Hash Baru (Kolom B / Index 2)
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
   * Pembuatan User Baru (Siswa) oleh Admin
   * Melakukan injeksi data ke 2 sheet sekaligus: Sheet 'users' (untuk login)
   * dan Sheet 'jurusan' (untuk data biodata profil).
   */
  createUser: function(formData) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(5000);
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('users');
      const data = sheet.getDataRange().getValues();
      
      // A. Mencegah duplikasi NISN
      for(let i = 1; i < data.length; i++){ 
        if(String(data[i][0]) === String(formData.nisn)) {
           return { success: false, error: 'NISN/Username sudah terdaftar!' }; 
        }
      }

      // B. Auto-Format Teks (Nama jadi Huruf Besar di Awal Kata)
      let rawNama = formData.nama || "";
      let formattedNama = String(rawNama).toLowerCase().replace(/\b\w/g, function(l) { return l.toUpperCase() });

      // C. Simpan ke Database Login (Sheet 'users')
      const passHash = Utils.hashPassword(formData.password);
      // Struktur: [NISN, PassHash, Role, Jurusan, Nama, Token]
      sheet.appendRow(["'" + formData.nisn, passHash, 'SISWA', formData.jurusan, formattedNama, '']);

      // D. Simpan Inisial Data ke Database Profil (Sheet Jurusan)
      const sheetJur = ss.getSheetByName(formData.jurusan);
      if(sheetJur) { 
        // Ambil tahun dari input form, jika kosong pakai tahun saat ini
        const tahunPkl = formData.tahun || new Date().getFullYear(); 
        
        // Struktur: [NISN, Nama, Alamat, HP_Siswa, HP_Ortu, FotoID, Formula, Tahun]
        sheetJur.appendRow(["'" + formData.nisn, formattedNama, "", "", "", "", "", tahunPkl]); 
      } else {
        return { success: false, error: 'Sheet jurusan ' + formData.jurusan + ' tidak ditemukan. User login dibuat, tapi data profil gagal.' };
      }

      return { success: true, message: 'User berhasil dibuat.' };
    } catch (error) { 
      return { success: false, error: error.message }; 
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Mengambil Daftar Semua Akun Login (Untuk Manajemen User)
   * Super Admin melihat semua jurusan, Admin Jurusan hanya melihat jurusannya.
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
           
           // LOGIKA FILTER KEAMANAN ADMIN:
           // Jika Super Admin ('-') ATAU jurusannya cocok dengan baris data
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
      return { success: true, users: users.reverse() }; // Reverse agar data terbaru tampil di atas
    } catch (e) { return { success: false, error: e.message }; }
  },

  /**
   * Hapus Data Siswa Secara Penuh (Hard Delete)
   * Menghapus dari sheet 'users' dan sheet profil 'jurusan' (Dilempar ke Utils)
   */
  deleteStudent: function(nisn, jurusan) { 
    try { return Utils.deleteStudentFromSheet(jurusan, nisn); } 
    catch (error) { return { success: false, error: error.message }; } 
  },
  
  /**
   * Mengembalikan Password Akun Tertentu Menjadi Default '123456'
   */
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
  
  /**
   * Pindah Jurusan Siswa (Hanya Super Admin)
   * Memindahkan data dari satu sheet jurusan ke sheet jurusan lainnya
   * dan mengupdate status jurusannya di tabel 'users'.
   */
  changeJurusan: function(nisn, oldJurusan, newJurusan) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheetUsers = ss.getSheetByName('users');
      const sheetOld = ss.getSheetByName(oldJurusan);
      const sheetNew = ss.getSheetByName(newJurusan);
      
      if (!sheetNew) return { success: false, error: 'Jurusan baru tidak ditemukan.' };
      
      // 1. Update data di sheet 'users'
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
      
      // 2. Pemindahan Baris Fisik Antar Sheet Jurusan
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
           sheetNew.appendRow(rowDataToMove); // Pindah ke sheet baru
           sheetOld.deleteRow(rowIndexToDelete); // Hapus dari sheet lama
        } else { 
           // Jika data siswa rusak/hilang di sheet lama, buatkan kerangka baru di sheet baru
           const currentYear = new Date().getFullYear(); 
           sheetNew.appendRow(["'" + nisn, namaUser, "", "", "", "", "", currentYear]); 
        }
      }
      return { success: true, message: `Berhasil pindah ke ${newJurusan.toUpperCase()}` };
    } catch (e) { return { success: false, error: e.message }; }
  },


  // ==========================================================================
  // 2. DATA SISWA (READ & FITUR EXPORT)
  // ==========================================================================

  /**
   * Mengambil Data Profil Siswa per Jurusan untuk ditampilkan di Tabel HTML
   * Melakukan Filter berdasarkan Tahun dan Sorting (Pengurutan) berdasarkan Abjad Nama.
   */
  getDataByJurusan: function(jurusan, filterTahun) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(jurusan);
      if (!sheet) return { success: false, error: 'Sheet jurusan tidak ditemukan.' };
      
      // getDisplayValues agar rumus (seperti URL Image) tidak error
      const data = sheet.getDataRange().getDisplayValues(); 
      let students = [];
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0]) { 
           const tahunPkl = data[i][7] || ""; 
           
           // Filter Tahun PKL
           if (filterTahun && filterTahun !== "" && filterTahun !== "Semua") {
             if (String(tahunPkl) !== String(filterTahun)) continue;
           }

           // Parsing URL Thumbnail
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
      
      // Sorting (Urutkan) Data berdasarkan Abjad Nama Siswa (A - Z)
      students.sort(function(a, b) {
        var namaA = String(a.nama).toLowerCase();
        var namaB = String(b.nama).toLowerCase();
        if (namaA < namaB) return -1;
        if (namaA > namaB) return 1;
        return 0;
      });
      
      return { success: true, students: students };
    } catch (error) { return { success: false, error: error.message }; }
  },


  // ==========================================================================
  // 3. EDIT PROFIL SISWA (ADMIN PANEL)
  // ==========================================================================

  /**
   * Mengambil detail lengkap 1 orang siswa untuk ditampilkan di Form Modal Edit
   */
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

  /**
   * Menyimpan Perubahan Data Siswa yang Diedit oleh Admin
   * Dilengkapi Auto-Format (Title Case & Uppercase)
   */
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

      // --- FORMATTING TEKS OTOMATIS ---
      let formattedNama = String(form.nama).toLowerCase().replace(/\b\w/g, function(l) { return l.toUpperCase() });
      let formattedAlamat = String(form.alamat || "").toUpperCase();

      // Update Data Teks ke Spreadsheet
      sheet.getRange(rowIndex, 2).setValue(formattedNama);
      sheet.getRange(rowIndex, 3).setValue(formattedAlamat);
      sheet.getRange(rowIndex, 4).setValue("'" + form.hp_siswa);
      sheet.getRange(rowIndex, 5).setValue("'" + form.hp_ortu);
      sheet.getRange(rowIndex, 8).setValue(form.tahun_pkl);

      // Handle Foto Upload (Jika Admin mengunggah foto baru)
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


  /**
   * ==========================================================================
   * 4. FITUR PREMIUM: EXPORT KE GOOGLE SPREADSHEET (LAPORAN)
   * ==========================================================================
   * Menggabungkan data teks dan gambar fisik menjadi satu file Spreadsheet baru.
   */
  exportJurusanToGoogleSheet: function(jurusan, filterTahun) {
    try {
      const ssSource = SpreadsheetApp.getActiveSpreadsheet();
      const sheetSource = ssSource.getSheetByName(jurusan);
      if (!sheetSource) return { success: false, error: 'Jurusan tidak ditemukan' };

      const data = sheetSource.getDataRange().getDisplayValues();
      
      // Penamaan File Dinamis
      let namaFile = "Laporan " + jurusan.toUpperCase();
      if (filterTahun && filterTahun !== "" && filterTahun !== "Semua") {
         namaFile += " Angkatan " + filterTahun;
      }
      namaFile += " (" + new Date().toLocaleDateString() + ")";

      // Buat Spreadsheet Baru di Root Google Drive
      const newSS = SpreadsheetApp.create(namaFile);
      const targetSheet = newSS.getActiveSheet();
      
      // Styling Header Tabel Laporan
      targetSheet.appendRow(["No", "NISN", "Nama Siswa", "HP Siswa", "HP Ortu", "Alamat", "Foto Siswa"]);
      targetSheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#e0e0e0")
        .setHorizontalAlignment("center").setVerticalAlignment("middle")
        .setBorder(true, true, true, true, true, true);
      targetSheet.setFrozenRows(1); // Bekukan baris pertama
      
      // Proses Penyaringan Data (Filtering)
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

      // Pengurutan (Sorting) Laporan Berdasarkan Nama (A-Z)
      rawRows.sort(function(a, b) {
        var namaA = String(a[1]).toLowerCase(); // Index 1 is Nama
        var namaB = String(b[1]).toLowerCase();
        if (namaA < namaB) return -1;
        if (namaA > namaB) return 1;
        return 0;
      });
      
      let textData = [];
      let photoQueue = []; 
      let nomorUrut = 1; 

      // Formatting Data per Baris
      for (let i = 0; i < rawRows.length; i++) {
        let row = rawRows[i];
        let fotoId = row[5]; 
        let cleanId = "";
        
        // Ekstraksi File ID dari Link jika formatnya berantakan
        if (fotoId && fotoId.length > 5 && !fotoId.toLowerCase().includes("undefined")) {
            if (fotoId.includes("drive.google.com") || fotoId.includes("/d/")) {
                if (fotoId.includes("/d/")) cleanId = fotoId.split("/d/")[1].split("/")[0];
                else if (fotoId.includes("id=")) cleanId = fotoId.split("id=")[1].split("&")[0];
            } else if (!fotoId.startsWith("http")) { cleanId = fotoId.trim(); }
        }
        
        // Membersihkan Kutip (') agar tidak tampil di Laporan
        let hpSiswa = String(row[3]).replace(/'/g, "").trim();
        let hpOrtu = String(row[4]).replace(/'/g, "").trim();
        // Paksa penambahan 0 di depan jika terpotong saat input manual
        if(hpSiswa.length > 5 && !hpSiswa.startsWith("0")) hpSiswa = "0" + hpSiswa;
        if(hpOrtu.length > 5 && !hpOrtu.startsWith("0")) hpOrtu = "0" + hpOrtu;

        textData.push([nomorUrut, row[0], row[1], hpSiswa, hpOrtu, row[2], ""]);
        
        // Jika ada foto, antrikan untuk proses penempelan gambar fisik
        if (cleanId) photoQueue.push({ rowIndex: textData.length + 1, id: cleanId });
        nomorUrut++;
      }
      
      // Injeksi Data Teks ke Spreadsheet (Lebih cepat daripada row-by-row)
      if (textData.length > 0) {
        targetSheet.getRange(2, 4, textData.length, 2).setNumberFormat("@"); 
        const range = targetSheet.getRange(2, 1, textData.length, 7);
        range.setValues(textData);
        range.setBorder(true, true, true, true, true, true);
        range.setVerticalAlignment("middle").setHorizontalAlignment("left");
        targetSheet.getRange(2, 1, textData.length, 2).setHorizontalAlignment("center");
        targetSheet.getRange(2, 4, textData.length, 2).setHorizontalAlignment("center");
        targetSheet.getRange(2, 6, textData.length, 1).setWrap(true);
        
        // Atur Lebar dan Tinggi Sel Agar Presisi
        targetSheet.setColumnWidth(1, 40); targetSheet.setColumnWidth(2, 100); 
        targetSheet.setColumnWidth(3, 200); targetSheet.setColumnWidth(4, 110); 
        targetSheet.setColumnWidth(5, 110); targetSheet.setColumnWidth(6, 250); 
        targetSheet.setColumnWidth(7, 140); 
        targetSheet.setRowHeights(2, textData.length, 170); // Tinggi cukup untuk Foto 3x4
      } else { 
        return { success: false, error: "Tidak ada data yang tersedia untuk diexport." }; 
      }
      
      // Proses Penyisipan Gambar (Satu per satu)
      photoQueue.forEach(item => {
        try {
           let blob = null;
           try { 
               // Coba cara langsung
               blob = DriveApp.getFileById(item.id).getBlob(); 
           } catch (e) {
               try {
                   // Fallback menggunakan Fetch API jika file di-share berbeda
                   const res = UrlFetchApp.fetch("https://drive.google.com/uc?export=download&id=" + item.id, {muteHttpExceptions: true});
                   if (res.getResponseCode() === 200) blob = res.getBlob();
               } catch (err2) {}
           }
           
           if (blob) {
               // Tempel gambar di kolom ke-7
               const img = targetSheet.insertImage(blob, 7, item.rowIndex);
               img.setWidth(120).setHeight(160); // Ukuran rasio 3x4 (Miniatur Laporan)
               img.setAnchorCellXOffset(10).setAnchorCellYOffset(5); // Padding gambar
           }
        } catch (e) {}
      });
      
      return { success: true, url: newSS.getUrl(), message: "File Laporan Siap Dibuka!" };
      
    } catch (e) { 
      return { success: false, error: e.message }; 
    }
  },


  // ==========================================================================
  // 5. STATISTIK & HELPER (Untuk Dashboard)
  // ==========================================================================

  /**
   * Mendapatkan List Tahun PKL Unik (Untuk dropdown filter)
   */
  getDashboardYears: function() {
    const jurusans = ['tata_kecantikan', 'tata_busana', 'tata_boga', 'perhotelan', 'tjkt'];
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let years = new Set(); // Menggunakan Set agar data tahun tidak duplikat
    
    jurusans.forEach(j => {
      let sheet = ss.getSheetByName(j);
      if (sheet) {
        let data = sheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) { 
           if (data[i][7]) years.add(data[i][7]); 
        }
      }
    });
    
    // Kembalikan array tahun dari yang terbesar (terbaru)
    return Array.from(years).sort().reverse();
  },

  /**
   * Menghitung Jumlah Siswa per Jurusan untuk Grafik Dashboard
   */
  getStats: function(filterYear, specificJurusanOnly) {
    const jurusans = ['tata_kecantikan', 'tata_busana', 'tata_boga', 'perhotelan', 'tjkt'];
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let stats = {}; let total = 0;
    
    jurusans.forEach(j => {
      // Jika Admin Jurusan sedang akses, matikan hitungan untuk jurusan lain (jadi 0)
      if (specificJurusanOnly && specificJurusanOnly !== j) { 
         stats[j] = 0; 
         return; 
      }
      
      let sheet = ss.getSheetByName(j);
      let count = 0;
      
      if (sheet) {
        if (!filterYear || filterYear == "") { 
           // Hitung Total Seluruh Baris (Lebih cepat)
           count = sheet.getLastRow() - 1; 
           if (count < 0) count = 0; 
        } else {
           // Hitung Manual (Looping) Berdasarkan Filter Tahun
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

  /**
   * Mengambil Tahun Khusus untuk 1 Jurusan (Dropdow Data Siswa)
   */
  getAvailableYears: function(jurusan) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(jurusan);
      if (!sheet) return { success: false, years: [] };
      
      const data = sheet.getDataRange().getValues();
      let years = new Set(); 
      for (let i = 1; i < data.length; i++) { 
         if (data[i][7]) years.add(data[i][7]); 
      }
      
      return { success: true, years: Array.from(years).sort().reverse() };
    } catch (e) { 
      return { success: false, error: e.message }; 
    }
  }
};
