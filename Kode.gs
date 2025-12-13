/* --- Code.gs (FINAL MODIFIKASI: Alamat Job di Sheet Master) --- */

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Aplikasi Manajemen Saldo')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getSheet(namaTab) {
  // ID SPREADSHEET (GANTI DENGAN ID ANDA)
  // PASTIKAN ID SPREADSHEET INI VALID
  var id = "1pCatbrQlgN-FU_zXvYYDMCCRqay2tEXYxvHwqxtM_O4"; 
  return SpreadsheetApp.openById(id).getSheetByName(namaTab);
}

/* =========================================
   1. AUTH & SALDO REALTIME
   ========================================= */
function checkLogin(idInput, passInput) {
  try {
    // ADMIN
    if (String(idInput).trim() === 'admin' && String(passInput).trim() === 'admin123') {
      return { status: 'sukses', role: 'admin', nama: 'Administrator', saldo: '-' };
    }
    
    // USER
    var sheet = getSheet('Users');
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var dbId = String(data[i][0]).toLowerCase().trim();
      var dbPass = String(data[i][2]).trim();
      var dbStatus = String(data[i][3]).toLowerCase().trim(); 
      
      if (dbId === String(idInput).toLowerCase().trim() && dbPass === String(passInput).trim()) {
        
        if (dbStatus === 'pending') { 
          return { status: 'gagal', pesan: 'Akun Anda masih menunggu persetujuan Administrator.' };
        }
        if (dbStatus === 'rejected') { 
          return { status: 'gagal', pesan: 'Akun Anda telah ditolak oleh Administrator.' };
        }
        
        // Login Sukses (Status 'Approved')
        var namaUser = data[i][1]; 
        var saldoReal = hitungSaldoRealtime(namaUser);
        return { status: 'sukses', role: 'user', nama: namaUser, saldo: formatRupiah(saldoReal) };
      }
    }
    return { status: 'gagal', pesan: 'ID atau Password salah!' };
  } catch (e) { return { status: 'error', pesan: e.toString() }; }
}

function hitungSaldoRealtime(username) {
  var totalFee = 0, totalTarik = 0;
  var totalAdjustment = 0;
  var userTarget = String(username).toLowerCase().trim();

  // Pemasukan (Fee) - Index BARU 13 
  var sheetOrder = getSheet('Pesanan');
  if (sheetOrder) {
    var dataOrder = sheetOrder.getDataRange().getValues();
    for (var i = 1; i < dataOrder.length; i++) {
      if (String(dataOrder[i][1]).toLowerCase().trim() == userTarget) {
        totalFee += parseNumber(dataOrder[i][13]); // INDEX 13
      }
    }
  }
  // Pengeluaran (Tarik)
  var sheetWD = getSheet('Penarikan');
  if (sheetWD) {
    var dataWD = sheetWD.getDataRange().getValues();
    for (var j = 1; j < dataWD.length; j++) {
      var wdUser = String(dataWD[j][1]).toLowerCase().trim();
      var status = String(dataWD[j][7]).toLowerCase().trim();
      if (wdUser === userTarget) {
        // Saldo terpotong jika status Di Proses, Disetor, atau Berhasil
        if (status.includes('proses') || status.includes('setor') || status.includes('berhasil')) {
           totalTarik += parseNumber(dataWD[j][6]);
        }
      }
    }
  }
  
  // Penyesuaian Manual
  var sheetAdj = getSheet('ManualAdjustments');
  if (sheetAdj) {
    var dataAdj = sheetAdj.getDataRange().getValues();
    for (var k = 1; k < dataAdj.length; k++) {
      // Kolom B (Index 1) = Username, Kolom C (Index 2) = Amount
      if (String(dataAdj[k][1]).toLowerCase().trim() == userTarget) {
        totalAdjustment += parseNumber(dataAdj[k][2]);
      }
    }
  }

  // Hitung Saldo Akhir
  return totalFee - totalTarik + totalAdjustment;
}

