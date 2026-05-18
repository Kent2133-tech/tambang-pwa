import { useState, useEffect, useCallback } from 'react'
import dayjs from 'dayjs'
import { UnitService, SolarService, InspService, StockService, PhotoService, RitaseService } from '../services/dataServices'
import { ConfirmModal, PhotoUploader, PhotoThumb, useToast, Toast, SectionHeader, EmptyState, ExportRow } from '../components/UI'
import { exportSolarLog, exportInspeksiLog } from '../services/exportService'
import { useAuth } from '../hooks/useAuth'

const today = () => dayjs().format('YYYY-MM-DD')
const rp = n => `Rp ${Math.round(n||0).toLocaleString('id-ID')}`

const CHECKLIST = [
  'Mesin / Engine', 'Sistem Pendingin', 'Oli & Pelumas', 'Ban / Track',
  'Rem & Kopling', 'Lampu & Elektrikal', 'Kabin & Kaca', 'Sistem Hidraulik',
  'Filter Udara & Bahan Bakar', 'Kondisi Body / Frame',
]

// ── SOLAR PAGE ────────────────────────────────────────────────────
function SolarModal({ unit, onClose, onSuccess }) {
  const { user } = useAuth()
  const [f, setF] = useState({ date: today(), liters: '', pricePerLiter: 9800, note: '', operatorName: user?.name || '' })
  const s = (k, v) => setF(p => ({ ...p, [k]: v }))

  const save = async () => {
    await SolarService.add({ ...f, unit_lid: unit.lid, liters: parseFloat(f.liters)||0, pricePerLiter: parseFloat(f.pricePerLiter)||0 })
    onSuccess()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:16 }}>⛽ Input Solar — {unit?.name}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'var(--mu)', padding:'0 4px', lineHeight:1 }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="form-group">
            <label className="form-label">Tanggal</label>
            <input type="date" className="form-input" value={f.date} onChange={e => s('date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Liter</label>
            <input type="number" className="form-input" value={f.liters} onChange={e => s('liters', e.target.value)} placeholder="0" inputMode="decimal" />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Harga / Liter (Rp)</label>
            <input type="number" className="form-input" value={f.pricePerLiter} onChange={e => s('pricePerLiter', e.target.value)} inputMode="numeric" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Catatan</label>
          <input className="form-input" value={f.note} onChange={e => s('note', e.target.value)} placeholder="Opsional..." />
        </div>
        {f.liters > 0 && (
          <div className="alert alert-info" style={{ marginBottom: 12 }}>
            Total: <strong>{rp((parseFloat(f.liters)||0) * (parseFloat(f.pricePerLiter)||0))}</strong>
          </div>
        )}
        <div className="modal-footer">
          <button className="btn btn-primary btn-full" onClick={save} disabled={!f.liters}>
            <i className="bi bi-floppy-fill" /> Simpan Solar
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
  )
}

