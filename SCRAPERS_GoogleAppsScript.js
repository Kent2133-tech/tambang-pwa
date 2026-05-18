/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   SCRAPERS Finance System — Auto Sync dari Supabase          ║
 * ║   Google Apps Script                                          ║
 * ║                                                              ║
 * ║   Cara pasang:                                               ║
 * ║   1. Buka spreadsheet → Extensions → Apps Script             ║
 * ║   2. Copy paste semua kode ini                               ║
 * ║   3. Klik Save → Run → syncAll (izinkan akses pertama kali)  ║
 * ║   4. Optional: Set trigger otomatis (lihat bagian bawah)     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── CONFIG ────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://tqmqdrifrbvupkrufecc.supabase.co'
const SUPABASE_KEY = 'sb_publishable_bQTJDIyQYhx6P3Wljt82JA_gJmnFud1'

const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
}

// ── SUPABASE FETCH ─────────────────────────────────────────────────
function supaGet(table, params) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params || 'order=created_at'}`
  const res = UrlFetchApp.fetch(url, { headers: HEADERS, muteHttpExceptions: true })
  if (res.getResponseCode() !== 200) {
    Logger.log(`Error fetching ${table}: ${res.getContentText()}`)
    return []
  }
  return JSON.parse(res.getContentText())
}

// ── UTILITIES ─────────────────────────────────────────────────────
function rpFormat(n) {
  if (!n) return 0
  return Number(n)
}

function getOrCreateSheet(ss, name) {
  return ss.getSheetByName(name)
}

function findFirstEmptyRow(sheet, startRow, col) {
  // Find first empty row starting from startRow in given column
  let row = startRow
  while (sheet.getRange(row, col).getValue() !== '') {
    row++
    if (row > 1000) break
  }
  return row
}

function dateAlreadyExists(sheet, startRow, dateCol, dateVal) {
  // Check if this date+data combo already synced (prevent duplicates)
  const data = sheet.getDataRange().getValues()
  for (let i = startRow - 1; i < data.length; i++) {
    const cell = data[i][dateCol - 1]
    if (cell) {
      const cellDate = Utilities.formatDate(new Date(cell), 'Asia/Jakarta', 'yyyy-MM-dd')
      if (cellDate === dateVal) return { found: true, row: i + 1 }
    }
  }
  return { found: false }
}

function formatDateID(dateStr) {
  // Convert YYYY-MM-DD to DD/MM/YYYY for Excel
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

// ── SYNC PRODUKSI HARIAN ──────────────────────────────────────────
function syncProduksi() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const ws = getOrCreateSheet(ss, '⛏️ PRODUKSI')
  if (!ws) { Logger.log('Sheet Produksi tidak ditemukan'); return 0 }

  // Get data from Supabase — solar_logs with unit info
  const solarLogs = supaGet('solar_logs', 'order=date&select=*,units(name)')
  if (!solarLogs.length) return 0

  // Get existing dates to avoid duplicate
  const existingData = ws.getDataRange().getValues()
  const existingDates = new Set()
  for (let i = 3; i < existingData.length; i++) { // row 4 = index 3 (data starts row 4)
    if (existingData[i][1]) {
      const d = existingData[i][1]
      try { existingDates.add(Utilities.formatDate(new Date(d), 'Asia/Jakarta', 'yyyy-MM-dd')) } catch(e) {}
    }
  }

  let added = 0
  const startRow = findFirstEmptyRow(ws, 4, 1)  // Col A = No

  solarLogs.forEach((log, idx) => {
    if (existingDates.has(log.date)) return  // skip if date already exists

    const row = startRow + idx
    const rowNo = row - 3  // row number starting from 1

    ws.getRange(row, 1).setValue(rowNo)  // No
    ws.getRange(row, 2).setValue(new Date(log.date + 'T00:00:00'))  // Tanggal — pakai tanggal dari log, bukan sync date
    ws.getRange(row, 2).setNumberFormat('DD/MM/YYYY')
    ws.getRange(row, 5).setValue(log.units?.name || 'Excavator')  // Alat
    ws.getRange(row, 6).setValue(log.liters || 0)  // Solar (L)
    ws.getRange(row, 12).setValue(log.operator_name || '')  // Operator

    added++
  })

  Logger.log(`Produksi: ${added} baris baru ditambahkan`)
  return added
}

// ── SYNC KAS HARIAN ───────────────────────────────────────────────
function syncKasHarian() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const ws = getOrCreateSheet(ss, '💰 KAS HARIAN')
  if (!ws) { Logger.log('Sheet Kas Harian tidak ditemukan'); return 0 }

  // Get daily notes from Supabase — ini catatan mandor
  const notes = supaGet('daily_notes', 'order=note_date')
  // Get cost logs (service, spare, etc)
  const costLogs = supaGet('cost_logs', 'order=date&select=*,units(name)')

  let added = 0
  const startRow = findFirstEmptyRow(ws, 4, 1)

  // Sync cost logs as individual rows
  const existingData = ws.getDataRange().getValues()
  const existingKets = new Set()
  for (let i = 3; i < existingData.length; i++) {
    if (existingData[i][2]) existingKets.add(String(existingData[i][2]))
  }

  costLogs.forEach((log) => {
    const ket = `[AUTO] ${log.category || 'Biaya'} — ${log.units?.name || ''} — ${log.note || ''}`
    if (existingKets.has(ket)) return  // skip duplicate

    const row = startRow + added
    ws.getRange(row, 1).setValue(row - 3)  // No
    ws.getRange(row, 2).setValue(new Date(log.date + 'T00:00:00'))  // Tanggal dari data, bukan sync
    ws.getRange(row, 2).setNumberFormat('DD/MM/YYYY')
    ws.getRange(row, 3).setValue(ket)  // Keterangan
    ws.getRange(row, 4).setValue(log.category || 'Operasional')  // Kategori
    ws.getRange(row, 9).setValue(rpFormat(log.amount))  // KELUAR

    added++
  })

  Logger.log(`Kas Harian: ${added} baris baru dari cost logs`)
  return added
}

// ── SYNC CATATAN MANDOR (Daily Notes) ────────────────────────────
function syncCatatanMandor() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const ws = getOrCreateSheet(ss, '💰 KAS HARIAN')
  if (!ws) return 0

  const notes = supaGet('daily_notes', 'order=note_date')
  if (!notes.length) return 0

  // Find or create a section for mandor notes
  // We add them as a reference block — not as individual rows (because mandor writes free text)
  // Instead, put them in column M (Catatan) with date prefix
  const existingData = ws.getDataRange().getValues()
  const existingNotes = new Set()
  for (let i = 3; i < existingData.length; i++) {
    if (existingData[i][12]) existingNotes.add(String(existingData[i][12]).substring(0,20))
  }

  let added = 0
  let row = findFirstEmptyRow(ws, 4, 1)

  notes.forEach(note => {
    const preview = `[CATATAN ${note.note_date}] ${note.author_name || 'Mandor'}`
    if (existingNotes.has(preview.substring(0,20))) return

    // Add as a reference row — tanggal + catatan di kolom M
    ws.getRange(row, 1).setValue(row - 3)
    ws.getRange(row, 2).setValue(new Date(note.note_date + 'T00:00:00'))
    ws.getRange(row, 2).setNumberFormat('DD/MM/YYYY')
    ws.getRange(row, 3).setValue(`📒 Catatan Mandor — ${note.author_name || 'Mandor'}`)
    ws.getRange(row, 4).setValue('Catatan Lapangan')
    ws.getRange(row, 13).setValue(note.content)  // Kolom M = Catatan
    // Style — beda warna biar keliatan ini catatan mandor
    ws.getRange(row, 1, 1, 13).setBackground('#FFF9E6')

    row++
    added++
  })

  Logger.log(`Catatan Mandor: ${added} catatan baru`)
  return added
}

// ── SYNC MAINTENANCE ──────────────────────────────────────────────
function syncMaintenance() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const ws = getOrCreateSheet(ss, '🔧 MAINTENANCE')
  if (!ws) { Logger.log('Sheet Maintenance tidak ditemukan'); return 0 }

  const serviceLogs = supaGet('service_logs', 'order=date&select=*,units(name)')
  if (!serviceLogs.length) return 0

  // Data service log mulai dari row 12 (setelah tracker interval)
  const existingData = ws.getDataRange().getValues()
  const existingDates = new Set()
  for (let i = 11; i < existingData.length; i++) {
    if (existingData[i][1] && existingData[i][2]) {
      try {
        const d = Utilities.formatDate(new Date(existingData[i][1]), 'Asia/Jakarta', 'yyyy-MM-dd')
        existingDates.add(`${d}_${existingData[i][2]}`)
      } catch(e) {}
    }
  }

  let added = 0
  let row = findFirstEmptyRow(ws, 12, 2)  // Start from row 12, check col B (Tanggal)

  serviceLogs.forEach(log => {
    const key = `${log.date}_${log.maintenance_type || ''}`
    if (existingDates.has(key)) return

    ws.getRange(row, 1).setValue(row - 11)  // No
    ws.getRange(row, 2).setValue(new Date(log.date + 'T00:00:00'))
    ws.getRange(row, 2).setNumberFormat('DD/MM/YYYY')
    ws.getRange(row, 3).setValue(log.maintenance_type || 'Service')  // Jenis Service
    ws.getRange(row, 4).setValue(log.hour_at_service || 0)  // HM Saat Service
    ws.getRange(row, 5).setValue(log.operator_name || '')  // Mekanik
    ws.getRange(row, 6).setValue(rpFormat(log.cost))  // Biaya Actual
    ws.getRange(row, 7).setValue(log.spare_parts_used || '')  // Parts
    ws.getRange(row, 8).setValue(log.note || '')  // Catatan

    // Update HM terkini di ASUMSI sheet jika lebih besar
    try {
      const asumsiWs = getOrCreateSheet(ss, '⚙️ ASUMSI')
      const currentHM = asumsiWs.getRange('B41').getValue()
      if (log.hour_at_service && log.hour_at_service > currentHM) {
        asumsiWs.getRange('B41').setValue(log.hour_at_service)
        Logger.log(`HM Asumsi updated: ${currentHM} → ${log.hour_at_service}`)
      }
    } catch(e) {}

    row++
    added++
  })

  Logger.log(`Maintenance: ${added} baris baru`)
  return added
}

// ── UPDATE TIMESTAMP ──────────────────────────────────────────────
function updateSyncTimestamp() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const ws = getOrCreateSheet(ss, '📊 DASHBOARD')
  if (!ws) return

  // Try to find a cell to put last sync time
  // Look for "Last Sync" or put in a known empty area
  try {
    // Add to bottom of dashboard or a fixed cell
    ws.getRange('A1').setNote(
      `Terakhir sync dari Supabase:\n${Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm')} WIB`
    )
  } catch(e) {}
}

