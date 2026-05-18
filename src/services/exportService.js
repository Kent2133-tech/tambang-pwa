import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import { SvcService, SolarService, InspService, StockService, CostService, UnitService, RitaseService } from './dataServices'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const rp = n => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`
const today = () => dayjs().format('DD-MM-YYYY')

function autoWidth(ws, data) {
  const cols = Object.keys(data[0] || {})
  ws['!cols'] = cols.map(key => ({
    wch: Math.max(key.length, ...data.map(r => String(r[key] || '').length)) + 2
  }))
}

export async function exportServiceLog(dateFrom, dateTo) {
  const all = await SvcService.getAll()
  const units = await UnitService.getAll()
  const unitMap = Object.fromEntries(units.map(u => [u.lid, u.name]))
  const filtered = all.filter(l => (!dateFrom || l.date >= dateFrom) && (!dateTo || l.date <= dateTo))

  const data = filtered.map((l, i) => ({
    'No': i + 1,
    'Tanggal': l.date,
    'Unit': unitMap[l.unit_lid] || '-',
    'Tipe Maintenance': l.maintenanceType,
    'Jam Meter': l.hourAtService || 0,
    'Biaya (Rp)': l.cost || 0,
    'Downtime (jam)': l.downtimeHours || 0,
    'Spare Part': l.sparePartsUsed || '-',
    'Operator': l.operatorName || '-',
    'Catatan': l.note || '-',
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  autoWidth(ws, data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Service Log')
  XLSX.writeFile(wb, `service_log_${today()}.xlsx`)
}

export async function exportSolarLog(dateFrom, dateTo) {
  const all = await SolarService.getAll()
  const units = await UnitService.getAll()
  const unitMap = Object.fromEntries(units.map(u => [u.lid, u.name]))
  const filtered = all.filter(l => (!dateFrom || l.date >= dateFrom) && (!dateTo || l.date <= dateTo))

  const data = filtered.map((l, i) => ({
    'No': i + 1,
    'Tanggal': l.date,
    'Unit': unitMap[l.unit_lid] || '-',
    'Liter': l.liters || 0,
    'Harga/Liter (Rp)': l.pricePerLiter || 0,
    'Total (Rp)': (l.liters || 0) * (l.pricePerLiter || 0),
    'Operator': l.operatorName || '-',
    'Catatan': l.note || '-',
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  autoWidth(ws, data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Solar Log')
  XLSX.writeFile(wb, `solar_log_${today()}.xlsx`)
}

export async function exportInspeksiLog(dateFrom, dateTo) {
  const all = await InspService.getAll()
  const units = await UnitService.getAll()
  const unitMap = Object.fromEntries(units.map(u => [u.lid, u.name]))
  const filtered = all.filter(l => (!dateFrom || l.date >= dateFrom) && (!dateTo || l.date <= dateTo))

  const data = filtered.map((l, i) => ({
    'No': i + 1,
    'Tanggal': l.date,
    'Unit': unitMap[l.unit_lid] || '-',
    'Jam Meter': l.hourAtInspection || 0,
    'Hasil': l.overallResult || '-',
    'Teknisi': l.inspectorName || '-',
    'Catatan': l.note || '-',
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  autoWidth(ws, data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Inspeksi Log')
  XLSX.writeFile(wb, `inspeksi_log_${today()}.xlsx`)
}

export async function exportRingkasanBulanan(year, month) {
  const units = await UnitService.getAll()
  const svcs = await SvcService.getByMonth(year, month)
  const solar = await SolarService.getByMonth(year, month)
  const costs = await CostService.getByMonth(year, month)
  const stock = await StockService.getAll()
  const unitMap = Object.fromEntries(units.map(u => [u.lid, u.name]))

  const wb = XLSX.utils.book_new()
  const monthLabel = dayjs(`${year}-${String(month).padStart(2,'0')}-01`).format('MMMM YYYY')

  // Sheet 1 — Ringkasan
  const totalSolarLiter = solar.reduce((a, s) => a + (s.liters || 0), 0)
  const totalSolarRp = solar.reduce((a, s) => a + (s.liters || 0) * (s.pricePerLiter || 0), 0)
  const totalService = svcs.reduce((a, s) => a + (s.cost || 0), 0)
  const totalBiaya = costs.reduce((a, c) => a + (c.amount || 0), 0)

  const summary = [
    { 'Uraian': 'Bulan', 'Nilai': monthLabel },
    { 'Uraian': 'Total Solar (liter)', 'Nilai': totalSolarLiter },
    { 'Uraian': 'Total Biaya Solar (Rp)', 'Nilai': totalSolarRp },
    { 'Uraian': 'Jumlah Service', 'Nilai': svcs.length },
    { 'Uraian': 'Total Biaya Service (Rp)', 'Nilai': totalService },
    { 'Uraian': 'Total Biaya Lain (Rp)', 'Nilai': totalBiaya },
    { 'Uraian': 'GRAND TOTAL BIAYA (Rp)', 'Nilai': totalSolarRp + totalService + totalBiaya },
  ]
  const ws1 = XLSX.utils.json_to_sheet(summary)
  XLSX.utils.book_append_sheet(wb, ws1, 'Ringkasan')

  // Sheet 2 — Service
  const svcData = svcs.map((l, i) => ({
    'No': i + 1, 'Tanggal': l.date, 'Unit': unitMap[l.unit_lid] || '-',
    'Tipe': l.maintenanceType, 'Biaya': l.cost || 0,
    'Downtime': l.downtimeHours || 0, 'Operator': l.operatorName || '-'
  }))
  const ws2 = XLSX.utils.json_to_sheet(svcData)
  autoWidth(ws2, svcData)
  XLSX.utils.book_append_sheet(wb, ws2, 'Service')

  // Sheet 3 — Solar
  const solarData = solar.map((l, i) => ({
    'No': i + 1, 'Tanggal': l.date, 'Unit': unitMap[l.unit_lid] || '-',
    'Liter': l.liters || 0, 'Harga/L': l.pricePerLiter || 0,
    'Total': (l.liters || 0) * (l.pricePerLiter || 0), 'Operator': l.operatorName || '-'
  }))
  const ws3 = XLSX.utils.json_to_sheet(solarData)
  autoWidth(ws3, solarData)
  XLSX.utils.book_append_sheet(wb, ws3, 'Solar')

  // Sheet 4 — Stok Spare
  const stockData = stock.map((s, i) => ({
    'No': i + 1, 'Nama': s.name, 'Qty': s.qty, 'Satuan': s.unit || 'pcs',
    'Status': s.qty < 3 ? '🔴 Kritis' : s.qty < 5 ? '⚠️ Menipis' : '✅ Aman'
  }))
  const ws4 = XLSX.utils.json_to_sheet(stockData)
  autoWidth(ws4, stockData)
  XLSX.utils.book_append_sheet(wb, ws4, 'Stok Spare')

  XLSX.writeFile(wb, `ringkasan_${monthLabel.replace(' ', '_')}.xlsx`)
}

export async function exportLaporanPDF(year, month) {
  const units    = await UnitService.getAll()
  const svcs     = await SvcService.getByMonth(year, month)
  const solar    = await SolarService.getByMonth(year, month)
  const costs    = await CostService.getByMonth(year, month)
  const ritase   = await RitaseService.getByMonth(year, month)
  const unitMap  = Object.fromEntries(units.map(u => [u.lid, u.name]))
  const monthLabel = dayjs(`${year}-${String(month).padStart(2,'0')}-01`).format('MMMM YYYY')

  const totalSolarL  = solar.reduce((a, s) => a + (s.liters || 0), 0)
  const totalSolarRp = solar.reduce((a, s) => a + (s.liters || 0) * (s.pricePerLiter || 0), 0)
  const totalSvcRp   = svcs.reduce((a, s) => a + (s.cost || 0), 0)
  const totalCostRp  = costs.reduce((a, c) => a + (c.amount || 0), 0)
  const grandTotal   = totalSolarRp + totalSvcRp + totalCostRp
  const totalRitase  = ritase.reduce((a, r) => a + (r.jumlahRitase || 0), 0)
  const totalVolume  = ritase.reduce((a, r) => a + (r.jumlahRitase || 0) * (r.volumePerRitase || 0), 0)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()

  // Header
  doc.setFillColor(44, 26, 14)
  doc.rect(0, 0, W, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16); doc.setFont('helvetica', 'bold')
  doc.text('SCRAPERS — Tambang System', W / 2, 12, { align: 'center' })
  doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  doc.text(`Laporan Bulanan — ${monthLabel}`, W / 2, 20, { align: 'center' })
  doc.text(`Dicetak: ${dayjs().format('DD/MM/YYYY HH:mm')}`, W / 2, 26, { align: 'center' })

  // Summary boxes
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(12); doc.setFont('helvetica', 'bold')
  doc.text('Ringkasan Biaya', 14, 42)

  autoTable(doc, {
    startY: 46,
    head: [['Uraian', 'Nilai']],
    body: [
      ['Total Solar', `${totalSolarL.toLocaleString('id-ID')} L — ${rp(totalSolarRp)}`],
      ['Total Service', rp(totalSvcRp)],
      ['Biaya Lainnya', rp(totalCostRp)],
      ['GRAND TOTAL BIAYA', rp(grandTotal)],
      ['Total Ritase', `${totalRitase.toLocaleString('id-ID')} ritase`],
      ['Total Produksi', `${totalVolume.toLocaleString('id-ID')} m³`],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [44, 26, 14] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
    bodyStyles: { lineColor: [220, 220, 220] },
    didParseCell: (data) => {
      if (data.row.index === 3 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.textColor = [180, 0, 0]
      }
    }
  })

  // Service logs
  if (svcs.length > 0) {
    doc.setFontSize(12); doc.setFont('helvetica', 'bold')
    doc.text('Riwayat Service', 14, doc.lastAutoTable.finalY + 12)
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 16,
      head: [['Tgl', 'Unit', 'Tipe', 'Jam', 'Biaya (Rp)', 'Operator']],
      body: svcs.map(s => [s.date, unitMap[s.unit_lid] || '-', s.maintenanceType || '-', s.hourAtService || 0, Math.round(s.cost || 0).toLocaleString('id-ID'), s.operatorName || '-']),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [44, 26, 14] },
    })
  }

  // Solar logs
  if (solar.length > 0) {
    doc.setFontSize(12); doc.setFont('helvetica', 'bold')
    doc.text('Pengisian Solar', 14, doc.lastAutoTable.finalY + 12)
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 16,
      head: [['Tgl', 'Unit', 'Liter', 'Harga/L', 'Total (Rp)', 'Operator']],
      body: solar.map(s => [s.date, unitMap[s.unit_lid] || '-', s.liters || 0, Math.round(s.pricePerLiter || 0).toLocaleString('id-ID'), Math.round((s.liters || 0) * (s.pricePerLiter || 0)).toLocaleString('id-ID'), s.operatorName || '-']),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [44, 26, 14] },
    })
  }

  // Ritase logs
  if (ritase.length > 0) {
    doc.setFontSize(12); doc.setFont('helvetica', 'bold')
    doc.text('Data Ritase / Produksi', 14, doc.lastAutoTable.finalY + 12)
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 16,
      head: [['Tgl', 'Unit', 'Ritase', 'Vol/Ritase (m³)', 'Total (m³)', 'Operator']],
      body: ritase.map(r => [r.date, unitMap[r.unit_lid] || '-', r.jumlahRitase || 0, r.volumePerRitase || 0, ((r.jumlahRitase || 0) * (r.volumePerRitase || 0)).toLocaleString('id-ID'), r.operatorName || '-']),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [44, 26, 14] },
    })
  }

  doc.save(`laporan_${monthLabel.replace(' ', '_')}.pdf`)
}
