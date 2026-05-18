import db from './db'
import supabase from './supabase'
import dayjs from 'dayjs'

const num = v => parseFloat(v) || 0

// ── SYNC ENGINE ─────────────────────────────────────────────────
const TABLE_MAP = {
  units: 'units', svc_logs: 'service_logs', solar_logs: 'solar_logs',
  cost_logs: 'cost_logs', inspections: 'inspections',
  spare_parts: 'spare_parts', spare_stock: 'spare_stock',
}

async function queueSync(tableName, action, lid, payload) {
  await db.sync_queue.add({ table_name: tableName, action, lid, payload: JSON.stringify(payload), created_at: new Date().toISOString() })
}

export async function processSyncQueue() {
  const queue = await db.sync_queue.toArray()
  for (const item of queue) {
    try {
      const sTable = TABLE_MAP[item.table_name]
      if (!sTable) { await db.sync_queue.delete(item.id); continue }
      const payload = JSON.parse(item.payload || '{}')
      if (item.action === 'insert') {
        const { data, error } = await supabase.from(sTable).insert(payload).select().single()
        if (!error && data) {
          await db[item.table_name].where('lid').equals(item.lid).modify({ cloud_id: data.id, synced: 1 })
        }
      } else if (item.action === 'update') {
        const { error } = await supabase.from(sTable).update(payload).eq('id', payload.cloud_id)
        if (!error) await db[item.table_name].where('lid').equals(item.lid).modify({ synced: 1 })
      } else if (item.action === 'delete') {
        if (payload.cloud_id) await supabase.from(sTable).delete().eq('id', payload.cloud_id)
      }
      await db.sync_queue.delete(item.id)
    } catch (e) {
      console.warn('Sync queue item failed:', e)
    }
  }
}

export async function pullFromCloud(onProgress) {
  try {
    onProgress?.('Mengambil data unit...')
    const { data: units } = await supabase.from('units').select('*').order('created_at')
    if (units) {
      await db.units.clear()
      for (const u of units) {
        await db.units.add({
          cloud_id: u.id, type: u.type, name: u.name, kodeUnit: u.kode_unit,
          category: u.category, status: u.status || 'aktif', location: u.location || '',
          purchasePrice: u.purchase_price || 0, purchaseYear: u.purchase_year,
          economicLifeYears: u.economic_life_years || 8, residualPercent: u.residual_percent || 10,
          totalHours: u.total_hours || 0, fuelConsumptionPerHour: u.fuel_consumption_per_hour || 0,
          maintenanceIntervals: u.maintenance_intervals || { ringan: 250, sedang: 1000, besar: 2000, overhaul: 5000 },
          lastServiceHours: u.last_service_hours || {},
          inspectionIntervalHours: u.inspection_interval_hours || 1000,
          inspectionIntervalDays: u.inspection_interval_days || 30,
          lastInspectionHour: u.last_inspection_hour, lastInspectionDate: u.last_inspection_date,
          synced: 1
        })
      }
    }

    onProgress?.('Mengambil service logs...')
    const { data: svcs } = await supabase.from('service_logs').select('*').order('created_at')
    if (svcs) {
      await db.svc_logs.clear()
      for (const s of svcs) {
        const lu = await db.units.where('cloud_id').equals(s.unit_id || '').first()
        await db.svc_logs.add({
          cloud_id: s.id, unit_lid: lu?.lid, unit_cloud_id: s.unit_id,
          date: s.date, maintenanceType: s.maintenance_type, hourAtService: s.hour_at_service,
          cost: s.cost || 0, downtimeHours: s.downtime_hours || 0,
          sparePartsUsed: s.spare_parts_used || '', note: s.note || '',
          operatorName: s.operator_name || '', synced: 1
        })
      }
    }

    onProgress?.('Mengambil solar logs...')
    const { data: solar } = await supabase.from('solar_logs').select('*').order('created_at')
    if (solar) {
      await db.solar_logs.clear()
      for (const s of solar) {
        const lu = await db.units.where('cloud_id').equals(s.unit_id || '').first()
        await db.solar_logs.add({
          cloud_id: s.id, unit_lid: lu?.lid, unit_cloud_id: s.unit_id,
          date: s.date, liters: s.liters || 0, pricePerLiter: s.price_per_liter || 0,
          operatorName: s.operator_name || '', note: s.note || '', synced: 1
        })
      }
    }

    onProgress?.('Mengambil inspeksi...')
    const { data: insp } = await supabase.from('inspections').select('*').order('created_at')
    if (insp) {
      await db.inspections.clear()
      for (const s of insp) {
        const lu = await db.units.where('cloud_id').equals(s.unit_id || '').first()
        await db.inspections.add({
          cloud_id: s.id, unit_lid: lu?.lid, unit_cloud_id: s.unit_id,
          date: s.date, hourAtInspection: s.hour_at_inspection,
          inspectorName: s.inspector_name || '', results: s.results,
          overallResult: s.overall_result, note: s.note || '', synced: 1
        })
      }
    }

    onProgress?.('Mengambil stok spare part...')
    const { data: stock } = await supabase.from('spare_stock').select('*')
    if (stock) {
      await db.spare_stock.clear()
      for (const s of stock) {
        await db.spare_stock.add({ cloud_id: s.id, name: s.name || s.nama, qty: s.qty || 0, unit: s.unit || s.satuan || 'pcs', synced: 1 })
      }
    }

    onProgress?.('Selesai!')
    return { success: true }
  } catch (e) {
    console.error('Pull from cloud failed:', e)
    return { success: false, error: e.message }
  }
}