function getSaldoRealtime(username) {
  try {
    var saldo = hitungSaldoRealtime(username);
    return { status: 'sukses', saldo: formatRupiah(saldo) };
  } catch (e) {
    return { status: 'error', pesan: e.toString() };
  }
}

function parseNumber(val) {
  if (!val) return 0;
  var str = String(val).replace(/[^0-9-]/g, ""); 
  var num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function registerUser(form) {
  try {
    var sheet = getSheet('Users');
    var id = String(form.regId).trim(), nama = form.regNama.trim(), pass = form.regPass;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() == id.toLowerCase()) return { status: 'error', pesan: 'ID sudah dipakai!' };
    }
    // Tambahkan kolom Status dan Tgl Daftar
    sheet.appendRow([id, nama, pass, 'Pending', new Date()]); 
    return { status: 'sukses', pesan: 'Pendaftaran berhasil. Akun Anda akan aktif setelah disetujui Administrator.' }; 
  } catch (e) { return { status: 'error', pesan: e.toString() }; }
}

/* =========================================
   2. USER DATA FEATURES
   ========================================= */
/**
 * MODIFIKASI: Membaca 3 kolom dari sheet Master: Produk, Alamat, dan Alamat Job (Kolom C/Index 2).
 */
function getDropdownData() {
  try {
    var sheet = getSheet('Master'); 
    if (!sheet) return { produk: [], alamat: [], alamatJob: [] };
    
    // Baca 3 kolom: Kolom A (Produk), B (Alamat), C (Alamat Job)
    var data = sheet.getRange(2, 1, sheet.getLastRow()-1, 3).getValues(); // <-- Read 3 columns
    var p = [], a = [], aj = []; // aj for Alamat Job

    data.forEach(r => { 
        if(r[0]) p.push(r[0]);   // Index 0: Produk
        if(r[1]) a.push(r[1]);   // Index 1: Kode Alamat
        if(r[2]) aj.push(r[2]);  // Index 2: Alamat Job
    });
    
    return { produk: p, alamat: a, alamatJob: aj }; // Mengembalikan 3 array
  } catch (e) { 
    return { produk: [], alamat: [], alamatJob: [] }; 
  }
}

/**
 * INDEX PESANAN SUDAH DISESUAIKAN UNTUK 1 KOLOM BARU DI INDEX 6.
 */
function prosesPesanan(form) {
  try {
    var sheet = getSheet('Pesanan');
    var mode = form.modeInput, oldId = form.editId;
    var resiBaru = String(form.inResi).trim(); 
    var statusBaru = String(form.inKet).toLowerCase().trim(); 
    var hargaMaxAdmin = parseNumber(form.inHargaMaxAdmin); 
    
    // BARU: Ambil data Alamat Job
    var alamatJobBaru = form.inAlamatJob; // <-- NEW FIELD

    // Status yang dianggap final atau aktif (tidak boleh ada duplikasi resi)
    var statusDuplikasiCek = ['dalam pengiriman', 'dikirim', 'telah diterima', 'diterima'];
    
    var dataSheet = sheet.getDataRange().getValues();


    if (mode === 'edit' && oldId) {
      for (var i = 1; i < dataSheet.length; i++) {
        var existingId = String(dataSheet[i][0]);
        
        if (existingId == String(oldId)) {
          // INDEX RESI BERUBAH DARI 9 MENJADI 10
          var resiLama = String(dataSheet[i][10]).trim(); 
          
          if (resiBaru && resiBaru !== resiLama && statusDuplikasiCek.includes(statusBaru)) {
              if (checkResiDuplikat(sheet, resiBaru, existingId)) {
                  return { status: 'error', pesan: 'Gagal Update! No Resi sudah pernah digunakan di pesanan lain.' };
              }
          }
          
          // INDEX FEE BERUBAH DARI 12 MENJADI 13
          var feeLama = dataSheet[i][13]; 
          
          // Data untuk di-UPDATE (Mulai dari Kolom C/Index 2: Penerima) - total 12 kolom (2 s/d 13)
          var finalData = [
              form.inPenerima, form.inProduk, form.inJumlah, form.inAlamat, 
              alamatJobBaru,               // INDEX 6
              parseNumber(form.inHarga),   // INDEX 7
              hargaMaxAdmin,               // INDEX 8
              form.inNoPesan,              // INDEX 9
              form.inResi,                 // INDEX 10
              form.inKet,                  // INDEX 11
              form.inTgl,                  // INDEX 12
              feeLama                      // INDEX 13
          ];
          
          // Range update: Kolom C (Penerima) sampai Kolom N (Fee) = 12 kolom
          sheet.getRange(i + 1, 3, 1, 12).setValues([finalData]);
          return { status: 'sukses', pesan: 'Data diupdate!' };
        }
      }
      return { status: 'error', pesan: 'ID tidak ditemukan.' };
    } else {
      // MODE BARU (APPEND)
      if (resiBaru && statusDuplikasiCek.includes(statusBaru)) {
        if (checkResiDuplikat(sheet, resiBaru)) {
            return { status: 'error', pesan: 'Gagal Simpan! No Resi sudah pernah digunakan di pesanan lain.' };
        }
      }
      
      var id = 'ORD-' + new Date().getTime();
      
      // Data untuk di-APPEND (Kolom A s/d N)
      sheet.appendRow([
          id, 
          form.hideUser, 
          form.inPenerima, 
          form.inProduk, 
          form.inJumlah, 
          form.inAlamat, 
          alamatJobBaru,      // INDEX 6
          parseNumber(form.inHarga), // INDEX 7
          hargaMaxAdmin,      // INDEX 8
          form.inNoPesan,     // INDEX 9
          form.inResi,        // INDEX 10
          form.inKet,         // INDEX 11
          form.inTgl,         // INDEX 12
          0                   // INDEX 13
      ]); 
      return { status: 'sukses', pesan: 'Tersimpan!' };
    }
  } catch (e) { return { status: 'error', pesan: e.toString() }; }
}

