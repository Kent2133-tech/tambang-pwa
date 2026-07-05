import Dexie from 'dexie'

export const db = new Dexie('TambangSystemV1')

db.version(1).stores({
  units:      '++lid, cloud_id, type, status, synced',
  svc_logs:   '++lid, cloud_id, unit_lid, unit_cloud_id, date, synced',
  solar_logs: '++lid, cloud_id, unit_lid, unit_cloud_id, date, synced',
  cost_logs:  '++lid, cloud_id, unit_lid, unit_cloud_id, date, synced',
  inspections:'++lid, cloud_id, unit_lid, unit_cloud_id, date, synced',
  spare_parts:'++lid, cloud_id, unit_lid, unit_cloud_id, synced',
  spare_stock:'++lid, cloud_id, name, synced',
  photos:     '++lid, refType, refLid, synced',
  sync_queue: '++id, table_name, action, lid, created_at',
  operators:  '++lid, cloud_id, name, pin, role, active',
})

// v2: add daily_notes for mandor field reports
db.version(2).stores({
  units:       '++lid, cloud_id, type, status, synced',
  svc_logs:    '++lid, cloud_id, unit_lid, unit_cloud_id, date, synced',
  solar_logs:  '++lid, cloud_id, unit_lid, unit_cloud_id, date, synced',
  cost_logs:   '++lid, cloud_id, unit_lid, unit_cloud_id, date, synced',
  inspections: '++lid, cloud_id, unit_lid, unit_cloud_id, date, synced',
  spare_parts: '++lid, cloud_id, unit_lid, unit_cloud_id, synced',
  spare_stock: '++lid, cloud_id, name, synced',
  photos:      '++lid, refType, refLid, synced',
  sync_queue:  '++id, table_name, action, lid, created_at',
  operators:   '++lid, cloud_id, name, pin, role, active',
  daily_notes: '++lid, cloud_id, note_date, synced',
})

// v3: add ritase_logs for production tracking
db.version(3).stores({
  units:       '++lid, cloud_id, type, status, synced',
  svc_logs:    '++lid, cloud_id, unit_lid, unit_cloud_id, date, synced',
  solar_logs:  '++lid, cloud_id, unit_lid, unit_cloud_id, date, synced',
  cost_logs:   '++lid, cloud_id, unit_lid, unit_cloud_id, date, synced',
  inspections: '++lid, cloud_id, unit_lid, unit_cloud_id, date, synced',
  spare_parts: '++lid, cloud_id, unit_lid, unit_cloud_id, synced',
  spare_stock: '++lid, cloud_id, name, synced',
  photos:      '++lid, refType, refLid, synced',
  sync_queue:  '++id, table_name, action, lid, created_at',
  operators:   '++lid, cloud_id, name, pin, role, active',
  daily_notes: '++lid, cloud_id, note_date, synced',
  ritase_logs: '++lid, cloud_id, unit_lid, date, synced',
})

// v4: add transaksi_logs for mandor cash in/out tracking (matches Excel sheet TRANSAKSI)
db.version(4).stores({
  units:         '++lid, cloud_id, type, status, synced',
  svc_logs:      '++lid, cloud_id, unit_lid, unit_cloud_id, date, synced',
  solar_logs:    '++lid, cloud_id, unit_lid, unit_cloud_id, date, synced',
  cost_logs:     '++lid, cloud_id, unit_lid, unit_cloud_id, date, synced',
  inspections:   '++lid, cloud_id, unit_lid, unit_cloud_id, date, synced',
  spare_parts:   '++lid, cloud_id, unit_lid, unit_cloud_id, synced',
  spare_stock:   '++lid, cloud_id, name, synced',
  photos:        '++lid, refType, refLid, synced',
  sync_queue:    '++id, table_name, action, lid, created_at',
  operators:     '++lid, cloud_id, name, pin, role, active',
  daily_notes:   '++lid, cloud_id, note_date, synced',
  ritase_logs:   '++lid, cloud_id, unit_lid, date, synced',
  transaksi_logs:'++lid, cloud_id, date, tipe, kategori, synced',
})

export default db