// ── UNIT SERVICE ─────────────────────────────────────────────────
export const UnitService = {
  getAll: () => db.units.toArray(),
  getActive: () => db.units.where('status').notEqual('nonaktif').toArray(),
  get: lid => db.units.get(lid),
  getByCloudId: cid => db.units.where('cloud_id').equals(cid).first(),

  operationalStatus(u) {
    const intervals = u.maintenanceIntervals || { ringan: 250, sedang: 1000, besar: 2000, overhaul: 5000 }
    const lastSvc = u.lastServiceHours || {}
    let minSisa = Infinity
    for (const [type, interval] of Object.entries(intervals)) {
      const last = lastSvc[type] || 0
      const sisa = (last + interval) - (u.totalHours || 0)
      if (sisa < minSisa) minSisa = sisa
    }
    if (minSisa <= 0) return 'overdue'
    if (minSisa <= 50) return 'hampir'
    return 'sehat'
  },

  async add(data) {
    const lid = await db.units.add({ ...data, synced: 0 })
    await queueSync('units', 'insert', lid, {
      type: data.type, name: data.name, kode_unit: data.kodeUnit,
      category: data.category, status: data.status || 'aktif',
      purchase_price: num(data.purchasePrice), purchase_year: num(data.purchaseYear),
      economic_life_years: num(data.economicLifeYears) || 8,
      residual_percent: num(data.residualPercent) || 10,
      total_hours: num(data.totalHours), fuel_consumption_per_hour: num(data.fuelConsumptionPerHour),
      maintenance_intervals: data.maintenanceIntervals,
      inspection_interval_hours: num(data.inspectionIntervalHours) || 1000,
      inspection_interval_days: num(data.inspectionIntervalDays) || 30,
    })
    return lid
  },

  async update(lid, data) {
    await db.units.update(lid, { ...data, synced: 0 })
    const u = await db.units.get(lid)
    if (u?.cloud_id) await queueSync('units', 'update', lid, { cloud_id: u.cloud_id, ...data })
  },

  async delete(lid) {
    const u = await db.units.get(lid)
    await db.units.delete(lid)
    await db.svc_logs.where('unit_lid').equals(lid).delete()
    await db.solar_logs.where('unit_lid').equals(lid).delete()
    await db.inspections.where('unit_lid').equals(lid).delete()
    if (u?.cloud_id) await queueSync('units', 'delete', lid, { cloud_id: u.cloud_id })
  }
}