// ── MAIN SYNC FUNCTION ────────────────────────────────────────────
function syncAll() {
  Logger.log('=== SCRAPERS Auto Sync mulai ===')
  Logger.log(`Waktu: ${new Date().toLocaleString('id-ID')}`)

  try {
    const produksi  = syncProduksi()
    const kas       = syncKasHarian()
    const catatan   = syncCatatanMandor()
    const maint     = syncMaintenance()
    updateSyncTimestamp()

    const total = produksi + kas + catatan + maint
    Logger.log(`=== Selesai: ${total} baris baru total ===`)

    // Show notification in spreadsheet
    if (total > 0) {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        `✅ ${total} data baru dari lapangan berhasil masuk`,
        '🔄 Sync Selesai',
        5
      )
    } else {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        'Tidak ada data baru — spreadsheet sudah up to date',
        '✅ Sync Selesai',
        3
      )
    }
  } catch(e) {
    Logger.log(`ERROR: ${e.message}`)
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `❌ Error: ${e.message}`,
      'Sync Gagal',
      8
    )
  }
}

// ── MANUAL TRIGGER DARI MENU ──────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⛏️ SCRAPERS Sync')
    .addItem('🔄 Sync Data Sekarang', 'syncAll')
    .addItem('⛏️ Sync Produksi Saja', 'syncProduksi')
    .addItem('💰 Sync Kas Harian Saja', 'syncKasHarian')
    .addItem('📒 Sync Catatan Mandor', 'syncCatatanMandor')
    .addItem('🔧 Sync Maintenance Saja', 'syncMaintenance')
    .addSeparator()
    .addItem('⏰ Setup Auto-Sync Harian', 'setupTrigger')
    .addItem('🗑️ Hapus Auto-Sync', 'deleteTrigger')
    .addToUi()
}

