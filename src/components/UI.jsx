import { useState } from 'react'
import { PhotoService } from '../services/dataServices'

// Satu-satunya sumber warna chart — jangan definisikan array warna di halaman
export const CHART_COLORS = ['#775537', '#F5A623', '#4CAF82', '#4A90D9', '#C0DDDA', '#E05252']

// ── TOAST ────────────────────────────────────────────────────────
export function Toast({ msg, onClose }) {
  if (!msg) return null
  return (
    <div className="toast-anim" style={{ position: 'fixed', bottom: 'calc(var(--bnav-h) + var(--safe-bottom) + 16px)', left: '50%', transform: 'translateX(-50%)', background: '#2C1A0E', color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,.3)', whiteSpace: 'nowrap' }}>
      {msg}
    </div>
  )
}

export function useToast() {
  const [msg, setMsg] = useState(null)
  const show = (m) => { setMsg(m); setTimeout(() => setMsg(null), 2500) }
  return [msg, show]
}

// ── PAGE HEADER ──────────────────────────────────────────────────
export function PageHeader({ icon, title, subtitle, action }) {
  return (
    <div className="page-header">
      {icon && <div className="page-header-icon"><i className={`bi ${icon}`} /></div>}
      <div className="page-header-body">
        <div className="page-header-title">{title}</div>
        {subtitle && <div className="page-header-sub">{subtitle}</div>}
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </div>
  )
}

// ── MODAL SHELL (judul + tombol tutup + footer sticky) ───────────
export function ModalShell({ title, icon, onClose, children, footer, maxWidth }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={maxWidth ? { maxWidth } : undefined} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{icon && <i className={`bi ${icon}`} />}{title}</div>
          <button className="modal-close" onClick={onClose} aria-label="Tutup"><i className="bi bi-x-lg" /></button>
        </div>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

// ── CONFIRM MODAL ────────────────────────────────────────────────
export function ConfirmModal({ msg, onConfirm, onClose }) {
  return (
    <ModalShell title="Konfirmasi" icon="bi-exclamation-triangle" onClose={onClose} maxWidth={360}
      footer={<>
        <button className="btn btn-danger btn-full" onClick={onConfirm}>Ya, Hapus</button>
        <button className="btn btn-secondary" onClick={onClose}>Batal</button>
      </>}>
      <p style={{ fontSize: 14, color: 'var(--mu)' }}>{msg}</p>
    </ModalShell>
  )
}

// ── FILTER PILLS ─────────────────────────────────────────────────
export function FilterPills({ options, value, onChange }) {
  return (
    <div className="filter-pills">
      {options.map(o => {
        const opt = typeof o === 'string' ? { value: o, label: o } : o
        return (
          <button key={opt.value} className={`pill ${value === opt.value ? 'active' : ''}`} onClick={() => onChange(opt.value)}>
            {opt.icon && <i className={`bi ${opt.icon}`} />}{opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ── STATUS DOT (pengganti emoji 🟢🟡🔴) ──────────────────────────
export function StatusDot({ status, label }) {
  return <span className={`status-dot ${status || 'mu'}`}>{label}</span>
}

// ── SKELETON LOADING ─────────────────────────────────────────────
export function Skeleton({ rows = 3, height = 52 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height, marginBottom: 10 }} />
      ))}
    </div>
  )
}

// ── DATA LIST — tabel di laptop, kartu di HP ─────────────────────
// columns: [{ label, render(row) }]  → tabel desktop
// card: (row) => ({ title, meta, val, valSub })  → kartu mobile
// actions: (row) => JSX tombol edit/hapus (opsional, muncul di keduanya)
export function DataList({ columns, rows, card, actions, rowKey }) {
  return (
    <>
      <div className="table-wrap desktop-only">
        <table>
          <thead>
            <tr>
              {columns.map(c => <th key={c.label}>{c.label}</th>)}
              {actions && <th style={{ width: 1 }}></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={rowKey ? rowKey(r) : i}>
                {columns.map(c => <td key={c.label}>{c.render(r)}</td>)}
                {actions && <td><div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>{actions(r)}</div></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-only">
        {rows.map((r, i) => {
          const c = card(r)
          return (
            <div className="list-card" key={rowKey ? rowKey(r) : i}>
              <div className="list-card-main">
                <div className="list-card-title">{c.title}</div>
                {c.meta && <div className="list-card-meta">{c.meta}</div>}
              </div>
              {(c.val || c.valSub) && (
                <div className="list-card-val">{c.val}{c.valSub && <small>{c.valSub}</small>}</div>
              )}
              {actions && <div className="list-card-actions">{actions(r)}</div>}
            </div>
          )
        })}
      </div>
    </>
  )
}

// ── PHOTO UPLOADER ───────────────────────────────────────────────
export function PhotoUploader({ photos, setPhotos }) {
  const handleFile = async (e) => {
    const files = [...e.target.files]
    for (const file of files) {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const compressed = await PhotoService.compress(ev.target.result)
        setPhotos(p => [...p, { dataUrl: compressed }])
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ''
  }

  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', border: '2px dashed var(--bd)', borderRadius: 8, cursor: 'pointer', background: 'rgba(119,85,55,.04)', marginBottom: 8, minHeight: 'var(--tap)' }}>
        <i className="bi bi-camera-fill" style={{ fontSize: 18, color: 'var(--pr)' }} />
        <span style={{ fontSize: 13, color: 'var(--mu)' }}>Ambil / Pilih Foto (bisa lebih dari 1)</span>
        <input type="file" accept="image/*" multiple capture="environment" onChange={handleFile} style={{ display: 'none' }} />
      </label>
      {photos.length > 0 && (
        <div className="photo-grid">
          {photos.map((ph, i) => (
            <div key={i} className="photo-thumb">
              <img src={ph.dataUrl} alt="" />
              <button className="del-btn" onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── PHOTO THUMB (viewer) ─────────────────────────────────────────
export function PhotoThumb({ refType, refLid }) {
  const [photos, setPhotos] = useState([])
  const [viewing, setViewing] = useState(null)

  useState(() => {
    if (refLid) PhotoService.getByRef(refType, refLid).then(setPhotos)
  }, [refType, refLid])

  if (!photos.length) return null
  return (
    <>
      <div className="photo-grid" style={{ marginTop: 6 }}>
        {photos.map((ph, i) => (
          <div key={i} className="photo-thumb" onClick={() => setViewing(ph.dataUrl)}>
            <img src={ph.dataUrl} alt="" />
          </div>
        ))}
      </div>
      {viewing && (
        <div className="photo-viewer" onClick={() => setViewing(null)}>
          <img src={viewing} alt="" />
          <button className="close">✕</button>
        </div>
      )}
    </>
  )
}

// ── SYNC STATUS ──────────────────────────────────────────────────
export function SyncBadge({ online, syncing, lastSync }) {
  if (syncing) return <span className="sync-badge sync-syncing" style={{ animation: 'fadeInFast .2s ease' }}><i className="bi bi-arrow-repeat spin" /> Syncing...</span>
  if (!online) return <span className="sync-badge sync-offline" style={{ animation: 'fadeInFast .2s ease' }}><i className="bi bi-wifi-off" /> Offline</span>
  return <span className="sync-badge sync-online" style={{ animation: 'fadeInFast .2s ease' }}><i className="bi bi-cloud-check" /> Online{lastSync ? ` · ${lastSync.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
}

// ── SECTION HEADER ───────────────────────────────────────────────
export function SectionHeader({ title, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <h6 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{title}</h6>
      {action}
    </div>
  )
}

// ── EMPTY STATE ──────────────────────────────────────────────────
export function EmptyState({ icon, text, children }) {
  return (
    <div className="empty-state">
      <i className={`bi ${icon}`} />
      <p>{text}</p>
      {children}
    </div>
  )
}

// ── EXPORT BUTTON GROUP ──────────────────────────────────────────
export function ExportRow({ onExport, options }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen(o => !o)}>
        <i className="bi bi-download" /> Export
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: '#fff', border: '1.5px solid var(--bd)', borderRadius: 8, boxShadow: 'var(--shm)', zIndex: 100, minWidth: 180 }}>
          {options.map((opt, i) => (
            <button key={i} onClick={() => { opt.action(); setOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', width: '100%', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--tm)', borderBottom: i < options.length - 1 ? '1px solid var(--bd)' : 'none' }}>
              <i className={`bi ${opt.icon}`} /> {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