// ── SERVICE LOG SERVICE ──────────────────────────────────────────
export const SvcService = {
  getAll: () => db.svc_logs.reverse().sortBy('date'),
  getByUnit: lid => db.svc_logs.where('unit_lid').equals(lid).reverse().sortBy('date'),
  getByMonth: (year, month) => {
    const start = `${year}-${String(month).padStart(2,'0')}-01`
    const end = `${year}-${String(month).padStart(2,'0')}-31`
    return db.svc_logs.filter(l => l.date >= start && l.date <= end).toArray()
  },

  async add(data) {
    const lid = await db.svc_logs.add({ ...data, synced: 0 })
    const u = await db.units.get(data.unit_lid)
    if (u && data.maintenanceType) {
      const lsh = { ...(u.lastServiceHours || {}) }
      lsh[data.maintenanceType] = data.hourAtService
      await db.units.update(data.unit_lid, { lastServiceHours: lsh })
    }
    await queueSync('svc_logs', 'insert', lid, {
      unit_id: u?.cloud_id, date: data.date, maintenance_type: data.maintenanceType,
      hour_at_service: num(data.hourAtService), cost: num(data.cost),
      downtime_hours: num(data.downtimeHours), spare_parts_used: data.sparePartsUsed || '',
      note: data.note || '', operator_name: data.operatorName || ''
    })
    if (data.cost > 0) {
      await CostService.add({ unit_lid: data.unit_lid, category: 'Service', amount: num(data.cost), date: data.date, note: data.maintenanceType, operatorName: data.operatorName || '' })
    }
    return lid
  },

  async delete(lid) {
    const r = await db.svc_logs.get(lid)
    await db.svc_logs.delete(lid)
    await db.photos.where({ refType: 'service', refLid: lid }).delete()
    if (r?.cloud_id) await queueSync('svc_logs', 'delete', lid, { cloud_id: r.cloud_id })
  }
}

// ── SOLAR SERVICE ────────────────────────────────────────────────
export const SolarService = {
  getAll: () => db.solar_logs.toArray(),
  getByUnit: lid => db.solar_logs.where('unit_lid').equals(lid).toArray(),
  getByMonth: (year, month) => {
    const start = `${year}-${String(month).padStart(2,'0')}-01`
    const end = `${year}-${String(month).padStart(2,'0')}-31`
    return db.solar_logs.filter(l => l.date >= start && l.date <= end).toArray()
  },

  async add(data) {
    const lid = await db.solar_logs.add({ ...data, synced: 0 })
    const u = await db.units.get(data.unit_lid)
    await queueSync('solar_logs', 'insert', lid, {
      unit_id: u?.cloud_id, date: data.date, liters: num(data.liters),
      price_per_liter: num(data.pricePerLiter), operator_name: data.operatorName || '', note: data.note || ''
    })
    return lid
  },

  async delete(lid) {
    const r = await db.solar_logs.get(lid)
    await db.solar_logs.delete(lid)
    if (r?.cloud_id) await queueSync('solar_logs', 'delete', lid, { cloud_id: r.cloud_id })
  }
}

// ── INSPEKSI SERVICE ─────────────────────────────────────────────
export const InspService = {
  getAll: () => db.inspections.reverse().sortBy('date'),
  getByUnit: lid => db.inspections.where('unit_lid').equals(lid).reverse().sortBy('date'),

  async add(data) {
    const lid = await db.inspections.add({ ...data, synced: 0 })
    const u = await db.units.get(data.unit_lid)
    await db.units.update(data.unit_lid, { lastInspectionDate: data.date, lastInspectionHour: data.hourAtInspection })
    await queueSync('inspections', 'insert', lid, {
      unit_id: u?.cloud_id, date: data.date, hour_at_inspection: num(data.hourAtInspection),
      inspector_name: data.inspectorName, results: data.results,
      overall_result: data.overallResult, note: data.note || ''
    })
    return lid
  },

  async delete(lid) {
    const r = await db.inspections.get(lid)
    await db.inspections.delete(lid)
    await db.photos.where({ refType: 'inspeksi', refLid: lid }).delete()
    if (r?.cloud_id) await queueSync('inspections', 'delete', lid, { cloud_id: r.cloud_id })
  }
}

// ── SPARE STOCK SERVICE ──────────────────────────────────────────
export const StockService = {
  getAll: () => db.spare_stock.toArray(),
  getLow: () => db.spare_stock.filter(s => s.qty < 5).toArray(),

  async add(data) {
    const existing = await db.spare_stock.where('name').equalsIgnoreCase(data.name).first()
    if (existing) {
      const newQty = (existing.qty || 0) + num(data.qty)
      await db.spare_stock.update(existing.lid, { qty: newQty, synced: 0 })
      if (existing.cloud_id) await queueSync('spare_stock', 'update', existing.lid, { cloud_id: existing.cloud_id, qty: newQty })
      return existing.lid
    }
    const lid = await db.spare_stock.add({ ...data, synced: 0 })
    await queueSync('spare_stock', 'insert', lid, { name: data.name, qty: num(data.qty), unit: data.unit || 'pcs' })
    return lid
  },

  async update(lid, data) {
    await db.spare_stock.update(lid, { ...data, synced: 0 })
    const s = await db.spare_stock.get(lid)
    if (s?.cloud_id) await queueSync('spare_stock', 'update', lid, { cloud_id: s.cloud_id, ...data })
  },

  async delete(lid) {
    const s = await db.spare_stock.get(lid)
    await db.spare_stock.delete(lid)
    if (s?.cloud_id) await queueSync('spare_stock', 'delete', lid, { cloud_id: s.cloud_id })
  }
}