/**
 * INDEX PESANAN SUDAH DISESUAIKAN UNTUK 1 KOLOM BARU DI INDEX 6.
 */
function checkResiDuplikat(sheet, resi, excludeId) {
  var data = sheet.getDataRange().getValues();
  var resiTrimmed = String(resi).trim();
  var statusDuplikasiCek = ['dalam pengiriman', 'dikirim', 'telah diterima', 'diterima'];

  for (var i = 1; i < data.length; i++) {
    var dbId = String(data[i][0]);
    // INDEX RESI BERUBAH DARI 9 MENJADI 10
    var dbResi = String(data[i][10]).trim(); 
    // INDEX KETERANGAN/STATUS BERUBAH DARI 10 MENJADI 11
    var dbStatus = String(data[i][11]).toLowerCase().trim(); 

    if (excludeId && dbId === excludeId) continue;

    if (dbResi === resiTrimmed && statusDuplikasiCek.includes(dbStatus)) {
      return true; 
    }
  }
  return false; 
}

/**
 * INDEX PESANAN SUDAH DISESUAIKAN UNTUK 1 KOLOM BARU DI INDEX 6.
 */
function getPesananUser(username) {
  try {
    var sheet = getSheet('Pesanan'); if(!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var hasil = [];
    var target = String(username).toLowerCase().trim();
    var fmt = d => { try { return new Date(d).toISOString().split('T')[0]; } catch(e){ return d;} };
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]).toLowerCase().trim() == target) {
        // PENTING: SEMUA INDEX SETELAH ALAMAT (Index 5) BERUBAH
        hasil.push({
          id: data[i][0], 
          username: data[i][1], 
          penerima: data[i][2], 
          produk: data[i][3],
          jumlah: data[i][4], 
          alamat: data[i][5], 
          alamatJob: data[i][6], // INDEX BARU 6
          harga: formatRupiah(data[i][7]), // Index 7 (Harga Yang Didapat)
          hargaMaxAdmin: formatRupiah(data[i][8]||0), // Index 8 (Harga Max Admin)
          noPesan: data[i][9],  // Index 9
          resi: data[i][10],     // Index 10
          ket: data[i][11],     // Index 11
          tgl: fmt(data[i][12]), // Index 12
          fee: formatRupiah(data[i][13]||0) // Index 13
        });
      }
    }
    return hasil.reverse();
  } catch (e) { return []; }
}

