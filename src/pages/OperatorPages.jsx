import { useState, useEffect, useCallback } from 'react'
import dayjs from 'dayjs'
import { UnitService, SolarService, InspService, StockService, PhotoService, RitaseService } from '../services/dataServices'
import { ConfirmModal, PhotoUploader, PhotoThumb, useToast, Toast, SectionHeader, EmptyState, ExportRow, PageHeader, ModalShell, DataList, StatusDot } from '../components/UI'
import { exportSolarLog, exportInspeksiLog } from '../services/exportService'
import { useAuth } from '../hooks/useAuth'

const today = () => dayjs().format('YYYY-MM-DD')
const rp = n => `Rp ${Math.round(n||0).toLocaleString('id-ID')}`
const fmtD = d => dayjs(d).format('DD MMM')

const CHECKLIST = [
  'Mesin / Engine', 'Sistem Pendingin', 'Oli & Pelumas', 'Ban / Track',
  'Rem & Kopling', 'Lampu & Elektrikal', 'Kabin & Kaca', 'Sistem Hidraulik',
  'Filter Udara & Bahan Bakar', 'Kondisi Body / Frame',
]

// Kartu pilih unit — dipakai Solar/Inspeksi/Ritase
function UnitPickButton({ unit, onClick, warn, sub, extra }) {
  return (
    <button onClick={onClick} style={{
      background: '#fff', border: `1.5px solid ${warn ? 'var(--wn)' : 'var(--bd)'}`,
      borderRadius: 10, padding: 12, minHeight: 'var(--tap)', textAlign: 'left', cursor: 'pointer',
      boxShadow: 'var(--sh)', fontFamily: 'DM Sans, sans-serif',
    }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{unit.name}</div>
      <div style={{ fontSize: 11, color: warn ? 'var(--wn)' : 'var(--mu)' }}>{sub}</div>
      {extra}
    </button>
  )
}

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
    <ModalShell title={`Input Solar — ${unit?.name}`} icon="bi-fuel-pump-fill" onClose={onClose}
      footer={<>
        <button className="btn btn-primary btn-full" onClick={save} disabled={!f.liters}>
          <i className="bi bi-floppy-fill" /> Simpan Solar
        </button>
        <button className="btn btn-secondary" onClick={onClose}>Batal</button>
      </>}>
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
    </ModalShell>
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
  const unitName = l => units.find(u => u.lid === l.unit_lid)?.name || '-'

  return (
    <>
      <Toast msg={msg} />
      <div className="page-enter">
        <PageHeader icon="bi-fuel-pump-fill" title="Input Solar" subtitle="Catat pengisian BBM per unit"
          action={<ExportRow options={[{ label: 'Export Excel', icon: 'bi-file-earmark-excel', action: () => exportSolarLog() }]} />} />

        <div className="stat-grid">
          <div className="stat-card"><div className="stat-val" style={{ color: '#b3700a' }}>{totalLiter.toLocaleString('id-ID')}</div><div className="stat-label">Total Liter (semua)</div></div>
          <div className="stat-card"><div className="stat-val" style={{ fontSize: 15, color: 'var(--pr)' }}>{rp(totalRp)}</div><div className="stat-label">Total Biaya</div></div>
        </div>

        <SectionHeader title="Pilih Unit" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 16 }}>
          {units.map(u => <UnitPickButton key={u.lid} unit={u} onClick={() => setModal(u)} sub={u.type} />)}
        </div>

        <SectionHeader title={`Riwayat Solar (${logs.length})`} />
        {logs.length === 0 ? <EmptyState icon="bi-fuel-pump" text="Belum ada data solar" /> : (
          <div className="card" style={{ padding: '4px 14px' }}>
            <DataList
              rows={logs}
              rowKey={l => l.lid}
              columns={[
                { label: 'Tgl', render: l => l.date },
                { label: 'Unit', render: l => <span style={{ fontWeight: 600 }}>{unitName(l)}</span> },
                { label: 'Liter', render: l => `${(l.liters||0).toLocaleString('id-ID')} L` },
                { label: 'Total', render: l => <span style={{ fontWeight: 600 }}>{rp((l.liters||0)*(l.pricePerLiter||0))}</span> },
                { label: 'Operator', render: l => <span style={{ fontSize: 11, color: 'var(--mu)' }}>{l.operatorName || '-'}</span> },
              ]}
              card={l => ({
                title: unitName(l),
                meta: `${fmtD(l.date)} · ${l.operatorName || '-'}`,
                val: `${(l.liters||0).toLocaleString('id-ID')} L`,
                valSub: rp((l.liters||0)*(l.pricePerLiter||0)),
              })}
              actions={l => <button className="btn-icon" onClick={() => setConfirm(l)} aria-label="Hapus"><i className="bi bi-trash3" /></button>}
            />
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
  const overallLabel = { normal: 'Normal', 'perlu-perbaikan': 'Perlu Perbaikan', rusak: 'Rusak / Kritis' }
  const overallDot = { normal: 'ok', 'perlu-perbaikan': 'warn', rusak: 'er' }

  const save = async () => {
    setSaving(true)
    const lid = await InspService.add({ ...f, unit_lid: unit.lid, hourAtInspection: parseFloat(f.hourAtInspection)||0, results: JSON.stringify(results), overallResult: overall })
    for (const ph of photos) await PhotoService.add('inspeksi', lid, ph.dataUrl)
    onSuccess()
  }

  return (
    <ModalShell title={`Inspeksi — ${unit?.name}`} icon="bi-clipboard2-check-fill" onClose={onClose}
      footer={<>
        <button className="btn btn-primary btn-full" onClick={save} disabled={saving}>
          <i className="bi bi-clipboard2-check" /> {saving ? 'Menyimpan...' : `Simpan${photos.length > 0 ? ` (${photos.length} foto)` : ''}`}
        </button>
        <button className="btn btn-secondary" onClick={onClose}>Batal</button>
      </>}>
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
      <div style={{ background: rc[overall]+'18', border: `1.5px solid ${rc[overall]}40`, borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
        <StatusDot status={overallDot[overall]} label={`Hasil: ${overallLabel[overall]}`} />
      </div>
      <div className="form-group">
        <label className="form-label">Catatan</label>
        <textarea className="form-input" value={f.note} onChange={e => s('note', e.target.value)} placeholder="Temuan, rekomendasi..." />
      </div>
      <div className="form-group">
        <label className="form-label"><i className="bi bi-camera-fill" /> Foto Kondisi Unit</label>
        <PhotoUploader photos={photos} setPhotos={setPhotos} />
      </div>
    </ModalShell>
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

  const unitName = l => units.find(u => u.lid === l.unit_lid)?.name || '-'
  const badgeCls = { normal: 'badge-ok', 'perlu-perbaikan': 'badge-warn', rusak: 'badge-error' }
  const dotCls = { normal: 'ok', 'perlu-perbaikan': 'warn', rusak: 'er' }

  return (
    <>
      <Toast msg={msg} />
      <div className="page-enter">
        <PageHeader icon="bi-clipboard2-check-fill" title="Inspeksi" subtitle="Checklist kondisi unit berkala"
          action={<ExportRow options={[{ label: 'Export Excel', icon: 'bi-file-earmark-excel', action: () => exportInspeksiLog() }]} />} />

        {dueUnits.length > 0 && <div className="alert alert-warn"><i className="bi bi-clipboard2-x-fill" />{dueUnits.length} unit butuh inspeksi segera</div>}

        <SectionHeader title="Pilih Unit untuk Inspeksi" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 16 }}>
          {units.map(u => {
            const due = dueUnits.some(d => d.lid === u.lid)
            return (
              <UnitPickButton key={u.lid} unit={u} onClick={() => setModal(u)} warn={due}
                sub={u.lastInspectionDate ? `Terakhir: ${u.lastInspectionDate}` : 'Belum pernah inspeksi'} />
            )
          })}
        </div>

        <SectionHeader title={`Riwayat Inspeksi (${logs.length})`} />
        {logs.length === 0 ? <EmptyState icon="bi-clipboard2" text="Belum ada data inspeksi" /> : (
          <>
            {/* Desktop: tabel dengan baris foto */}
            <div className="table-wrap desktop-only">
              <table>
                <thead><tr><th>Tgl</th><th>Unit</th><th>Hasil</th><th>Teknisi</th><th>Catatan</th><th></th></tr></thead>
                <tbody>
                  {logs.map(l => (
                    <FragmentRows key={l.lid} l={l} unitName={unitName} badgeCls={badgeCls} onDelete={() => setConfirm(l)} />
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
                      <div className="list-card-meta">{fmtD(l.date)} · {l.inspectorName || '-'}{l.note ? ` · ${l.note}` : ''}</div>
                    </div>
                    <StatusDot status={dotCls[l.overallResult] || 'in'} label={l.overallResult || '-'} />
                    <div className="list-card-actions">
                      <button className="btn-icon" onClick={() => setConfirm(l)} aria-label="Hapus"><i className="bi bi-trash3" /></button>
                    </div>
                  </div>
                  <div style={{ borderBottom: '1px solid var(--bd)', paddingBottom: 8 }}>
                    <PhotoThumb refType="inspeksi" refLid={l.lid} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {modal && <InspeksiModal unit={modal} onClose={() => setModal(null)} onSuccess={() => { setModal(null); showMsg('Inspeksi disimpan!'); load() }} />}
      {confirm && <ConfirmModal msg="Hapus data inspeksi ini?" onConfirm={async () => { await InspService.delete(confirm.lid); showMsg('Dihapus'); setConfirm(null); load() }} onClose={() => setConfirm(null)} />}
    </>
  )
}

// Baris tabel inspeksi + baris foto di bawahnya (desktop)
function FragmentRows({ l, unitName, badgeCls, onDelete }) {
  return (
    <>
      <tr>
        <td>{l.date}</td>
        <td style={{ fontWeight: 600 }}>{unitName(l)}</td>
        <td><span className={`badge ${badgeCls[l.overallResult] || 'badge-info'}`}>{l.overallResult || '-'}</span></td>
        <td style={{ fontSize: 11 }}>{l.inspectorName || '-'}</td>
        <td style={{ fontSize: 11, color: 'var(--mu)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.note || '-'}</td>
        <td><button className="btn-icon" onClick={onDelete} aria-label="Hapus"><i className="bi bi-trash3" /></button></td>
      </tr>
      <tr>
        <td colSpan={6} style={{ padding: '0 10px 6px' }}><PhotoThumb refType="inspeksi" refLid={l.lid} /></td>
      </tr>
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
    <ModalShell title={`${item ? 'Edit' : 'Tambah'} Spare Part`} icon="bi-boxes" onClose={onClose}
      footer={<>
        <button className="btn btn-primary btn-full" onClick={save} disabled={!f.name || !f.qty}><i className="bi bi-floppy-fill" /> Simpan</button>
        <button className="btn btn-secondary" onClick={onClose}>Batal</button>
      </>}>
      <div className="form-group"><label className="form-label">Nama</label><input className="form-input" value={f.name} onChange={e => s('name', e.target.value)} placeholder="Filter oli, fan belt..." /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
        <div className="form-group"><label className="form-label">Qty</label><input type="number" className="form-input" value={f.qty} onChange={e => s('qty', e.target.value)} inputMode="decimal" /></div>
        <div className="form-group"><label className="form-label">Satuan</label><input className="form-input" value={f.unit} onChange={e => s('unit', e.target.value)} placeholder="pcs" /></div>
      </div>
    </ModalShell>
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
  const statusOf = s => s.qty < 3 ? { cls: 'badge-error', dot: 'er', label: 'Kritis' } : s.qty < 5 ? { cls: 'badge-warn', dot: 'warn', label: 'Menipis' } : { cls: 'badge-ok', dot: 'ok', label: 'Aman' }

  return (
    <>
      <Toast msg={msg} />
      <div className="page-enter">
        <PageHeader icon="bi-boxes" title="Stok Spare Part" subtitle="Persediaan suku cadang"
          action={<button className="btn btn-primary btn-sm" onClick={() => setModal({})}><i className="bi bi-plus-lg" /> Tambah</button>} />

        {low.length > 0 && <div className="alert alert-warn"><i className="bi bi-exclamation-triangle-fill" />{low.length} item stok menipis (&lt;5)</div>}

        {stock.length === 0 ? <EmptyState icon="bi-boxes" text="Belum ada data stok spare part" /> : (
          <div className="card" style={{ padding: '4px 14px' }}>
            <DataList
              rows={stock}
              rowKey={s => s.lid}
              columns={[
                { label: 'Nama Part', render: s => <span style={{ fontWeight: 600 }}>{s.name}</span> },
                { label: 'Qty', render: s => <span style={{ fontWeight: 700, color: s.qty < 3 ? 'var(--er)' : s.qty < 5 ? 'var(--wn)' : 'var(--ok)' }}>{s.qty}</span> },
                { label: 'Satuan', render: s => s.unit || 'pcs' },
                { label: 'Status', render: s => { const st = statusOf(s); return <span className={`badge ${st.cls}`}>{st.label}</span> } },
              ]}
              card={s => {
                const st = statusOf(s)
                return {
                  title: s.name,
                  meta: <StatusDot status={st.dot} label={st.label} />,
                  val: `${s.qty} ${s.unit || 'pcs'}`,
                }
              }}
              actions={s => <>
                <button className="btn-icon" onClick={() => setModal(s)} aria-label="Edit"><i className="bi bi-pencil" /></button>
                <button className="btn-icon" onClick={() => setConfirm(s)} aria-label="Hapus"><i className="bi bi-trash3" /></button>
              </>}
            />
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
    <ModalShell title={`Input Ritase — ${unit?.name}`} icon="bi-truck" onClose={onClose}
      footer={<>
        <button className="btn btn-primary btn-full" onClick={save} disabled={!f.jumlahRitase}>
          <i className="bi bi-floppy-fill" /> Simpan Ritase
        </button>
        <button className="btn btn-secondary" onClick={onClose}>Batal</button>
      </>}>
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
    </ModalShell>
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
  const unitName = l => units.find(u => u.lid === l.unit_lid)?.name || '-'

  return (
    <>
      <Toast msg={msg} />
      <div className="page-enter">
        <PageHeader icon="bi-truck" title="Ritase / Produksi" subtitle="Catatan angkutan & volume harian" />

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
            const uRitase = todayLogs.filter(l => l.unit_lid === u.lid).reduce((a, l) => a + (l.jumlahRitase || 0), 0)
            return (
              <UnitPickButton key={u.lid} unit={u} onClick={() => setModal(u)} sub={u.type}
                extra={uRitase > 0 ? <div style={{ fontSize: 11, color: 'var(--ok)', fontWeight: 600, marginTop: 2 }}>Hari ini: {uRitase} ritase</div> : null} />
            )
          })}
        </div>

        <SectionHeader title={`Riwayat Ritase (${logs.length})`} />
        {logs.length === 0 ? <EmptyState icon="bi-truck" text="Belum ada data ritase" /> : (
          <div className="card" style={{ padding: '4px 14px' }}>
            <DataList
              rows={logs}
              rowKey={l => l.lid}
              columns={[
                { label: 'Tgl', render: l => l.date },
                { label: 'Unit', render: l => <span style={{ fontWeight: 600 }}>{unitName(l)}</span> },
                { label: 'Ritase', render: l => <span style={{ fontWeight: 700, color: 'var(--pr)' }}>{l.jumlahRitase || 0}</span> },
                { label: 'Volume', render: l => `${((l.jumlahRitase || 0) * (l.volumePerRitase || 0)).toLocaleString('id-ID')} m³` },
                { label: 'Operator', render: l => <span style={{ fontSize: 11, color: 'var(--mu)' }}>{l.operatorName || '-'}</span> },
              ]}
              card={l => ({
                title: unitName(l),
                meta: `${fmtD(l.date)} · ${l.operatorName || '-'}`,
                val: `${l.jumlahRitase || 0} ritase`,
                valSub: `${((l.jumlahRitase || 0) * (l.volumePerRitase || 0)).toLocaleString('id-ID')} m³`,
              })}
              actions={l => <button className="btn-icon" onClick={() => setConfirm(l)} aria-label="Hapus"><i className="bi bi-trash3" /></button>}
            />
          </div>
        )}
      </div>

      {modal && <RitaseModal unit={modal} onClose={() => setModal(null)} onSuccess={() => { setModal(null); showMsg('Ritase dicatat!'); load() }} />}
      {confirm && <ConfirmModal msg="Hapus data ritase ini?" onConfirm={async () => { await RitaseService.delete(confirm.lid); showMsg('Dihapus'); setConfirm(null); load() }} onClose={() => setConfirm(null)} />}
    </>
  )
}
