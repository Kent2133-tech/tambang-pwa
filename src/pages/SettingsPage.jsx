import { useState, useEffect, useCallback } from 'react'
import dayjs from 'dayjs'
import { UnitService, OperatorService } from '../services/dataServices'
import { pullFromCloud } from '../services/dataServices'
import { exportRingkasanBulanan } from '../services/exportService'
import { ConfirmModal, useToast, Toast, SectionHeader, EmptyState } from '../components/UI'
import { useAuth } from '../hooks/useAuth'

// ── UNIT MODAL ────────────────────────────────────────────────────
function UnitModal({ unit, onClose, onSuccess }) {
  const [f, setF] = useState(unit || { name: '', type: 'vehicle', kodeUnit: '', category: '', status: 'aktif', purchaseYear: new Date().getFullYear(), purchasePrice: '', totalHours: 0, fuelConsumptionPerHour: 0, economicLifeYears: 8, residualPercent: 10, inspectionIntervalDays: 30, maintenanceIntervals: { ringan: 250, sedang: 1000, besar: 2000, overhaul: 5000 } })
  const s = (k, v) => setF(p => ({ ...p, [k]: v }))

  const save = async () => {
    if (f.lid) await UnitService.update(f.lid, f)
    else await UnitService.add(f)
    onSuccess()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{f.lid ? 'Edit' : 'Tambah'} Unit</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Nama Unit *</label>
            <input className="form-input" value={f.name} onChange={e => s('name', e.target.value)} placeholder="Excavator PC200, Dump Truck..." />
          </div>
          <div className="form-group">
            <label className="form-label">Tipe</label>
            <select className="form-input form-select" value={f.type} onChange={e => s('type', e.target.value)}>
              <option value="vehicle">Kendaraan</option>
              <option value="machine">Mesin</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-input form-select" value={f.status} onChange={e => s('status', e.target.value)}>
              <option value="aktif">Aktif</option>
              <option value="maintenance">Maintenance</option>
              <option value="nonaktif">Nonaktif</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Kode Unit</label>
            <input className="form-input" value={f.kodeUnit || ''} onChange={e => s('kodeUnit', e.target.value)} placeholder="EXC-01" />
          </div>
          <div className="form-group">
            <label className="form-label">Tahun Beli</label>
            <input type="number" className="form-input" value={f.purchaseYear} onChange={e => s('purchaseYear', e.target.value)} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Harga Beli (Rp)</label>
            <input type="number" className="form-input" value={f.purchasePrice || ''} onChange={e => s('purchasePrice', e.target.value)} inputMode="numeric" />
          </div>
          <div className="form-group">
            <label className="form-label">Jam Meter Saat Ini</label>
            <input type="number" className="form-input" value={f.totalHours} onChange={e => s('totalHours', e.target.value)} inputMode="numeric" />
          </div>
          <div className="form-group">
            <label className="form-label">Konsumsi BBM (L/jam)</label>
            <input type="number" className="form-input" value={f.fuelConsumptionPerHour} onChange={e => s('fuelConsumptionPerHour', e.target.value)} inputMode="decimal" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary btn-full" onClick={save} disabled={!f.name}><i className="bi bi-floppy-fill" /> Simpan Unit</button>
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
  )
}