/**
 * INDEX PESANAN SUDAH DISESUAIKAN UNTUK 1 KOLOM BARU DI INDEX 6.
 */
function getFeeUser(username) {
  try {
    var sheet = getSheet('Pesanan'); if(!sheet) return [];
    var data = sheet.getDataRange().getValues(); var hasil = [];
    var target = String(username).toLowerCase().trim();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]).toLowerCase().trim() == target) {
        // INDEX KOLOM FEE BERUBAH DARI 12 MENJADI 13
        var fee = parseNumber(data[i][13]); 
        hasil.push({ 
            penerima: data[i][2], 
            produk: data[i][3], 
            alamat: data[i][5], 
            noPesan: data[i][9], // Index 9
            fee: formatRupiah(fee) 
        });
      }
    }
    return hasil.reverse();
  } catch (e) { return []; }
}

function getRiwayatTarik(username) {
  try {
    var sheet = getSheet('Penarikan'); if(!sheet) return [];
    var data = sheet.getDataRange().getValues(); var hasil = [];
    var target = String(username).toLowerCase().trim();
    var fmt = d => { try { return new Date(d).toISOString().split('T')[0]; } catch(e){ return "Baru";} };
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]).toLowerCase().trim() == target) {
        hasil.push({ 
          tgl: fmt(data[i][2]), 
          noRek: data[i][3], 
          pemilik: data[i][4], 
          bank: data[i][5], 
          nominal: formatRupiah(data[i][6]), 
          status: data[i][7] 
        });
      }
    }
    return hasil.reverse();
  } catch (e) { return []; }
}

function simpanPenarikan(form) {
  try {
    // Pengecekan Status Global
    var wdStatus = getWithdrawStatus();
    if (wdStatus.status === 'sukses' && !wdStatus.aktif) {
      return { status: 'error', pesan: 'Fitur penarikan sedang dinonaktifkan oleh Administrator.' };
    }
    
    var sheet = getSheet('Penarikan');
    var id = 'WD-' + new Date().getTime();
    var user = form.hideUserTarik;
    var minta = parseNumber(form.tarikNominal);
    
    var saldoNow = hitungSaldoRealtime(user);
    if (saldoNow < minta) {
       return { status: 'error', pesan: 'Saldo tidak cukup! Sisa: ' + formatRupiah(saldoNow) };
    }
    
    // Simpan No Rekening (Col D), Nama Pemilik (Col E), Bank (Col F)
    sheet.appendRow([id, user, new Date(), form.tarikNoRek, form.tarikPemilik, form.tarikBank, minta, 'Di Proses']);
    return { status: 'sukses', pesan: 'Permintaan dikirim!' };
  } catch (e) { return { status: 'error', pesan: e.toString() }; }
}

function hapusPesanan(id) {
  try {
    var s = getSheet('Pesanan'); var d = s.getDataRange().getValues();
    for(var i=1; i<d.length; i++){ 
      if(String(d[i][0])==String(id)){ 
        s.deleteRow(i+1); 
        return{status:'sukses',pesan:'Dihapus'}; 
      } 
    }
    return {status:'error'};
  } catch(e){return{status:'error',pesan:e.toString()};}
}

/* =========================================
   3. ADMIN FEATURES (STATS & LOGIC)
   ========================================= */

// FUNGSI UNTUK MENGHITUNG STATUS PESANAN
/**
 * INDEX PESANAN SUDAH DISESUAIKAN UNTUK 1 KOLOM BARU DI INDEX 6.
 */
