import { useState, useEffect, useCallback } from 'react'
import dayjs from 'dayjs'
import db from '../services/db'
import { UnitService, SvcService, InspService, PhotoService } from '../services/dataServices'
import { ConfirmModal, PhotoUploader, useToast, Toast, EmptyState, PageHeader, ModalShell, FilterPills, StatusDot } from '../components/UI'
import { useAuth } from '../hooks/useAuth'

const today = () => dayjs().format('YYYY-MM-DD')
const numF = n => (n || 0).toLocaleString('id-ID')
const rp = n => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`

const MT_SCHEDULES = [
  { t: 'ringan', l: 'Ringan', interval: 250, c: '#4CAF82' },
  { t: 'sedang', l: 'Sedang', interval: 1000, c: '#F5A623' },
  { t: 'besar',  l: 'Besar',  interval: 2000, c: '#E05252' },
  { t: 'overhaul', l: 'Overhaul', interval: 5000, c: '#775537' },
]

const UCATS = {
  vehicle: ['Dump Truck', 'Excavator', 'Wheel Loader', 'Bulldozer', 'Grader', 'Water Truck', 'Compactor', 'Lainnya'],
  machine: ['Crusher', 'Screen', 'Conveyor', 'Pompa', 'Genset', 'Kompressor', 'Lainnya'],
}

// ── MAINTENANCE STATUS ────────────────────────────────────────────
function getMaintStatus(unit) {
  const intervals = unit.maintenanceIntervals || { ringan: 250, sedang: 1000, besar: 2000, overhaul: 5000 }
  const lastSvc = unit.lastServiceHours || {}
  const totalH = unit.totalHours || 0
  return MT_SCHEDULES.map(m => {
    const interval = intervals[m.t] || m.interval
    const last = lastSvc[m.t] || 0
    const nextAt = last + interval
    const diff = nextAt - totalH
    const pct = Math.min(100, Math.round(((totalH - last) / interval) * 100))
    const st = diff <= 0 ? 'overdue' : diff <= 50 ? 'due-soon' : 'ok'
    return { ...m, interval, last, nextAt, diff, pct, st }
  })
}

function getInspStatus(unit) {
  if (!unit.lastInspectionDate) return 'overdue'
  const diff = dayjs().diff(dayjs(unit.lastInspectionDate), 'day')
  const interval = unit.inspectionIntervalDays || 30
  if (diff >= interval) return 'overdue'
  if (diff >= interval - 7) return 'due-soon'
  return 'ok'
}

function getOpStatus(unit) {
  const ms = getMaintStatus(unit)
  if (ms.some(m => m.st === 'overdue')) return 'overdue'
  if (ms.some(m => m.st === 'due-soon')) return 'hampir'
  return 'sehat'
}

// ── ADD HOURS MODAL ───────────────────────────────────────────────
function AddHoursModal({ unit, onClose, onSuccess }) {
  const [h, setH] = useState('')
  const [msg, showMsg] = useToast()

  const save = async () => {
    const hours = parseFloat(h) || 0
    if (hours <= 0) { showMsg('Masukkan jam yang valid'); return }
    await UnitService.update(unit.lid, { totalHours: (unit.totalHours || 0) + hours })
    onSuccess()
  }

  return (
    <ModalShell title="Tambah Jam Operasi" icon="bi-stopwatch" onClose={onClose} maxWidth={340}
      footer={<>
        <button className="btn btn-primary btn-full" onClick={save}><i className="bi bi-check-lg" /> Simpan</button>
        <button className="btn btn-secondary" onClick={onClose}>Batal</button>
      </>}>
      <Toast msg={msg} />
      <p style={{ fontSize: 12.5, color: 'var(--mu)', marginBottom: 4, textAlign: 'center' }}>{unit.name}</p>
      <p style={{ fontSize: 11.5, color: 'var(--mu)', marginBottom: 14, textAlign: 'center' }}>
        Saat ini: <strong style={{ fontFamily: 'Space Grotesk' }}>{numF(unit.totalHours)} jam</strong>
      </p>
      <div className="form-group">
        <label className="form-label">Jam Ditambahkan</label>
        <input type="number" className="form-input" style={{ textAlign: 'center', fontSize: 22, fontWeight: 700 }}
          placeholder="0" value={h} onChange={e => setH(e.target.value)} autoFocus inputMode="numeric" />
      </div>
      {h > 0 && (
        <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--mu)', marginBottom: 12 }}>
          Menjadi <strong style={{ color: 'var(--pr)', fontSize: 15, fontFamily: 'Space Grotesk' }}>
            {numF((unit.totalHours || 0) + (parseFloat(h) || 0))} jam
          </strong>
        </p>
      )}
    </ModalShell>
  )
}

// ── UNIT MODAL ────────────────────────────────────────────────────
function UnitModal({ existing, unitType, onClose, onSuccess }) {
  const isEdit = !!existing
  const [f, setF] = useState(existing || {
    type: unitType || 'vehicle', name: '', kodeUnit: '', category: '', status: 'aktif',
    location: '', purchasePrice: '', purchaseYear: new Date().getFullYear(),
    economicLifeYears: 8, residualPercent: 10, totalHours: 0, fuelConsumptionPerHour: '',
    maintenanceIntervals: { ringan: 250, sedang: 1000, besar: 2000, overhaul: 5000 },
    inspectionIntervalHours: 1000, inspectionIntervalDays: 30,
  })
  const [saving, setSaving] = useState(false)
  const s = (k, v) => setF(p => ({ ...p, [k]: v }))
  const si = (k, v) => setF(p => ({ ...p, maintenanceIntervals: { ...p.maintenanceIntervals, [k]: parseFloat(v) || 0 } }))
  const cats = UCATS[f.type] || []

  const save = async () => {
    if (!f.name) return
    setSaving(true)
    if (isEdit) await UnitService.update(existing.lid, f)
    else await UnitService.add(f)
    onSuccess()
  }

  return (
    <ModalShell title={isEdit ? 'Edit Unit' : 'Tambah Unit Baru'} icon={f.type === 'vehicle' ? 'bi-truck-front-fill' : 'bi-gear-wide-connected'} onClose={onClose}
      footer={<>
        <button className="btn btn-primary btn-full" onClick={save} disabled={!f.name || saving}>
          <i className="bi bi-check-lg" /> {saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Tambah Unit'}
        </button>
        <button className="btn btn-secondary" onClick={onClose}>Batal</button>
      </>}>

      {!isEdit && (
        <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
          {[['vehicle', 'bi-truck-front-fill', 'Kendaraan'], ['machine', 'bi-gear-wide-connected', 'Mesin']].map(([t, ico, l]) => (
            <button key={t} onClick={() => s('type', t)} style={{
              flex: 1, padding: '10px', minHeight: 'var(--tap)', borderRadius: 8,
              border: `2px solid ${f.type === t ? 'var(--pr)' : 'var(--bd)'}`,
              background: f.type === t ? 'rgba(119,85,55,.07)' : '#fff',
              fontWeight: 600, fontSize: 12.5, cursor: 'pointer',
              color: f.type === t ? 'var(--pr)' : 'var(--mu)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontFamily: 'DM Sans, sans-serif',
            }}><i className={`bi ${ico}`} /> {l}</button>
          ))}
        </div>
      )}

      <div className="form-grid-responsive" style={{ display: 'grid', gap: 10 }}>
        <div className="form-group form-span-2">
          <label className="form-label">Nama Unit *</label>
          <input className="form-input" value={f.name} onChange={e => s('name', e.target.value)} placeholder="Excavator Komatsu PC200" />
        </div>
        <div className="form-group">
          <label className="form-label">Kategori</label>
          <select className="form-input form-select" value={f.category || ''} onChange={e => s('category', e.target.value)}>
            <option value="">-- Pilih --</option>
            {cats.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Kode Unit</label>
          <input className="form-input" value={f.kodeUnit || ''} onChange={e => s('kodeUnit', e.target.value)} placeholder="EXC-01" />
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-input form-select" value={f.status || 'aktif'} onChange={e => s('status', e.target.value)}>
            <option value="aktif">Aktif</option>
            <option value="standby">Standby</option>
            <option value="maintenance">Maintenance</option>
            <option value="rusak">Rusak</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Lokasi</label>
          <input className="form-input" value={f.location || ''} onChange={e => s('location', e.target.value)} placeholder="Pit A, Stockpile..." />
        </div>
        <div className="form-group">
          <label className="form-label">Jam Operasi Saat Ini</label>
          <input type="number" className="form-input" value={f.totalHours || 0} onChange={e => s('totalHours', parseFloat(e.target.value) || 0)} inputMode="numeric" />
        </div>
        <div className="form-group">
          <label className="form-label">Konsumsi Solar (L/jam)</label>
          <input type="number" className="form-input" value={f.fuelConsumptionPerHour || ''} onChange={e => s('fuelConsumptionPerHour', e.target.value)} inputMode="decimal" />
        </div>
        <div className="form-group form-span-2">
          <label className="form-label">Harga Beli (Rp)</label>
          <input type="number" className="form-input" value={f.purchasePrice || ''} onChange={e => s('purchasePrice', e.target.value)} inputMode="numeric" />
        </div>
        <div className="form-group">
          <label className="form-label">Tahun Beli</label>
          <input type="number" className="form-input" value={f.purchaseYear || ''} onChange={e => s('purchaseYear', e.target.value)} inputMode="numeric" />
        </div>
        <div className="form-group">
          <label className="form-label">Umur Ekonomis (th)</label>
          <input type="number" className="form-input" value={f.economicLifeYears || 8} onChange={e => s('economicLifeYears', e.target.value)} />
        </div>
      </div>

      {/* Maintenance Intervals */}
      <div style={{ marginTop: 4, padding: '12px', background: 'rgba(119,85,55,.05)', borderRadius: 8, border: '1px solid var(--bd)', marginBottom: 10 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--pr)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>
          <i className="bi bi-gear-fill" /> Interval Maintenance (Jam)
        </div>
        <div className="interval-grid-responsive" style={{ display: 'grid', gap: 8 }}>
          {MT_SCHEDULES.map(m => (
            <div key={m.t} className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{m.l}</label>
              <input type="number" className="form-input" value={f.maintenanceIntervals?.[m.t] || m.interval}
                onChange={e => si(m.t, e.target.value)} inputMode="numeric" />
            </div>
          ))}
        </div>
      </div>

      {/* Inspeksi Intervals */}
      <div style={{ padding: '12px', background: 'rgba(74,144,217,.05)', borderRadius: 8, border: '1px solid rgba(74,144,217,.18)', marginBottom: 10 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#1a5fa8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>
          <i className="bi bi-search" /> Interval Inspeksi
        </div>
        <div className="interval-grid-responsive" style={{ display: 'grid', gap: 10 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Berbasis Jam (h)</label>
            <input type="number" className="form-input" value={f.inspectionIntervalHours || 1000} onChange={e => s('inspectionIntervalHours', e.target.value)} inputMode="numeric" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Kalender (hari)</label>
            <input type="number" className="form-input" value={f.inspectionIntervalDays || 30} onChange={e => s('inspectionIntervalDays', e.target.value)} inputMode="numeric" />
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

// ── SERVICE MODAL (inline, untuk dari UnitRow) ────────────────────
function QuickServiceModal({ unit, onClose, onSuccess }) {
  const { user } = useAuth()
  const [f, setF] = useState({ date: today(), maintenanceType: 'ringan', hourAtService: unit?.totalHours || 0, cost: '', downtimeHours: '', sparePartsUsed: '', note: '', operatorName: user?.name || 'Operator' })
  const [photos, setPhotos] = useState([])
  const s = (k, v) => setF(p => ({ ...p, [k]: v }))

  const save = async () => {
    const { SvcService } = await import('../services/dataServices')
    const lid = await SvcService.add({ ...f, unit_lid: unit.lid, hourAtService: parseFloat(f.hourAtService) || 0, cost: parseFloat(f.cost) || 0, downtimeHours: parseFloat(f.downtimeHours) || 0 })
    for (const ph of photos) await PhotoService.add('service', lid, ph.dataUrl)
    onSuccess()
  }

  return (
    <ModalShell title={`Service — ${unit?.name}`} icon="bi-tools" onClose={onClose}
      footer={<>
        <button className="btn btn-primary btn-full" onClick={save}><i className="bi bi-floppy-fill" /> Simpan</button>
        <button className="btn btn-secondary" onClick={onClose}>Batal</button>
      </>}>
      <div className="mt-chips" style={{ marginBottom: 10 }}>
        {MT_SCHEDULES.map(m => (
          <button key={m.t} className="mt-chip" onClick={() => s('maintenanceType', m.t)} style={{
            borderColor: f.maintenanceType === m.t ? m.c : 'var(--bd)',
            background: f.maintenanceType === m.t ? m.c + '22' : 'transparent',
            color: f.maintenanceType === m.t ? m.c : 'var(--mu)',
          }}>{m.l}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="form-group"><label className="form-label">Tanggal</label><input type="date" className="form-input" value={f.date} onChange={e => s('date', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Jam Meter</label><input type="number" className="form-input" value={f.hourAtService} onChange={e => s('hourAtService', e.target.value)} inputMode="numeric" /></div>
        <div className="form-group"><label className="form-label">Biaya (Rp)</label><input type="number" className="form-input" value={f.cost} onChange={e => s('cost', e.target.value)} inputMode="numeric" /></div>
        <div className="form-group"><label className="form-label">Downtime (jam)</label><input type="number" className="form-input" value={f.downtimeHours} onChange={e => s('downtimeHours', e.target.value)} inputMode="numeric" /></div>
      </div>
      <div className="form-group"><label className="form-label">Spare Part</label><input className="form-input" value={f.sparePartsUsed} onChange={e => s('sparePartsUsed', e.target.value)} placeholder="Filter oli, fan belt..." /></div>
      <div className="form-group"><label className="form-label">Catatan</label><textarea className="form-input" value={f.note} onChange={e => s('note', e.target.value)} /></div>
      <div className="form-group"><label className="form-label"><i className="bi bi-camera-fill" /> Foto</label><PhotoUploader photos={photos} setPhotos={setPhotos} /></div>
    </ModalShell>
  )
}

// ── INSPEKSI MODAL (inline) ───────────────────────────────────────
const CHECKLIST = ['Mesin / Engine','Sistem Pendingin','Oli & Pelumas','Ban / Track','Rem & Kopling','Lampu & Elektrikal','Kabin & Kaca','Sistem Hidraulik','Filter Udara & Bahan Bakar','Kondisi Body / Frame']

function QuickInspModal({ unit, onClose, onSuccess }) {
  const { user } = useAuth()
  const [f, setF] = useState({ date: today(), hourAtInspection: unit?.totalHours || 0, inspectorName: user?.name || 'Operator', note: '' })
  const [results, setResults] = useState(() => Object.fromEntries(CHECKLIST.map((_, i) => [i, 'ok'])))
  const [photos, setPhotos] = useState([])
  const overall = Object.values(results).includes('bad') ? 'rusak' : Object.values(results).includes('warn') ? 'perlu-perbaikan' : 'normal'
  const rc = { normal: 'var(--ok)', 'perlu-perbaikan': 'var(--wn)', rusak: 'var(--er)' }
  const overallLabel = { normal: 'Normal', 'perlu-perbaikan': 'Perlu Perbaikan', rusak: 'Rusak / Kritis' }
  const overallDot = { normal: 'ok', 'perlu-perbaikan': 'warn', rusak: 'er' }
  const s = (k, v) => setF(p => ({ ...p, [k]: v }))

  const save = async () => {
    const lid = await InspService.add({ ...f, unit_lid: unit.lid, hourAtInspection: parseFloat(f.hourAtInspection) || 0, results: JSON.stringify(results), overallResult: overall })
    for (const ph of photos) await PhotoService.add('inspeksi', lid, ph.dataUrl)
    onSuccess()
  }

  return (
    <ModalShell title={`Inspeksi — ${unit?.name}`} icon="bi-clipboard2-check-fill" onClose={onClose}
      footer={<>
        <button className="btn btn-primary btn-full" onClick={save}><i className="bi bi-clipboard2-check" /> Simpan Inspeksi</button>
        <button className="btn btn-secondary" onClick={onClose}>Batal</button>
      </>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Tanggal</label><input type="date" className="form-input" value={f.date} onChange={e => s('date', e.target.value)} /></div>
        <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Jam Meter</label><input type="number" className="form-input" value={f.hourAtInspection} onChange={e => s('hourAtInspection', e.target.value)} inputMode="numeric" /></div>
      </div>
      <div style={{ border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
        {CHECKLIST.map((item, i) => (
          <div key={i} className="check-row" style={{ padding: '8px 12px' }}>
            <span className="check-label" style={{ fontSize: 12.5 }}>{item}</span>
            <div className="check-btns">
              {[['ok', '✓', 'chk-ok'], ['warn', '⚠', 'chk-warn'], ['bad', '✗', 'chk-bad']].map(([v, l, cls]) => (
                <button key={v} className={`chk-btn ${cls} ${results[i] === v ? 'sel' : ''}`} onClick={() => setResults(r => ({ ...r, [i]: v }))}>{l}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: rc[overall] + '18', border: `1.5px solid ${rc[overall]}40`, borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
        <StatusDot status={overallDot[overall]} label={overallLabel[overall]} />
      </div>
      <div className="form-group"><label className="form-label">Catatan</label><textarea className="form-input" value={f.note} onChange={e => s('note', e.target.value)} placeholder="Temuan, rekomendasi..." /></div>
      <div className="form-group"><label className="form-label"><i className="bi bi-camera-fill" /> Foto Kondisi</label><PhotoUploader photos={photos} setPhotos={setPhotos} /></div>
    </ModalShell>
  )
}

// ── UNIT ROW CARD ─────────────────────────────────────────────────
function UnitRow({ unit, onAddHours, onService, onInspeksi, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const os = getOpStatus(unit)
  const ms = getMaintStatus(unit)
  const is = getInspStatus(unit)

  const scfg = {
    sehat:   { ico: 'bi-check-circle-fill',  bg: 'rgba(76,175,130,.1)',  clr: 'var(--ok)', lbl: 'SEHAT' },
    hampir:  { ico: 'bi-exclamation-triangle-fill', bg: 'rgba(245,166,35,.1)', clr: 'var(--wn)', lbl: 'HAMPIR' },
    overdue: { ico: 'bi-x-octagon-fill',     bg: 'rgba(224,82,82,.1)',   clr: 'var(--er)', lbl: 'OVERDUE' },
  }
  const cfg = scfg[os] || scfg.sehat
  const statusColors = { aktif: '#4CAF82', rusak: 'var(--er)', maintenance: 'var(--wn)', standby: 'var(--in)' }
  const stDot = { overdue: 'er', 'due-soon': 'warn', ok: 'ok' }

  return (
    <div className={`card ${os === 'overdue' ? 'unit-overdue' : os === 'hampir' ? 'unit-hampir' : ''}`}
      style={{ padding: 0, marginBottom: 8, border: '1.5px solid var(--bd)', overflow: 'hidden' }}>
      {/* Header row */}
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', cursor: 'pointer', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: cfg.bg, color: cfg.clr, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className={`bi ${cfg.ico}`} style={{ fontSize: 16 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unit.name}</div>
          <div style={{ fontSize: 11, color: 'var(--mu)', display: 'flex', gap: 6, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
            {unit.category && <span>{unit.category}</span>}
            {unit.kodeUnit && <span style={{ background: 'rgba(119,85,55,.09)', color: 'var(--pr)', padding: '1px 5px', borderRadius: 4, fontSize: 9.5, fontWeight: 700 }}>{unit.kodeUnit}</span>}
            {unit.location && <span><i className="bi bi-geo-alt-fill" style={{ fontSize: 9 }} /> {unit.location}</span>}
            <span style={{ background: statusColors[unit.status] + '18', color: statusColors[unit.status], padding: '1px 6px', borderRadius: 10, fontSize: 9.5, fontWeight: 700 }}>
              {unit.status || 'Aktif'}
            </span>
            {!unit.synced && <span style={{ fontSize: 9.5, color: 'var(--wn)', fontWeight: 600 }}><i className="bi bi-hourglass-split" /> pending</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 6 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, lineHeight: 1 }}>
            {numF(unit.totalHours)}<span style={{ fontSize: 10.5, fontWeight: 400, color: 'var(--mu)' }}> h</span>
          </div>
          <div style={{ fontSize: 10.5, color: cfg.clr, fontWeight: 700, marginTop: 2 }}>{cfg.lbl}</div>
        </div>
        <i className={`bi bi-chevron-${open ? 'up' : 'down'}`} style={{ color: 'var(--mu)', fontSize: 12 }} />
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="unit-expand" style={{ padding: '0 14px 14px', borderTop: '1px solid var(--bd)' }}>
          {/* Maintenance progress bars */}
          <div style={{ marginBottom: 12, paddingTop: 10 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--mu)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: .6 }}>Jadwal Maintenance</div>
            {ms.map(m => (
              <div key={m.t} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3, gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600 }}>{m.l} <span style={{ color: 'var(--mu)', fontWeight: 400 }}>({numF(m.interval)}h)</span></span>
                  <StatusDot status={stDot[m.st]} label={`${m.st === 'overdue' ? 'Overdue' : m.st === 'due-soon' ? 'Segera' : 'OK'} — ${Math.abs(m.diff)}h ${m.diff < 0 ? 'lewat' : 'lagi'}`} />
                </div>
                <div style={{ height: 5, background: 'var(--bd)', borderRadius: 3 }}>
                  <div className="prog-bar-animated" style={{ height: '100%', width: `${m.pct}%`, background: m.pct > 85 ? 'var(--er)' : m.pct > 70 ? 'var(--wn)' : 'var(--ok)', borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Inspeksi status */}
          <div style={{ marginBottom: 10, padding: '7px 10px', background: 'rgba(74,144,217,.06)', borderRadius: 7, border: '1px solid rgba(74,144,217,.14)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#1a5fa8' }}>
              <i className="bi bi-clipboard2-check" style={{ marginRight: 5 }} />Inspeksi:
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <StatusDot status={stDot[is]} label={is === 'overdue' ? 'Terlambat' : is === 'due-soon' ? 'Segera' : 'OK'} />
              {unit.lastInspectionDate && <span style={{ fontSize: 10, color: 'var(--mu)' }}>Terakhir: {unit.lastInspectionDate}</span>}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={() => onAddHours(unit)}>
              <i className="bi bi-plus-circle" /> Jam
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => onService(unit)}>
              <i className="bi bi-tools" /> Service
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => onInspeksi(unit)}>
              <i className="bi bi-clipboard2-check" /> Inspeksi
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => onEdit(unit)}>
              <i className="bi bi-pencil" /> Edit
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(unit)} aria-label="Hapus">
              <i className="bi bi-trash3" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── UNIT LIST PAGE (reusable untuk Kendaraan & Mesin) ─────────────
function UnitListPage({ unitType }) {
  const [units, setUnits] = useState([])
  const [filter, setFilter] = useState('all')
  const [M, setM] = useState({})
  const [confirm, setConfirm] = useState(null)
  const [msg, showMsg] = useToast()
  const setModal = (k, v) => setM(m => ({ ...m, [k]: v }))

  const label = unitType === 'vehicle' ? 'Kendaraan' : 'Mesin Produksi'
  const icon  = unitType === 'vehicle' ? 'bi-truck-front-fill' : 'bi-gear-wide-connected'

  const load = useCallback(async () => {
    const all = await UnitService.getAll()
    setUnits(all.filter(u => u.type === unitType))
  }, [unitType])

  useEffect(() => { load() }, [load])

  const FILTERS = [
    { value: 'all', label: 'Semua' }, { value: 'sehat', label: 'Sehat' }, { value: 'hampir', label: 'Hampir' },
    { value: 'overdue', label: 'Overdue' }, { value: 'rusak', label: 'Rusak' }, { value: 'maintenance', label: 'Maintenance' },
  ]

  const filtered = units.filter(u => {
    if (filter === 'all') return true
    if (['sehat', 'hampir', 'overdue'].includes(filter)) return getOpStatus(u) === filter
    return u.status === filter
  })

  const counts = {
    sehat:   units.filter(u => getOpStatus(u) === 'sehat').length,
    hampir:  units.filter(u => getOpStatus(u) === 'hampir').length,
    overdue: units.filter(u => getOpStatus(u) === 'overdue').length,
  }

  return (
    <>
      <Toast msg={msg} />

      <div className="page-enter">
        <PageHeader icon={icon} title={label} subtitle={`${units.length} unit terdaftar`}
          action={<button className="btn btn-primary btn-sm" onClick={() => setModal('add', true)}><i className="bi bi-plus-lg" /> Tambah</button>} />

        {/* Stats */}
        <div className="stat-grid stagger">
          {[
            { l: 'Total', v: units.length, c: 'var(--pr)', bg: 'rgba(119,85,55,.08)' },
            { l: 'Sehat', v: counts.sehat, c: 'var(--ok)', bg: 'rgba(76,175,130,.07)' },
            { l: 'Hampir', v: counts.hampir, c: 'var(--wn)', bg: 'rgba(245,166,35,.07)' },
            { l: 'Overdue', v: counts.overdue, c: 'var(--er)', bg: 'rgba(224,82,82,.07)' },
          ].map(x => (
            <div key={x.l} className="stat-card" style={{ background: x.bg }}>
              <div className="stat-val" style={{ color: x.c }}>{x.v}</div>
              <div className="stat-label">{x.l}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <FilterPills options={FILTERS} value={filter} onChange={setFilter} />

        {/* Alerts */}
        {counts.overdue > 0 && <div className="alert alert-error"><i className="bi bi-exclamation-octagon-fill" />{counts.overdue} unit melewati batas maintenance!</div>}
        {counts.hampir > 0 && <div className="alert alert-warn"><i className="bi bi-exclamation-triangle-fill" />{counts.hampir} unit mendekati jadwal maintenance.</div>}

        {/* Unit list */}
        {filtered.length === 0 ? (
          <EmptyState icon={icon} text={`Belum ada ${label.toLowerCase()}`}>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setModal('add', true)}>
              <i className="bi bi-plus-circle" /> Tambah Sekarang
            </button>
          </EmptyState>
        ) : (
          filtered.map(u => (
            <UnitRow key={u.lid} unit={u}
              onAddHours={u => setModal('ah', u)}
              onService={u => setModal('sv', u)}
              onInspeksi={u => setModal('in', u)}
              onEdit={u => setModal('ed', u)}
              onDelete={u => setConfirm(u)}
            />
          ))
        )}
      </div>

      {/* SEMUA MODAL SEKARANG BEBAS DARI JEBAKAN ANIMASI */}
      {M.add && <UnitModal unitType={unitType} onClose={() => setModal('add', false)} onSuccess={() => { setModal('add', false); showMsg(`${label} ditambahkan!`); load() }} />}
      {M.ed  && <UnitModal existing={M.ed} onClose={() => setModal('ed', null)} onSuccess={() => { setModal('ed', null); showMsg('Unit diperbarui!'); load() }} />}
      {M.ah  && <AddHoursModal unit={M.ah} onClose={() => setModal('ah', null)} onSuccess={() => { setModal('ah', null); showMsg(`Jam operasi diperbarui!`); load() }} />}
      {M.sv  && <QuickServiceModal unit={M.sv} onClose={() => setModal('sv', null)} onSuccess={() => { setModal('sv', null); showMsg('Service dicatat!'); load() }} />}
      {M.in  && <QuickInspModal unit={M.in} onClose={() => setModal('in', null)} onSuccess={() => { setModal('in', null); showMsg('Inspeksi disimpan!'); load() }} />}
      {confirm && (
        <ConfirmModal
          msg={`Hapus "${confirm.name}"? Semua data terkait akan ikut terhapus.`}
          onConfirm={async () => { await UnitService.delete(confirm.lid); showMsg('Unit dihapus'); setConfirm(null); load() }}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  )
}

export function KendaraanPage() { return <UnitListPage unitType="vehicle" /> }
export function MesinPage() { return <UnitListPage unitType="machine" /> }