// ── OPERATOR MODAL ────────────────────────────────────────────────
function OperatorModal({ op, onClose, onSuccess }) {
  const [f, setF] = useState(op || { name: '', pin: '', role: 'operator', active: 1 })
  const s = (k, v) => setF(p => ({ ...p, [k]: v }))

  const save = async () => {
    if (f.lid) await OperatorService.update(f.lid, f)
    else await OperatorService.add(f)
    onSuccess()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{f.lid ? 'Edit' : 'Tambah'} Operator</div>
        <div className="form-group"><label className="form-label">Nama</label><input className="form-input" value={f.name} onChange={e => s('name', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">PIN (min 4 digit)</label><input type="password" className="form-input" value={f.pin} onChange={e => s('pin', e.target.value)} inputMode="numeric" /></div>
        <div className="form-group">
          <label className="form-label">Role</label>
          <select className="form-input form-select" value={f.role} onChange={e => s('role', e.target.value)}>
            <option value="owner">Owner</option>
            <option value="mandor">Mandor</option>
            <option value="operator">Operator</option>
          </select>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary btn-full" onClick={save} disabled={!f.name || f.pin.length < 4}><i className="bi bi-floppy-fill" /> Simpan</button>
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
  )
}

// ── MAIN SETTINGS PAGE ────────────────────────────────────────────
export default function SettingsPage() {
  const isOwner = false // Owner settings are in Owner Dashboard
  const [units, setUnits] = useState([])
  const [operators, setOperators] = useState([])
  const [unitModal, setUnitModal] = useState(null)
  const [opModal, setOpModal] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [msg, showMsg] = useToast()
  const [syncing, setSyncing] = useState(false)
  const [syncLog, setSyncLog] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportMonth, setExportMonth] = useState(dayjs().format('YYYY-MM'))

  const load = useCallback(async () => {
    setUnits(await UnitService.getAll())
    setOperators(await OperatorService.getAll())
  }, [])

  useEffect(() => { load() }, [load])

  const handleSync = async () => {
    setSyncing(true)
    setSyncLog('Memulai sync dari cloud...')
    const res = await pullFromCloud(msg => setSyncLog(msg))
    setSyncing(false)
    if (res.success) showMsg('✅ Sync dari cloud berhasil!')
    else showMsg('❌ Sync gagal: ' + res.error)
    setSyncLog('')
    load()
  }

  const handleExport = async () => {
    setExporting(true)
    const [year, month] = exportMonth.split('-').map(Number)
    await exportRingkasanBulanan(year, month)
    setExporting(false)
    showMsg('✅ File Excel berhasil didownload!')
  }

  return (
    <div className="page-enter">
      <Toast msg={msg} />
      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 18, marginBottom: 16 }}>⚙️ Pengaturan</div>

      {/* EXPORT EXCEL */}
      <div className="card">
        <div className="card-header"><span className="card-title">📊 Export Excel</span></div>
        <p style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 12 }}>Download ringkasan bulanan (service, solar, stok) ke Excel.</p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="form-label">Bulan</label>
            <input type="month" className="form-input" value={exportMonth} onChange={e => setExportMonth(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
            <i className="bi bi-file-earmark-excel-fill" /> {exporting ? 'Mengexport...' : 'Download Excel'}
          </button>
        </div>
      </div>

      {/* SYNC CLOUD */}
      {isOwner && (
        <div className="card">
          <div className="card-header"><span className="card-title">☁️ Sync dari Cloud</span></div>
          <p style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 12 }}>Tarik semua data dari Supabase ke device ini. Gunakan saat ganti HP atau install ulang.</p>
          {syncLog && <div className="alert alert-info" style={{ marginBottom: 10 }}><i className="bi bi-arrow-repeat" /> {syncLog}</div>}
          <button className="btn btn-secondary btn-full" onClick={handleSync} disabled={syncing}>
            <i className="bi bi-cloud-download" /> {syncing ? 'Menarik data...' : 'Tarik Data dari Cloud'}
          </button>
        </div>
      )}

      {/* UNIT MANAGEMENT */}
      {isOwner && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">🚛 Manajemen Unit ({units.length})</span>
            <button className="btn btn-primary btn-sm" onClick={() => setUnitModal({})}><i className="bi bi-plus-lg" /> Tambah</button>
          </div>
          {units.length === 0 ? <EmptyState icon="bi-truck" text="Belum ada unit" /> : (
            units.map(u => (
              <div key={u.lid} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--bd)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--mu)' }}>{u.type} · {u.totalHours || 0} jam · {u.status}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-icon btn-sm" onClick={() => setUnitModal(u)}><i className="bi bi-pencil" /></button>
                  <button className="btn-icon btn-sm" onClick={() => setConfirm({ type: 'unit', item: u })}><i className="bi bi-trash3" /></button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* OPERATOR MANAGEMENT */}
      {isOwner && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">👷 Manajemen Operator ({operators.length})</span>
            <button className="btn btn-primary btn-sm" onClick={() => setOpModal({})}><i className="bi bi-plus-lg" /> Tambah</button>
          </div>
          {operators.map(op => (
            <div key={op.lid} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--bd)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{op.name}</div>
                <div style={{ fontSize: 11, color: 'var(--mu)' }}>Role: {op.role} · PIN: {'•'.repeat(op.pin?.length || 4)}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-icon btn-sm" onClick={() => setOpModal(op)}><i className="bi bi-pencil" /></button>
                <button className="btn-icon btn-sm" onClick={() => setConfirm({ type: 'operator', item: op })}><i className="bi bi-trash3" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODALS */}
      {unitModal !== null && (
        <UnitModal unit={unitModal?.lid ? unitModal : null} onClose={() => setUnitModal(null)} onSuccess={() => { setUnitModal(null); showMsg('Unit tersimpan!'); load() }} />
      )}
      {opModal !== null && (
        <OperatorModal op={opModal?.lid ? opModal : null} onClose={() => setOpModal(null)} onSuccess={() => { setOpModal(null); showMsg('Operator tersimpan!'); load() }} />
      )}
      {confirm && (
        <ConfirmModal
          msg={`Hapus ${confirm.type === 'unit' ? 'unit' : 'operator'} "${confirm.item.name}"?`}
          onConfirm={async () => {
            if (confirm.type === 'unit') await UnitService.delete(confirm.item.lid)
            else await OperatorService.delete(confirm.item.lid)
            showMsg('Dihapus!')
            setConfirm(null)
            load()
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