function getAdminOrderStatusCounts() {
  try {
    var sheet = getSheet('Pesanan');
    if (!sheet || sheet.getLastRow() < 2) {
      return { status: 'sukses', counts: { total: 0, dikirim: 0, diterima: 0, dibatalkan: 0 } };
    }
    
    var data = sheet.getDataRange().getValues();
    
    var counts = {
      total: data.length - 1, 
      dikirim: 0,
      diterima: 0,
      dibatalkan: 0
    };

    // Iterasi data, mulai dari baris ke-2 (skip header)
    for (var i = 1; i < data.length; i++) {
      // INDEX KOLOM KETERANGAN/STATUS BERUBAH DARI 10 MENJADI 11
      var status = String(data[i][11]).toLowerCase().trim(); 

      if (status === 'dalam pengiriman' || status === 'dikirim') { 
        counts.dikirim++;
      } else if (status === 'telah diterima' || status === 'diterima') { 
        counts.diterima++;
      } else if (status.includes('batal') || status.includes('tolak') || status.includes('gagal')) {
        counts.dibatalkan++;
      }
    }
    
    return { status: 'sukses', counts: counts };
    
  } catch (e) {
    return { status: 'error', pesan: 'Gagal menghitung status pesanan: ' + e.toString() };
  }
}

function getAdminStatistics() {
  try {
    var totalSaldo = 0, pendingWD = 0, totalOrder = 0, totalUser = 0;
    
    var wdCounts = {
        diproses: 0,
        disetor: 0,
        berhasil: 0,
        ditolak: 0,
        total: 0
    };

    // 1. User Stats
    var sUser = getSheet('Users');
    if(sUser) {
      var dUser = sUser.getDataRange().getValues();
      totalUser = dUser.length - 1;
      for(var i=1; i<dUser.length; i++) totalSaldo += hitungSaldoRealtime(dUser[i][1]);
    }
    
    // 2. WD Stats
    var sWD = getSheet('Penarikan');
    if(sWD) {
      var dWD = sWD.getDataRange().getValues();
      wdCounts.total = dWD.length - 1;

      for(var i=1; i<dWD.length; i++) {
          var status = String(dWD[i][7]).toLowerCase().trim();

          if (status.includes('proses')) {
              wdCounts.diproses++;
              // pendingWD dihitung dari nominal, bukan jumlah item
              pendingWD += parseNumber(dWD[i][6]); 
          } else if (status.includes('setor')) {
              wdCounts.disetor++;
          } else if (status.includes('berhasil')) {
              wdCounts.berhasil++;
          } else if (status.includes('ditolak') || status.includes('batal')) {
              wdCounts.ditolak++;
          }
      }
    }
    
    // 3. Order Stats 
    var orderCounts = getAdminOrderStatusCounts();
    if (orderCounts.status === 'sukses') {
        totalOrder = orderCounts.counts.total;
    }

    return { 
        users: totalUser, 
        saldo: formatRupiah(totalSaldo), 
        pending: formatRupiah(pendingWD), 
        orders: totalOrder,
        orderBreakdown: orderCounts.counts,
        wdBreakdown: wdCounts 
    };
  } catch(e) { return { users:0, saldo:0, pending:0, orders:0, orderBreakdown:{}, wdBreakdown:{} }; }
}

/**
 * INDEX PESANAN SUDAH DISESUAIKAN UNTUK 1 KOLOM BARU DI INDEX 6.
 */