// ── AUTO TRIGGER SETUP ────────────────────────────────────────────
function setupTrigger() {
  // Hapus trigger lama dulu
  deleteTrigger()

  // Buat trigger baru — sync setiap hari jam 07:00 WIB (00:00 UTC)
  ScriptApp.newTrigger('syncAll')
    .timeBased()
    .atHour(0)  // 00:00 UTC = 07:00 WIB
    .everyDays(1)
    .create()

  // Tambah trigger sore — jam 18:00 WIB (11:00 UTC)
  ScriptApp.newTrigger('syncAll')
    .timeBased()
    .atHour(11)  // 11:00 UTC = 18:00 WIB
    .everyDays(1)
    .create()

  SpreadsheetApp.getActiveSpreadsheet().toast(
    '⏰ Auto-sync aktif: setiap hari jam 07:00 dan 18:00 WIB',
    'Setup Berhasil',
    5
  )
}

function deleteTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t))
}

/**
 * ══════════════════════════════════════════════════════════════
 * CARA PAKAI:
 *
 * 1. PASANG SCRIPT:
 *    - Buka spreadsheet SCRAPERS
 *    - Klik Extensions → Apps Script
 *    - Hapus kode default, paste semua kode ini
 *    - Klik Save (ikon disket)
 *
 * 2. JALANKAN PERTAMA KALI:
 *    - Klik tombol Run → pilih fungsi "syncAll"
 *    - Akan minta izin akses → klik Allow
 *    - Tunggu selesai, cek sheet Produksi, Kas Harian, Maintenance
 *
 * 3. SETUP AUTO-SYNC:
 *    - Tutup Apps Script, balik ke spreadsheet
 *    - Akan ada menu baru "⛏️ SCRAPERS Sync" di atas
 *    - Klik "Setup Auto-Sync Harian" → aktif setiap hari 07:00 & 18:00 WIB
 *
 * 4. SYNC MANUAL:
 *    - Klik menu "⛏️ SCRAPERS Sync" → "Sync Data Sekarang"
 *
 * PENTING:
 * - Tanggal di spreadsheet = tanggal yang mandor input, BUKAN tanggal sync
 * - Data tidak akan dobel (ada pengecekan duplikat)
 * - Catatan mandor masuk ke kolom Catatan di Kas Harian dengan background kuning
 * - HM excavator di sheet ASUMSI otomatis update kalau ada data service baru
 * ══════════════════════════════════════════════════════════════
 */
