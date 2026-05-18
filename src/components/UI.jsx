import { useState } from 'react'
import { PhotoService } from '../services/dataServices'

// ── TOAST ────────────────────────────────────────────────────────
export function Toast({ msg, onClose }) {
  if (!msg) return null
  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#2C1A0E', color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,.3)', whiteSpace: 'nowrap', animation: 'bounceIn .35s cubic-bezier(.22,1,.36,1) both' }}>
      {msg}
    </div>
  )
}

export function useToast() {
  const [msg, setMsg] = useState(null)
  const show = (m) => { setMsg(m); setTimeout(() => setMsg(null), 2500) }
  return [msg, show]
}

// ── CONFIRM MODAL ────────────────────────────────────────────────
export function ConfirmModal({ msg, onConfirm, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        <p className="modal-title">Konfirmasi</p>
        <p style={{ fontSize: 14, color: 'var(--mu)', marginBottom: 16 }}>{msg}</p>
        <div className="modal-footer">
          <button className="btn btn-danger btn-full" onClick={onConfirm}>Ya, Hapus</button>
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
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
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: '2px dashed var(--bd)', borderRadius: 8, cursor: 'pointer', background: 'rgba(119,85,55,.04)', marginBottom: 8 }}>
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
            <button key={i} onClick={() => { opt.action(); setOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', width: '100%', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--tm)', borderBottom: i < options.length - 1 ? '1px solid var(--bd)' : 'none' }}>
              <i className={`bi ${opt.icon}`} /> {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