function adminGetData(type) {
  try {
    var sheet, data, hasil = [];
    var fmtDate = d => { try { return new Date(d).toISOString().split('T')[0]; } catch(e){ return "";} };

    if (type === 'withdraw') {
      sheet = getSheet('Penarikan'); data = sheet.getDataRange().getValues();
      for(var i=1; i<data.length; i++) {
        hasil.push({
          id: data[i][0], username: data[i][1], tgl: fmtDate(data[i][2]),
          noRek: data[i][3], pemilik: data[i][4], bank: data[i][5],
          nominal: data[i][6], nominalFmt: formatRupiah(data[i][6]), status: data[i][7] 
        });
      }
    } else if (type === 'orders') {
      sheet = getSheet('Pesanan'); data = sheet.getDataRange().getValues();
      for(var i=1; i<data.length; i++) {
        // PENTING: SEMUA INDEX SETELAH ALAMAT (Index 5) BERUBAH
        hasil.push({ 
          id: data[i][0], 
          username: data[i][1], 
          penerima: data[i][2], 
          produk: data[i][3], 
          jumlah: data[i][4], 
          alamat: data[i][5], 
          alamatJob: data[i][6], // INDEX BARU 6
          harga: formatRupiah(data[i][7]), // Index 7
          hargaMaxAdmin: formatRupiah(data[i][8]||0), // Index 8
          noPesan: data[i][9],  // Index 9
          resi: data[i][10],     // Index 10
          ket: data[i][11],     // Index 11
          tgl: fmtDate(data[i][12]), // Index 12
          fee: parseNumber(data[i][13]), // Index 13
          feeFmt: formatRupiah(data[i][13]||0) // Index 13
        });
      }
    } else if (type === 'users') {
      sheet = getSheet('Users'); data = sheet.getDataRange().getValues();
      var fmt = d => { try { return new Date(d).toISOString().split('T')[0]; } catch(e){ return "";} };
      for(var i=1; i<data.length; i++) {
        var s = hitungSaldoRealtime(data[i][1]);
        hasil.push({ 
            id:data[i][0], 
            nama:data[i][1], 
            saldo:formatRupiah(s),
            status: data[i][3] || 'Pending', 
            tglDaftar: fmt(data[i][4]) 
        });
      }
    }
    return hasil.reverse();
  } catch (e) { return []; }
}

function adminUpdateStatusWD(idWd, statusBaru) {
  try {
    var sheet = getSheet('Penarikan'); var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) == String(idWd)) {
        sheet.getRange(i + 1, 8).setValue(statusBaru); 
        return { status: 'sukses', pesan: 'Status: ' + statusBaru };
      }
    }
    return { status: 'error', pesan: 'ID tidak ditemukan' };
  } catch (e) { return { status: 'error', pesan: e.toString() }; }
}

/**
 * INDEX PESANAN SUDAH DISESUAIKAN UNTUK 1 KOLOM BARU DI INDEX 6.
 */
function adminUpdateFee(idOrder, nominal) {
  try {
    var sheet = getSheet('Pesanan'); var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) == String(idOrder)) {
        var feeAngka = parseNumber(nominal);
        // INDEX KOLOM FEE BERUBAH DARI 12 MENJADI 13 (Kolom N)
        sheet.getRange(i + 1, 14).setValue(feeAngka); // Kolom 14 = N
        return { status: 'sukses', pesan: 'Bonus dikirim!', fee: formatRupiah(feeAngka) };
      }
    }
    return { status: 'error', pesan: 'Order tidak ditemukan' };
  } catch (e) { return { status: 'error', pesan: e.toString() }; }
}

function adminDeleteUser(idUser) {
  try {
    var sheet = getSheet('Users');
    var data = sheet.getDataRange().getValues();
    for(var i=1; i<data.length; i++){ 
      if(String(data[i][0])==String(idUser)){ 
        sheet.deleteRow(i+1); 
        return {status:'sukses',pesan:'Pengguna dihapus'}; 
      } 
    }
    return {status:'error', pesan:'ID pengguna tidak ditemukan'};
  } catch(e){ return{status:'error',pesan:e.toString()}; }
}

function adminAdjustUserBalance(username, nominal, notes) {
  try {
    var ss = SpreadsheetApp.openById("1pCatbrQlgN-FU_zXvYYDMCCRqay2tEXYxvHwqxtM_O4");
    var sheet = ss.getSheetByName('ManualAdjustments');
    
    // Jika sheet belum ada, buat sheet baru
    if (!sheet) {
      sheet = ss.insertSheet('ManualAdjustments');
      sheet.getRange(1,1,1,4).setValues([['Timestamp', 'Username', 'Amount', 'Notes']]);
    }

    var amount = parseNumber(nominal);
    // Kolom A: Timestamp, Kolom B: Username, Kolom C: Amount, Kolom D: Notes
    sheet.appendRow([new Date(), username, amount, notes || 'Penyesuaian Saldo Admin']);

    var newSaldo = hitungSaldoRealtime(username);

    return { status: 'sukses', pesan: `Saldo ${username} berhasil disesuaikan. Saldo baru: ${formatRupiah(newSaldo)}` };

  } catch (e) {
    return { status: 'error', pesan: e.toString() };
  }
}