// ── COST SERVICE ─────────────────────────────────────────────────
export const CostService = {
  getAll: () => db.cost_logs.toArray(),
  getByDateRange: (start, end) => db.cost_logs.filter(l => l.date >= start && l.date <= end).toArray(),
  getByMonth: (year, month) => {
    const start = `${year}-${String(month).padStart(2,'0')}-01`
    const end = `${year}-${String(month).padStart(2,'0')}-31`
    return db.cost_logs.filter(l => l.date >= start && l.date <= end).toArray()
  },

  async add(data) {
    const lid = await db.cost_logs.add({ ...data, synced: 0 })
    const u = data.unit_lid ? await db.units.get(data.unit_lid) : null
    await queueSync('cost_logs', 'insert', lid, {
      unit_id: u?.cloud_id, category: data.category, amount: num(data.amount),
      date: data.date, note: data.note || '', operator_name: data.operatorName || ''
    })
    return lid
  }
}

// ── PHOTO SERVICE ────────────────────────────────────────────────
export const PhotoService = {
  getByRef: (refType, refLid) => db.photos.where({ refType, refLid }).toArray(),

  async add(refType, refLid, dataUrl, caption = '') {
    return db.photos.add({ refType, refLid, dataUrl, caption, ts: new Date().toISOString(), synced: 0 })
  },

  async delete(lid) { await db.photos.delete(lid) },

  compress(dataUrl, maxW = 1200) {
    return new Promise(res => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, maxW / img.width)
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        res(canvas.toDataURL('image/jpeg', 0.78))
      }
      img.src = dataUrl
    })
  }
}

// ── OPERATOR SERVICE ─────────────────────────────────────────────
export const OperatorService = {
  getAll: () => db.operators.toArray(),
  getActive: () => db.operators.where('active').equals(1).toArray(),
  getByPin: pin => db.operators.where('pin').equals(pin).first(),

  async init() {
    const count = await db.operators.count()
    if (count === 0) {
      await db.operators.bulkAdd([
        { name: 'Owner', pin: '251025', role: 'owner', active: 1 },
        { name: 'Operator 1', pin: '1111', role: 'operator', active: 1 },
        { name: 'Operator 2', pin: '2222', role: 'operator', active: 1 },
        { name: 'Mandor', pin: '3333', role: 'mandor', active: 1 },
      ])
    }
  },

  async add(data) { return db.operators.add({ ...data, active: 1 }) },
  async update(lid, data) { return db.operators.update(lid, data) },
  async delete(lid) { return db.operators.delete(lid) }
}

// ── DAILY NOTE SERVICE ───────────────────────────────────────────
export const DailyNoteService = {
  getAll: () => db.daily_notes.orderBy('note_date').reverse().toArray(),
  getByDate: (date) => db.daily_notes.where('note_date').equals(date).first(),
  getByMonth: (year, month) => {
    const start = `${year}-${String(month).padStart(2,'0')}-01`
    const end   = `${year}-${String(month).padStart(2,'0')}-31`
    return db.daily_notes.filter(n => n.note_date >= start && n.note_date <= end).toArray()
  },

  async add(data) {
    // note_date is always what user typed — never overwritten by sync date
    const lid = await db.daily_notes.add({ ...data, synced: 0, created_at: new Date().toISOString() })
    await queueSync('daily_notes', 'insert', lid, {
      note_date:    data.note_date,
      content:      data.content,
      author_name:  data.authorName || 'Mandor',
      created_at:   data.created_at || new Date().toISOString(),
    })
    return lid
  },

  async update(lid, data) {
    await db.daily_notes.update(lid, { ...data, synced: 0, updated_at: new Date().toISOString() })
    const n = await db.daily_notes.get(lid)
    if (n?.cloud_id) await queueSync('daily_notes', 'update', lid, { cloud_id: n.cloud_id, ...data })
  },

  async delete(lid) {
    const n = await db.daily_notes.get(lid)
    await db.daily_notes.delete(lid)
    if (n?.cloud_id) await queueSync('daily_notes', 'delete', lid, { cloud_id: n.cloud_id })
  }
}
