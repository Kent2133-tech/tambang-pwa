import { useState, useEffect, useCallback } from 'react'
import dayjs from 'dayjs'
import { TransaksiService, TRANSAKSI_KATEGORI_MASUK, TRANSAKSI_KATEGORI_KELUAR, KAS_OPTIONS } from '../services/dataServices'
import { ConfirmModal, useToast, Toast, EmptyState } from '../components/UI'

const today = () => dayjs().format('YYYY-MM-DD')
const fmtDate = (d) => dayjs(d).format('DD MMM YYYY')
const rp = n => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`

const QTY_LABEL = {
  'Upah Galian': 'Jumlah Pekerja',
  'Solar': 'Jumlah Liter',
  'Penjualan Pasir': 'Qty (m³) — opsional',
  'Penjualan Emas': 'Qty (gram) — opsional',
}
const QTY_ONLY = ['Upah Galian', 'Solar']
const QTY_AND_NOMINAL = ['Penjualan Pasir', 'Penjualan Emas']

function emptyForm() {
  return {
    date: today(), tipe: 'Keluar', kategori: TRANSAKSI_KATEGORI_KELUAR[0], keterangan: '',
    komoditas: '-', qty: '', nominal: '', dari: 'Kas Mandor', ke: '-', operatorName: 'Mandor',
  }
}

// ── FORM TAMBAH / EDIT TRANSAKSI (dipakai operator & owner) ──────
export function TransaksiModal({ existing, onClose, onSuccess }) {
  const isEdit = !!existing
  const [f, setF] = useState(existing ? { ...existing, qty: existing.qty ?? '', nominal: existing.nominal ?? '' } : emptyForm())
  const [saving, setSaving] = useState(false)
  const s = (k, v) => setF(p => ({ ...p, [k]: v }))

  const kategoriOptions = f.tipe === 'Masuk' ? TRANSAKSI_KATEGORI_MASUK : f.tipe === 'Keluar' ? TRANSAKSI_KATEGORI_KELUAR : []
  const isPenjualan = f.kategori === 'Penjualan Pasir' || f.kategori === 'Penjualan Emas'
  const showQty = QTY_ONLY.includes(f.kategori) || QTY_AND_NOMINAL.includes(f.kategori)
  const showNominal = !QTY_ONLY.includes(f.kategori)
  const qtyRequired = QTY_ONLY.includes(f.kategori)

  const komoditasFor = (kategori) => kategori === 'Penjualan Pasir' ? 'Pasir' : kategori === 'Penjualan Emas' ? 'Emas' : '-'

  const setTipe = (tipe) => {
    setF(p => {
      const next = { ...p, tipe }
      if (tipe === 'Masuk') { next.kategori = TRANSAKSI_KATEGORI_MASUK[0]; next.dari = '-'; next.ke = p.ke === '-' ? 'Kas Mandor' : p.ke }
      else if (tipe === 'Keluar') { next.kategori = TRANSAKSI_KATEGORI_KELUAR[0]; next.dari = p.dari === '-' ? 'Kas Mandor' : p.dari; next.ke = '-' }
      else { next.kategori = 'Pindah Kas'; next.dari = p.dari === '-' ? 'Kas Mandor' : p.dari; next.ke = p.ke === '-' ? 'Kas Besar' : p.ke }
      next.komoditas = komoditasFor(next.kategori)
      next.qty = ''; next.nominal = ''
      return next
    })
  }

  const setKategori = (kategori) => {
    setF(p => ({
      ...p,
      kategori,
      komoditas: komoditasFor(kategori),
      nominal: QTY_ONLY.includes(kategori) ? '' : p.nominal,
      qty: (QTY_ONLY.includes(kategori) || QTY_AND_NOMINAL.includes(kategori)) ? p.qty : '',
    }))
  }

  const canSave = f.date && (f.tipe === 'Pindah' || f.kategori) &&
    (!qtyRequired || Number(f.qty) > 0) &&
    (!showNominal || Number(f.nominal) > 0) &&
    (f.tipe !== 'Keluar' || f.dari !== '-') &&
    (f.tipe !== 'Masuk' || f.ke !== '-') &&
    (f.tipe !== 'Pindah' || (f.dari !== '-' && f.ke !== '-' && f.dari !== f.ke))

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    const payload = {
      date: f.date, tipe: f.tipe, kategori: f.kategori || '',
      keterangan: (f.keterangan || '').trim(), komoditas: f.komoditas || '-',
      qty: f.qty !== '' ? Number(f.qty) : null,
      nominal: f.nominal !== '' ? Number(f.nominal) : null,
      dari: f.dari || '-', ke: f.ke || '-', operatorName: f.operatorName || 'Mandor',
    }
    if (isEdit) await TransaksiService.update(existing.lid, payload)
    else await TransaksiService.add(payload)
    onSuccess()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16 }}>{isEdit ? '✏️ Edit Transaksi' : '💰 Catat Transaksi'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--mu)', padding: '0 4px', lineHeight: 1 }}>✕</button>
        </div>

        <div className="form-group">
          <label className="form-label">Tipe *</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['Masuk', 'Keluar', 'Pindah'].map(t => (
              <button key={t} type="button" onClick={() => setTipe(t)}
                className={`btn btn-sm ${f.tipe === t ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Tanggal *</label>
          <input type="date" className="form-input" value={f.date} onChange={e => s('date', e.target.value)} />
        </div>

        {f.tipe !== 'Pindah' && (
          <div className="form-group">
            <label className="form-label">Kategori *</label>
            <select className="form-input form-select" value={f.kategori} onChange={e => setKategori(e.target.value)}>
              {kategoriOptions.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        )}

        {isPenjualan && (
          <div className="form-group">
            <label className="form-label">Komoditas</label>
            <input className="form-input" value={f.komoditas} disabled style={{ background: 'var(--bg)', color: 'var(--mu)' }} />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: showQty && showNominal ? '1fr 1fr' : '1fr', gap: 10 }}>
          {showQty && (
            <div className="form-group">
              <label className="form-label">{QTY_LABEL[f.kategori] || 'Qty'}{qtyRequired ? ' *' : ''}</label>
              <input type="number" className="form-input" value={f.qty} onChange={e => s('qty', e.target.value)} inputMode="decimal" placeholder="0" />
            </div>
          )}
          {showNominal && (
            <div className="form-group">
              <label className="form-label">Nominal (Rp) *</label>
              <input type="number" className="form-input" value={f.nominal} onChange={e => s('nominal', e.target.value)} inputMode="numeric" placeholder="0" />
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Keterangan</label>
          <input className="form-input" value={f.keterangan} onChange={e => s('keterangan', e.target.value)} placeholder="Opsional — contoh: jual ke Pak Andi" />
        </div>

        {(f.tipe === 'Keluar' || f.tipe === 'Pindah') && (
          <div className="form-group">
            <label className="form-label">Dari (kas sumber) *</label>
            <select className="form-input form-select" value={f.dari} onChange={e => s('dari', e.target.value)}>
              <option value="-">-</option>
              {KAS_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        )}

        {(f.tipe === 'Masuk' || f.tipe === 'Pindah') && (
          <div className="form-group">
            <label className="form-label">Ke (kas tujuan) *</label>
            <select className="form-input form-select" value={f.ke} onChange={e => s('ke', e.target.value)}>
              <option value="-">-</option>
              {KAS_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Dicatat oleh</label>
          <input className="form-input" value={f.operatorName} onChange={e => s('operatorName', e.target.value)} placeholder="Mandor / nama kamu" />
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary btn-full" onClick={save} disabled={!canSave || saving} style={{ padding: 12 }}>
            <i className="bi bi-floppy-fill" /> {saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan Transaksi'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
  )
}

// ── ROW TAMPILAN (dipakai operator & owner) ───────────────────────
const TIPE_COLOR = { Masuk: 'var(--ok)', Keluar: 'var(--er)', Pindah: 'var(--in)' }
const TIPE_BG = { Masuk: 'rgba(76,175,130,.12)', Keluar: 'rgba(224,82,82,.12)', Pindah: 'rgba(74,144,217,.12)' }

export function TransaksiRow({ t, onEdit, onDelete }) {
  const qtyUnit = t.kategori === 'Solar' ? 'L' : t.kategori === 'Upah Galian' ? 'org' : t.komoditas === 'Pasir' ? 'm³' : t.komoditas === 'Emas' ? 'gr' : ''
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--bd)' }}>
      <div style={{ background: TIPE_BG[t.tipe] || 'var(--bg)', color: TIPE_COLOR[t.tipe] || 'var(--mu)', borderRadius: 8, padding: '4px 9px', fontSize: 11, fontWeight: 700, flexShrink: 0, minWidth: 56, textAlign: 'center' }}>
        {t.tipe}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t.kategori || '-'}
          {!t.synced && <span style={{ fontSize: 9, color: 'var(--wn)', fontWeight: 600, marginLeft: 7, background: 'rgba(245,166,35,.12)', padding: '1px 6px', borderRadius: 10 }}>⏳ Pending sync</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fmtDate(t.date)} · {t.keterangan || '-'}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: TIPE_COLOR[t.tipe] }}>
          {t.nominal ? rp(t.nominal) : t.qty ? `${t.qty} ${qtyUnit}` : '-'}
        </div>
        <div style={{ fontSize: 10, color: 'var(--mu)' }}>
          {t.tipe === 'Keluar' ? `dari ${t.dari}` : t.tipe === 'Masuk' ? `ke ${t.ke}` : `${t.dari} → ${t.ke}`}
        </div>
      </div>
      {(onEdit || onDelete) && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {onEdit && <button className="btn-icon btn-sm" onClick={onEdit}><i className="bi bi-pencil" /></button>}
          {onDelete && <button className="btn-icon btn-sm" onClick={onDelete}><i className="bi bi-trash3" /></button>}
        </div>
      )}
    </div>
  )
}

// ── HALAMAN OPERATOR — catat transaksi, lihat 7 hari terakhir ────
export default function TransaksiPage() {
  const [recent, setRecent] = useState([])
  const [modal, setModal] = useState(null) // null | 'new' | txObj
  const [confirm, setConfirm] = useState(null)
  const [msg, showMsg] = useToast()

  const load = useCallback(async () => setRecent(await TransaksiService.getRecent(7)), [])
  useEffect(() => { load() }, [load])

  return (
    <>
      <div className="page-enter">
        <Toast msg={msg} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 18 }}>💰 Transaksi Kas</div>
            <div style={{ fontSize: 12, color: 'var(--mu)' }}>Catat pemasukan & pengeluaran harian — tersimpan offline, sync saat ada sinyal</div>
          </div>
          <button className="btn btn-primary" onClick={() => setModal('new')}>
            <i className="bi bi-plus-lg" /> Catat Transaksi
          </button>
        </div>

        <div className="alert alert-info" style={{ marginBottom: 14 }}>
          <i className="bi bi-info-circle-fill" />
          <div>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Menampilkan transaksi 7 hari terakhir</div>
            <div style={{ fontSize: 11 }}>Rekap lengkap semua transaksi & export Excel hanya bisa diakses Owner lewat Owner Dashboard.</div>
          </div>
        </div>

        {recent.length === 0 ? (
          <EmptyState icon="bi-cash-coin" text="Belum ada transaksi 7 hari terakhir">
            <button className="btn btn-primary" onClick={() => setModal('new')}>
              <i className="bi bi-plus-circle" /> Catat Transaksi Pertama
            </button>
          </EmptyState>
        ) : (
          <div className="card">
            {recent.map(t => (
              <TransaksiRow key={t.lid} t={t} onEdit={() => setModal(t)} onDelete={() => setConfirm(t)} />
            ))}
          </div>
        )}
      </div>

      {modal !== null && (
        <TransaksiModal
          existing={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); showMsg(modal === 'new' ? '✅ Transaksi tersimpan!' : '✅ Transaksi diperbarui!'); load() }}
        />
      )}
      {confirm && (
        <ConfirmModal
          msg={`Hapus transaksi ${fmtDate(confirm.date)} (${confirm.kategori || confirm.tipe})?`}
          onConfirm={async () => { await TransaksiService.delete(confirm.lid); showMsg('Dihapus'); setConfirm(null); load() }}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  )
}