function adminSetUserStatus(id, statusBaru) {
  try {
    var sheet = getSheet('Users');
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) == String(id)) {
        // Kolom D (Index 3) adalah Status
        sheet.getRange(i + 1, 4).setValue(statusBaru); 
        return { status: 'sukses', pesan: `Status pengguna ${data[i][1]} diubah menjadi ${statusBaru}` };
      }
    }
    return { status: 'error', pesan: 'ID pengguna tidak ditemukan' };
  } catch (e) {
    return { status: 'error', pesan: e.toString() };
  }
}


/* =========================================
   4. USER PROFILE MANAGEMENT
   ========================================= */

function updateUserPassword(username, newPass) {
  try {
    var sheet = getSheet('Users');
    var data = sheet.getDataRange().getValues();
    // Cari berdasarkan Nama User (Kolom B / Index 1)
    var target = String(username).toLowerCase().trim();
    
    for (var i = 1; i < data.length; i++) {
      var dbNama = String(data[i][1]).toLowerCase().trim(); 
      if (dbNama === target) {
        // Kolom C (Index 2) adalah Password
        sheet.getRange(i + 1, 3).setValue(newPass.trim());
        return { status: 'sukses', pesan: 'Password berhasil diubah!' };
      }
    }
    return { status: 'error', pesan: 'Pengguna tidak ditemukan.' };
  } catch (e) {
    return { status: 'error', pesan: e.toString() };
  }
}

/**
 * MODIFIKASI: Menghapus Alamat Default
 */
function getUserProfileDetails(username) { 
  try {
    var props = PropertiesService.getUserProperties();
    var prefix = String(username).toLowerCase().trim() + '_';
    
    var bank = props.getProperty(prefix + 'bank') || '';
    var noRek = props.getProperty(prefix + 'noRek') || '';
    var pemilik = props.getProperty(prefix + 'pemilik') || '';
    // defaultAddress telah dihapus
    
    return { status: 'sukses', bank: bank, noRek: noRek, pemilik: pemilik }; // <-- MODIFIKASI RETURN
  } catch (e) {
    return { status: 'error', pesan: e.toString() };
  }
}

/**
 * MODIFIKASI: Menghapus penyimpanan Alamat Default
 */
function saveUserProfileDetails(form) { 
  try {
    var props = PropertiesService.getUserProperties();
    var username = String(form.profUser).toLowerCase().trim();
    var prefix = username + '_';
    
    props.setProperty(prefix + 'bank', form.profBank);
    props.setProperty(prefix + 'noRek', form.profNoRek);
    props.setProperty(prefix + 'pemilik', form.profPemilik);
    // Penyimpanan profDefaultAddress telah dihapus
    
    return { status: 'sukses', pesan: 'Detail Profil berhasil disimpan!' }; // <-- MODIFIKASI PESAN
  } catch (e) {
    return { status: 'error', pesan: e.toString() };
  }
}


/* =========================================
   5. GLOBAL WITHDRAW CONTROL (PROPERTIES SERVICE)
   ========================================= */

function getWithdrawStatus() {
  try {
    var props = PropertiesService.getScriptProperties();
    // Default-nya aktif jika belum pernah diatur
    var status = props.getProperty('TarikAktif') || 'true'; 
    return { status: 'sukses', aktif: (status === 'true') };
  } catch (e) {
    return { status: 'error', pesan: e.toString() };
  }
}

function toggleWithdrawStatus(aktif) {
  try {
    var props = PropertiesService.getScriptProperties();
    var status = aktif ? 'true' : 'false';
    props.setProperty('TarikAktif', status);
    return { status: 'sukses', aktif: aktif, pesan: 'Status penarikan berhasil diubah menjadi: ' + (aktif ? 'AKTIF' : 'NONAKTIF') };
  } catch (e) {
    return { status: 'error', pesan: e.toString() };
  }
}

function formatRupiah(angka) { 
  try { 
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka); 
  } catch (e) { 
    return "Rp " + angka; 
  } 
}
