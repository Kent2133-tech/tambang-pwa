import { useState, useEffect, useCallback } from 'react'
import dayjs from 'dayjs'
import { UnitService, SvcService, PhotoService } from '../services/dataServices'
import { ConfirmModal, PhotoUploader, PhotoThumb, useToast, Toast, SectionHeader, EmptyState, ExportRow, PageHeader, ModalShell, StatusDot } from '../components/UI'
import { exportServiceLog } from '../services/exportService'
import { useAuth } from '../hooks/useAuth'

const today = () => dayjs().format('YYYY-MM-DD')
const rp = n => `Rp ${Math.round(n||0).toLocaleString('id-ID')}`
const fmtD = d => dayjs(d).format('DD MMM')

const MT = [
  { t: 'ringan', l: 'Ringan 250h', c: '#4CAF82' },
  { t: 'sedang', l: 'Sedang 1000h', c: '#F5A623' },
  { t: 'besar', l: 'Besar 2000h', c: '#E05252' },
  { t: 'overhaul', l: 'Overhaul 5000h', c: '#775537' },
  { t: 'perbaikan', l: 'Perbaikan', c: '#4A90D9' },
]

function ServiceModal({ unit, onClose, onSuccess }) {
  const { user } = useAuth()
  const [f, setF] = useState({ date: today(), maintenanceType: 'ringan', hourAtService: unit?.totalHours || 0, cost: '', downtimeHours: '', sparePartsUsed: '', note: '', operatorName: user?.name || '' })
  const [photos, setPhotos] = useState([])
  const [saving, setSaving] = useState(false)
  const s = (k, v) => setF(p => ({ ...p, [k]: v }))

  const save = async () => {
    if (!f.date) return
    setSaving(true)
    const lid = await SvcService.add({ ...f, unit_lid: unit.lid, hourAtService: parseFloat(f.hourAtService)||0, cost: parseFloat(f.cost)||0, downtimeHours: parseFloat(f.downtimeHours)||0 })
    for (const ph of photos) await PhotoService.add('service', lid, ph.dataUrl)
    onSuccess()
  }

  return (
    <ModalShell title={`Catat Service — ${unit?.name}`} icon="bi-tools" onClose={onClose}
      footer={<>
        <button className="btn btn-primary btn-full" onClick={save} disabled={saving}>
          <i className="bi bi-floppy-fill" /> {saving ? 'Menyimpan...' : `Simpan${photos.length > 0 ? ` (${photos.length} foto)` : ''}`}
        </button>
        <button className="btn btn-secondary" onClick={onClose}>Batal</button>
      </>}>
      <div className="form-group">
        <label className="form-label">Tipe Maintenance</label>
        <div className="mt-chips">
          {MT.map(m => (
            <button key={m.t} className="mt-chip" onClick={() => s('maintenanceType', m.t)}
              style={{ borderColor: f.maintenanceType === m.t ? m.c : 'var(--bd)', background: f.maintenanceType === m.t ? m.c + '22' : 'transparent', color: f.maintenanceType === m.t ? m.c : 'var(--mu)' }}>
              {m.l}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="form-group">
          <label className="form-label">Tanggal</label>
          <input type="date" className="form-input" value={f.date} onChange={e => s('date', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Jam Meter</label>
          <input type="number" className="form-input" value={f.hourAtService} onChange={e => s('hourAtService', e.target.value)} inputMode="numeric" />
        </div>
        <div className="form-group">
          <label className="form-label">Biaya (Rp)</label>
          <input type="number" className="form-input" value={f.cost} onChange={e => s('cost', e.target.value)} placeholder="0" inputMode="numeric" />
        </div>
        <div className="form-group">
          <label className="form-label">Downtime (jam)</label>
          <input type="number" className="form-input" value={f.downtimeHours} onChange={e => s('downtimeHours', e.target.value)} placeholder="0" inputMode="numeric" />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Spare Part Dipakai</label>
        <input className="form-input" value={f.sparePartsUsed} onChange={e => s('sparePartsUsed', e.target.value)} placeholder="Filter oli, fan belt..." />
      </div>
      <div className="form-group">
        <label className="form-label">Catatan Teknisi</label>
        <textarea className="form-input" value={f.note} onChange={e => s('note', e.target.value)} placeholder="Kondisi, temuan, rekomendasi..." />
      </div>
      <div className="form-group">
        <label className="form-label"><i className="bi bi-camera-fill" /> Foto Kerusakan</label>
        <PhotoUploader photos={photos} setPhotos={setPhotos} />
      </div>
    </ModalShell>
  )
}

export default function ServicePage() {
  const [units, setUnits] = useState([])
  const [logs, setLogs] = useState([])
  const [modal, setModal] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [msg, showMsg] = useToast()

  const load = useCallback(async () => {
    setUnits(await UnitService.getActive())
    setLogs((await SvcService.getAll()).slice(0, 60))
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async () => {
    await SvcService.delete(confirm.lid)
    showMsg('Data dihapus')
    setConfirm(null)
    load()
  }

  const unitName = l => units.find(u => u.lid === l.unit_lid)?.name || '-'

  return (
    <div className="page-enter">
      <Toast msg={msg} />
      <PageHeader icon="bi-tools" title="Service Log" subtitle="Riwayat maintenance semua unit"
        action={<ExportRow options={[{ label: 'Export Excel (semua)', icon: 'bi-file-earmark-excel', action: () => exportServiceLog() }, { label: 'Export bulan ini', icon: 'bi-calendar', action: () => exportServiceLog(dayjs().startOf('month').format('YYYY-MM-DD'), dayjs().endOf('month').format('YYYY-MM-DD')) }]} />} />

      <SectionHeader title="Pilih Unit untuk Input Service" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 16 }}>
        {units.map(u => {
          const st = UnitService.operationalStatus(u)
          const sc = { sehat: 'var(--ok)', hampir: 'var(--wn)', overdue: 'var(--er)' }[st]
          const dot = { sehat: 'ok', hampir: 'warn', overdue: 'er' }[st]
          const label = { sehat: 'Sehat', hampir: 'Hampir', overdue: 'Overdue' }[st]
          return (
            <button key={u.lid} onClick={() => setModal(u)} style={{ background: '#fff', border: `2px solid ${sc}22`, borderRadius: 10, padding: 12, minHeight: 'var(--tap)', textAlign: 'left', cursor: 'pointer', boxShadow: 'var(--sh)', fontFamily: 'DM Sans, sans-serif' }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{u.name}</div>
              <StatusDot status={dot} label={label} />
              <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 2 }}>{u.totalHours || 0} jam</div>
            </button>
          )
        })}
      </div>

      <SectionHeader title={`Riwayat Service (${logs.length})`} />
      {logs.length === 0 ? <EmptyState icon="bi-tools" text="Belum ada data service" /> : (
        <>
          {/* Desktop: tabel dengan baris foto */}
          <div className="table-wrap desktop-only">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th><th>Unit</th><th>Tipe</th><th>Biaya</th><th>Catatan</th><th></th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <ServiceRows key={l.lid} l={l} unitName={unitName} onDelete={() => setConfirm(l)} />
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile: kartu */}
          <div className="mobile-only card" style={{ padding: '4px 14px' }}>
            {logs.map(l => (
              <div key={l.lid}>
                <div className="list-card" style={{ borderBottom: 'none', paddingBottom: 4 }}>
                  <div className="list-card-main">
                    <div className="list-card-title">{unitName(l)}</div>
                    <div className="list-card-meta">{fmtD(l.date)} · <span className="badge badge-info">{l.maintenanceType}</span>{l.note ? ` · ${l.note}` : ''}</div>
                  </div>
                  <div className="list-card-val">{rp(l.cost)}</div>
                  <div className="list-card-actions">
                    <button className="btn-icon" onClick={() => setConfirm(l)} aria-label="Hapus"><i className="bi bi-trash3" /></button>
                  </div>
                </div>
                <div style={{ borderBottom: '1px solid var(--bd)', paddingBottom: 8 }}>
                  <PhotoThumb refType="service" refLid={l.lid} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {modal && <ServiceModal unit={modal} onClose={() => setModal(null)} onSuccess={() => { setModal(null); showMsg('Service dicatat!'); load() }} />}
      {confirm && <ConfirmModal msg="Hapus data service ini?" onConfirm={handleDelete} onClose={() => setConfirm(null)} />}
    </div>
  )
}

// Baris tabel service + baris foto di bawahnya (desktop)
function ServiceRows({ l, unitName, onDelete }) {
  return (
    <>
      <tr>
        <td style={{ whiteSpace: 'nowrap' }}>{l.date}</td>
        <td style={{ fontWeight: 600 }}>{unitName(l)}</td>
        <td><span className="badge badge-info">{l.maintenanceType}</span></td>
        <td style={{ fontWeight: 600 }}>{rp(l.cost)}</td>
        <td style={{ fontSize: 11, color: 'var(--mu)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.note || '-'}</td>
        <td><button className="btn-icon" onClick={onDelete} aria-label="Hapus"><i className="bi bi-trash3" /></button></td>
      </tr>
      <tr>
        <td colSpan={6} style={{ padding: '0 10px 6px' }}><PhotoThumb refType="service" refLid={l.lid} /></td>
      </tr>
    </>
  )
}