export function SolarPage() {
  const [units, setUnits] = useState([])
  const [logs, setLogs] = useState([])
  const [modal, setModal] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [msg, showMsg] = useToast()

  const load = useCallback(async () => {
    setUnits(await UnitService.getActive())
    setLogs((await SolarService.getAll()).slice(0, 60))
  }, [])

  useEffect(() => { load() }, [load])

  const totalLiter = logs.reduce((a, l) => a + (l.liters||0), 0)
  const totalRp = logs.reduce((a, l) => a + (l.liters||0)*(l.pricePerLiter||0), 0)

  return (
    <>
      <Toast msg={msg} />
      <div className="page-enter">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 18 }}>⛽ Input Solar</div>
          <ExportRow options={[{ label: 'Export Excel', icon: 'bi-file-earmark-excel', action: () => exportSolarLog() }]} />
        </div>

        <div className="stat-grid">
          <div className="stat-card"><div className="stat-val" style={{ color: '#b3700a' }}>{totalLiter.toLocaleString('id-ID')}</div><div className="stat-label">Total Liter (semua)</div></div>
          <div className="stat-card"><div className="stat-val" style={{ fontSize: 15, color: 'var(--pr)' }}>{rp(totalRp)}</div><div className="stat-label">Total Biaya</div></div>
        </div>

        <SectionHeader title="Pilih Unit" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 16 }}>
          {units.map(u => (
            <button key={u.lid} onClick={() => setModal(u)} style={{ background: '#fff', border: '1.5px solid var(--bd)', borderRadius: 10, padding: 12, textAlign: 'left', cursor: 'pointer', boxShadow: 'var(--sh)' }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{u.name}</div>
              <div style={{ fontSize: 10, color: 'var(--mu)' }}>{u.type}</div>
            </button>
          ))}
        </div>

        <SectionHeader title={`Riwayat Solar (${logs.length})`} />
        {logs.length === 0 ? <EmptyState icon="bi-fuel-pump" text="Belum ada data solar" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tgl</th><th>Unit</th><th>Liter</th><th>Total</th><th>Operator</th><th></th></tr></thead>
              <tbody>
                {logs.map(l => {
                  const unit = units.find(u => u.lid === l.unit_lid)
                  return (
                    <tr key={l.lid}>
                      <td>{l.date}</td>
                      <td style={{ fontWeight: 600 }}>{unit?.name || '-'}</td>
                      <td>{(l.liters||0).toLocaleString('id-ID')} L</td>
                      <td style={{ fontWeight: 600 }}>{rp((l.liters||0)*(l.pricePerLiter||0))}</td>
                      <td style={{ fontSize: 11, color: 'var(--mu)' }}>{l.operatorName || '-'}</td>
                      <td><button className="btn-icon btn-sm" onClick={() => setConfirm(l)}><i className="bi bi-trash3" /></button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <SolarModal unit={modal} onClose={() => setModal(null)} onSuccess={() => { setModal(null); showMsg('Solar dicatat!'); load() }} />}
      {confirm && <ConfirmModal msg="Hapus data solar ini?" onConfirm={async () => { await SolarService.delete(confirm.lid); showMsg('Dihapus'); setConfirm(null); load() }} onClose={() => setConfirm(null)} />}
    </>
  )
}

// ── INSPEKSI PAGE ─────────────────────────────────────────────────
function InspeksiModal({ unit, onClose, onSuccess }) {
  const { user } = useAuth()
  const [f, setF] = useState({ date: today(), hourAtInspection: unit?.totalHours || 0, inspectorName: user?.name || '', note: '' })
  const [results, setResults] = useState(() => Object.fromEntries(CHECKLIST.map((_, i) => [i, 'ok'])))
  const [photos, setPhotos] = useState([])
  const [saving, setSaving] = useState(false)
  const s = (k, v) => setF(p => ({ ...p, [k]: v }))
  const overall = Object.values(results).includes('bad') ? 'rusak' : Object.values(results).includes('warn') ? 'perlu-perbaikan' : 'normal'
  const rc = { normal: 'var(--ok)', 'perlu-perbaikan': 'var(--wn)', rusak: 'var(--er)' }

  const save = async () => {
    setSaving(true)
    const lid = await InspService.add({ ...f, unit_lid: unit.lid, hourAtInspection: parseFloat(f.hourAtInspection)||0, results: JSON.stringify(results), overallResult: overall })
    for (const ph of photos) await PhotoService.add('inspeksi', lid, ph.dataUrl)
    onSuccess()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:16 }}>📋 Inspeksi — {unit?.name}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'var(--mu)', padding:'0 4px', lineHeight:1 }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="form-group">
            <label className="form-label">Tanggal</label>
            <input type="date" className="form-input" value={f.date} onChange={e => s('date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Jam Meter</label>
            <input type="number" className="form-input" value={f.hourAtInspection} onChange={e => s('hourAtInspection', e.target.value)} inputMode="numeric" />
          </div>
        </div>
        <div style={{ border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
          {CHECKLIST.map((item, i) => (
            <div key={i} className="check-row" style={{ padding: '8px 12px' }}>
              <span className="check-label">{item}</span>
              <div className="check-btns">
                {[['ok','✓','chk-ok'],['warn','⚠','chk-warn'],['bad','✗','chk-bad']].map(([v,l,cls]) => (
                  <button key={v} className={`chk-btn ${cls} ${results[i]===v?'sel':''}`} onClick={() => setResults(r => ({...r,[i]:v}))}>{l}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: rc[overall]+'18', border: `1.5px solid ${rc[overall]}40`, borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: rc[overall] }}>
            Hasil: {overall==='normal'?'🟢 Normal':overall==='perlu-perbaikan'?'🟡 Perlu Perbaikan':'🔴 Rusak/Kritis'}
          </span>
        </div>
        <div className="form-group">
          <label className="form-label">Catatan</label>
          <textarea className="form-input" value={f.note} onChange={e => s('note', e.target.value)} placeholder="Temuan, rekomendasi..." />
        </div>
        <div className="form-group">
          <label className="form-label">📷 Foto Kondisi Unit</label>
          <PhotoUploader photos={photos} setPhotos={setPhotos} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary btn-full" onClick={save} disabled={saving}>
            <i className="bi bi-clipboard2-check" /> {saving ? 'Menyimpan...' : `Simpan${photos.length > 0 ? ` (${photos.length} foto)` : ''}`}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
  )
}

export function InspeksiPage() {
  const [units, setUnits] = useState([])
  const [logs, setLogs] = useState([])
  const [modal, setModal] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [msg, showMsg] = useToast()

  const load = useCallback(async () => {
    setUnits(await UnitService.getActive())
    setLogs((await InspService.getAll()).slice(0, 40))
  }, [])

  useEffect(() => { load() }, [load])

  const dueUnits = units.filter(u => {
    if (!u.lastInspectionDate) return true
    const diff = dayjs().diff(dayjs(u.lastInspectionDate), 'day')
    return diff >= (u.inspectionIntervalDays || 30)
  })

  return (
    <>
      <Toast msg={msg} />
      <div className="page-enter">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 18 }}>📋 Inspeksi</div>
          <ExportRow options={[{ label: 'Export Excel', icon: 'bi-file-earmark-excel', action: () => exportInspeksiLog() }]} />
        </div>

        {dueUnits.length > 0 && <div className="alert alert-warn"><i className="bi bi-clipboard2-x-fill" />{dueUnits.length} unit butuh inspeksi segera</div>}

        <SectionHeader title="Pilih Unit untuk Inspeksi" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 16 }}>
          {units.map(u => {
            const due = dueUnits.find(d => d.lid === u.lid)
            return (
              <button key={u.lid} onClick={() => setModal(u)} style={{ background: '#fff', border: `2px solid ${due ? 'var(--wn)' : 'var(--bd)'}`, borderRadius: 10, padding: 12, textAlign: 'left', cursor: 'pointer', boxShadow: 'var(--sh)' }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{u.name}</div>
                <div style={{ fontSize: 10, color: due ? 'var(--wn)' : 'var(--mu)' }}>
                  {u.lastInspectionDate ? `Terakhir: ${u.lastInspectionDate}` : 'Belum pernah inspeksi'}
                </div>
              </button>
            )
          })}
        </div>

        <SectionHeader title={`Riwayat Inspeksi (${logs.length})`} />
        {logs.length === 0 ? <EmptyState icon="bi-clipboard2" text="Belum ada data inspeksi" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tgl</th><th>Unit</th><th>Hasil</th><th>Teknisi</th><th>Catatan</th><th></th></tr></thead>
              <tbody>
                {logs.map(l => {
                  const unit = units.find(u => u.lid === l.unit_lid)
                  const rc = { normal: 'badge-ok', 'perlu-perbaikan': 'badge-warn', rusak: 'badge-error' }
                  return (
                    <>
                      <tr key={l.lid}>
                        <td>{l.date}</td>
                        <td style={{ fontWeight: 600 }}>{unit?.name || '-'}</td>
                        <td><span className={`badge ${rc[l.overallResult] || 'badge-info'}`}>{l.overallResult || '-'}</span></td>
                        <td style={{ fontSize: 11 }}>{l.inspectorName || '-'}</td>
                        <td style={{ fontSize: 11, color: 'var(--mu)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.note || '-'}</td>
                        <td><button className="btn-icon btn-sm" onClick={() => setConfirm(l)}><i className="bi bi-trash3" /></button></td>
                      </tr>
                      <tr key={`ph-${l.lid}`}>
                        <td colSpan={6} style={{ padding: '0 10px 6px' }}><PhotoThumb refType="inspeksi" refLid={l.lid} /></td>
                      </tr>
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <InspeksiModal unit={modal} onClose={() => setModal(null)} onSuccess={() => { setModal(null); showMsg('Inspeksi disimpan!'); load() }} />}
      {confirm && <ConfirmModal msg="Hapus data inspeksi ini?" onConfirm={async () => { await InspService.delete(confirm.lid); showMsg('Dihapus'); setConfirm(null); load() }} onClose={() => setConfirm(null)} />}
    </>
  )
}

// ── SPARE STOCK PAGE ──────────────────────────────────────────────
function SpareModal({ item, onClose, onSuccess }) {
  const [f, setF] = useState(item || { name: '', qty: '', unit: 'pcs' })
  const s = (k, v) => setF(p => ({ ...p, [k]: v }))

  const save = async () => {
    if (item?.lid) await StockService.update(item.lid, { name: f.name, qty: parseFloat(f.qty)||0, unit: f.unit })
    else await StockService.add({ name: f.name, qty: parseFloat(f.qty)||0, unit: f.unit })
    onSuccess()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:16 }}>{item ? 'Edit' : 'Tambah'} Spare Part</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'var(--mu)', padding:'0 4px', lineHeight:1 }}>✕</button>
        </div>
        <div className="form-group"><label className="form-label">Nama</label><input className="form-input" value={f.name} onChange={e => s('name', e.target.value)} placeholder="Filter oli, fan belt..." /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
          <div className="form-group"><label className="form-label">Qty</label><input type="number" className="form-input" value={f.qty} onChange={e => s('qty', e.target.value)} inputMode="decimal" /></div>
          <div className="form-group"><label className="form-label">Satuan</label><input className="form-input" value={f.unit} onChange={e => s('unit', e.target.value)} placeholder="pcs" /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary btn-full" onClick={save} disabled={!f.name || !f.qty}><i className="bi bi-floppy-fill" /> Simpan</button>
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
  )
}

export function SparePage() {
  const [stock, setStock] = useState([])
  const [modal, setModal] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [msg, showMsg] = useToast()

  const load = useCallback(async () => setStock(await StockService.getAll()), [])
  useEffect(() => { load() }, [load])

  const low = stock.filter(s => s.qty < 5)

  return (
    <>
      <Toast msg={msg} />
      <div className="page-enter">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 18 }}>📦 Stok Spare Part</div>
          <button className="btn btn-primary btn-sm" onClick={() => setModal({})}><i className="bi bi-plus-lg" /> Tambah</button>
        </div>

        {low.length > 0 && <div className="alert alert-warn"><i className="bi bi-exclamation-triangle-fill" />{low.length} item stok menipis (&lt;5)</div>}

        {stock.length === 0 ? <EmptyState icon="bi-boxes" text="Belum ada data stok spare part" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nama Part</th><th>Qty</th><th>Satuan</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {stock.map(s => (
                  <tr key={s.lid}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td style={{ fontWeight: 700, color: s.qty < 3 ? 'var(--er)' : s.qty < 5 ? 'var(--wn)' : 'var(--ok)' }}>{s.qty}</td>
                    <td>{s.unit || 'pcs'}</td>
                    <td><span className={`badge ${s.qty < 3 ? 'badge-error' : s.qty < 5 ? 'badge-warn' : 'badge-ok'}`}>{s.qty < 3 ? '🔴 Kritis' : s.qty < 5 ? '⚠️ Menipis' : '✅ Aman'}</span></td>
                    <td style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-icon btn-sm" onClick={() => setModal(s)}><i className="bi bi-pencil" /></button>
                      <button className="btn-icon btn-sm" onClick={() => setConfirm(s)}><i className="bi bi-trash3" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal !== null && <SpareModal item={modal?.lid ? modal : null} onClose={() => setModal(null)} onSuccess={() => { setModal(null); showMsg('Tersimpan!'); load() }} />}
      {confirm && <ConfirmModal msg={`Hapus "${confirm.name}"?`} onConfirm={async () => { await StockService.delete(confirm.lid); showMsg('Dihapus'); setConfirm(null); load() }} onClose={() => setConfirm(null)} />}
    </>
  )
}

// ── RITASE PAGE ───────────────────────────────────────────────────
function RitaseModal({ unit, onClose, onSuccess }) {
  const { user } = useAuth()
  const [f, setF] = useState({ date: today(), jumlahRitase: '', volumePerRitase: 6, note: '', operatorName: user?.name || '' })
  const s = (k, v) => setF(p => ({ ...p, [k]: v }))
  const totalVol = (parseFloat(f.jumlahRitase) || 0) * (parseFloat(f.volumePerRitase) || 0)

  const save = async () => {
    await RitaseService.add({ ...f, unit_lid: unit.lid, jumlahRitase: parseFloat(f.jumlahRitase) || 0, volumePerRitase: parseFloat(f.volumePerRitase) || 0 })
    onSuccess()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:16 }}>🚛 Input Ritase — {unit?.name}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'var(--mu)', padding:'0 4px', lineHeight:1 }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="form-group">
            <label className="form-label">Tanggal</label>
            <input type="date" className="form-input" value={f.date} onChange={e => s('date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Jumlah Ritase</label>
            <input type="number" className="form-input" value={f.jumlahRitase} onChange={e => s('jumlahRitase', e.target.value)} placeholder="0" inputMode="numeric" />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Volume per Ritase (m³)</label>
            <input type="number" className="form-input" value={f.volumePerRitase} onChange={e => s('volumePerRitase', e.target.value)} inputMode="decimal" step="0.5" />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Nama Operator</label>
            <input className="form-input" value={f.operatorName} onChange={e => s('operatorName', e.target.value)} placeholder="Nama operator..." />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Catatan</label>
          <input className="form-input" value={f.note} onChange={e => s('note', e.target.value)} placeholder="Opsional..." />
        </div>
        {totalVol > 0 && (
          <div className="alert alert-info" style={{ marginBottom: 12 }}>
            Total Volume: <strong>{totalVol.toLocaleString('id-ID')} m³</strong>
          </div>
        )}
        <div className="modal-footer">
          <button className="btn btn-primary btn-full" onClick={save} disabled={!f.jumlahRitase}>
            <i className="bi bi-floppy-fill" /> Simpan Ritase
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
  )
}

export function RitasePage() {
  const [units, setUnits] = useState([])
  const [logs, setLogs] = useState([])
  const [modal, setModal] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [msg, showMsg] = useToast()
  const todayStr = today()

  const load = useCallback(async () => {
    setUnits(await UnitService.getActive())
    setLogs((await RitaseService.getAll()).slice(0, 60))
  }, [])

  useEffect(() => { load() }, [load])

  const todayLogs = logs.filter(l => l.date === todayStr)
  const totalRitaseHari = todayLogs.reduce((a, l) => a + (l.jumlahRitase || 0), 0)
  const totalVolHari = todayLogs.reduce((a, l) => a + (l.jumlahRitase || 0) * (l.volumePerRitase || 0), 0)

  return (
    <>
      <Toast msg={msg} />
      <div className="page-enter">
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 18, marginBottom: 14 }}>🚛 Ritase / Produksi</div>

        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-val" style={{ color: 'var(--pr)' }}>{totalRitaseHari}</div>
            <div className="stat-label">Ritase Hari Ini</div>
          </div>
          <div className="stat-card">
            <div className="stat-val" style={{ color: 'var(--ok)', fontSize: 15 }}>{totalVolHari.toLocaleString('id-ID')} m³</div>
            <div className="stat-label">Volume Hari Ini</div>
          </div>
        </div>

        <SectionHeader title="Pilih Unit" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 16 }}>
          {units.map(u => {
            const uLogs = todayLogs.filter(l => l.unit_lid === u.lid)
            const uRitase = uLogs.reduce((a, l) => a + (l.jumlahRitase || 0), 0)
            return (
              <button key={u.lid} onClick={() => setModal(u)} style={{ background: '#fff', border: '1.5px solid var(--bd)', borderRadius: 10, padding: 12, textAlign: 'left', cursor: 'pointer', boxShadow: 'var(--sh)' }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{u.name}</div>
                <div style={{ fontSize: 10, color: 'var(--mu)' }}>{u.type}</div>
                {uRitase > 0 && <div style={{ fontSize: 11, color: 'var(--ok)', fontWeight: 600, marginTop: 2 }}>Hari ini: {uRitase} ritase</div>}
              </button>
            )
          })}
        </div>

        <SectionHeader title={`Riwayat Ritase (${logs.length})`} />
        {logs.length === 0 ? <EmptyState icon="bi-truck" text="Belum ada data ritase" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tgl</th><th>Unit</th><th>Ritase</th><th>Volume</th><th>Operator</th><th></th></tr></thead>
              <tbody>
                {logs.map(l => {
                  const unit = units.find(u => u.lid === l.unit_lid)
                  return (
                    <tr key={l.lid}>
                      <td>{l.date}</td>
                      <td style={{ fontWeight: 600 }}>{unit?.name || '-'}</td>
                      <td style={{ fontWeight: 700, color: 'var(--pr)' }}>{l.jumlahRitase || 0}</td>
                      <td>{((l.jumlahRitase || 0) * (l.volumePerRitase || 0)).toLocaleString('id-ID')} m³</td>
                      <td style={{ fontSize: 11, color: 'var(--mu)' }}>{l.operatorName || '-'}</td>
                      <td><button className="btn-icon btn-sm" onClick={() => setConfirm(l)}><i className="bi bi-trash3" /></button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <RitaseModal unit={modal} onClose={() => setModal(null)} onSuccess={() => { setModal(null); showMsg('Ritase dicatat!'); load() }} />}
      {confirm && <ConfirmModal msg="Hapus data ritase ini?" onConfirm={async () => { await RitaseService.delete(confirm.lid); showMsg('Dihapus'); setConfirm(null); load() }} onClose={() => setConfirm(null)} />}
    </>
  )
}