import { useState, useEffect, useCallback } from 'react'
import dayjs from 'dayjs'
import { DailyNoteService } from '../services/dataServices'
import { ConfirmModal, useToast, Toast, PageHeader, ModalShell } from '../components/UI'

const today = () => dayjs().format('YYYY-MM-DD')
const fmtDate = (d) => dayjs(d).format('DD MMM YYYY')

// ── FORM TAMBAH / EDIT NOTE ───────────────────────────────────────
function NoteModal({ existing, onClose, onSuccess }) {
  const isEdit = !!existing
  const [date, setDate] = useState(existing?.note_date || today())
  const [content, setContent] = useState(existing?.content || '')
  const [author, setAuthor] = useState(existing?.authorName || 'Mandor')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!content.trim()) return
    setSaving(true)
    if (isEdit) {
      await DailyNoteService.update(existing.lid, { note_date: date, content: content.trim(), authorName: author })
    } else {
      await DailyNoteService.add({ note_date: date, content: content.trim(), authorName: author })
    }
    onSuccess()
  }

  return (
    <ModalShell title={isEdit ? 'Edit Catatan' : 'Catatan Harian Baru'} icon={isEdit ? 'bi-pencil-square' : 'bi-journal-plus'} onClose={onClose} maxWidth={520}
      footer={<>
        <button
          className="btn btn-primary btn-full"
          onClick={save}
          disabled={!content.trim() || saving}
        >
          <i className="bi bi-floppy-fill" />
          {saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan Catatan'}
        </button>
        <button className="btn btn-secondary" onClick={onClose}>Batal</button>
      </>}>
        {/* Tanggal — user input, TIDAK berubah saat sync */}
        <div className="form-group">
          <label className="form-label">
            Tanggal Kejadian
            <span style={{ fontSize: 10, color: 'var(--ok)', fontWeight: 400, marginLeft: 6 }}>
              ✓ Tanggal ini tidak akan berubah walau sinyal baru ada besok
            </span>
          </label>
          <input
            type="date"
            className="form-input"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ fontSize: 16, fontWeight: 600 }}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Dicatat oleh</label>
          <input
            className="form-input"
            value={author}
            onChange={e => setAuthor(e.target.value)}
            placeholder="Mandor / nama kamu"
          />
        </div>

        {/* Content — bebas, panjang */}
        <div className="form-group">
          <label className="form-label">
            Isi Catatan
            <span style={{ fontSize: 10, color: 'var(--mu)', fontWeight: 400, marginLeft: 6 }}>
              Tulis semua — pemasukan, pengeluaran, kejadian hari ini
            </span>
          </label>
          <textarea
            className="form-input"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={`Contoh:\n- Bayar solar 180L = Rp 1.800.000\n- Gaji 5 pekerja harian = Rp 750.000\n- Hasil jual pasir 35 ritase ke Pak Andi = Rp 3.600.000\n- Excavator jalan 8 jam, HM pagi 2855 sore 2863\n- Beli filter oli di toko = Rp 250.000`}
            style={{
              minHeight: 280,
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 14,
              lineHeight: 1.7,
              resize: 'vertical',
            }}
            autoFocus={!isEdit}
          />
          <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 4, textAlign: 'right' }}>
            {content.length} karakter · {content.split('\n').filter(l => l.trim()).length} baris
          </div>
        </div>
    </ModalShell>
  )
}

// ── NOTE CARD ─────────────────────────────────────────────────────
function NoteCard({ note, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const lines = note.content.split('\n').filter(l => l.trim())
  const preview = lines.slice(0, 3)
  const hasMore = lines.length > 3

  return (
    <div style={{
      background: '#fff',
      borderRadius: 'var(--r)',
      boxShadow: 'var(--sh)',
      marginBottom: 10,
      overflow: 'hidden',
      border: '1.5px solid var(--bd)',
      animation: 'fadeIn .25s ease both',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px', cursor: 'pointer',
          background: expanded ? 'rgba(119,85,55,.03)' : '#fff',
          borderBottom: expanded ? '1px solid var(--bd)' : 'none',
          transition: 'background .15s ease',
        }}
      >
        {/* Date badge */}
        <div style={{
          background: 'var(--sb)', color: 'var(--ac)',
          borderRadius: 8, padding: '6px 10px', textAlign: 'center',
          flexShrink: 0, minWidth: 52,
        }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 18, lineHeight: 1 }}>
            {dayjs(note.note_date).format('DD')}
          </div>
          <div style={{ fontSize: 9, fontWeight: 600, marginTop: 1, opacity: .8 }}>
            {dayjs(note.note_date).format('MMM').toUpperCase()}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13 }}>
            {fmtDate(note.note_date)}
            {!note.synced && (
              <span style={{ fontSize: 9, color: 'var(--wn)', fontWeight: 600, marginLeft: 7, background: 'rgba(245,166,35,.12)', padding: '1px 6px', borderRadius: 10 }}>
                ⏳ Pending sync
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>
            {note.authorName || 'Mandor'} · {lines.length} baris catatan
          </div>
          {/* Preview lines */}
          {!expanded && (
            <div style={{ marginTop: 6 }}>
              {preview.map((line, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--tm)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {line}
                </div>
              ))}
              {hasMore && (
                <div style={{ fontSize: 11, color: 'var(--pr)', fontWeight: 600, marginTop: 2 }}>
                  +{lines.length - 3} baris lagi...
                </div>
              )}
            </div>
          )}
        </div>

        <i
          className={`bi bi-chevron-${expanded ? 'up' : 'down'}`}
          style={{ color: 'var(--mu)', fontSize: 12, flexShrink: 0 }}
        />
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="unit-expand" style={{ padding: '14px 16px' }}>
          <div style={{
            background: 'var(--bg)',
            borderRadius: 8,
            padding: '14px 16px',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 13.5,
            lineHeight: 1.8,
            color: 'var(--tm)',
            whiteSpace: 'pre-wrap',
            marginBottom: 12,
            border: '1px solid var(--bd)',
          }}>
            {note.content}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => onEdit(note)}>
              <i className="bi bi-pencil" /> Edit
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(note)}>
              <i className="bi bi-trash3" /> Hapus
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────────
export default function DailyNotesPage() {
  const [notes, setNotes] = useState([])
  const [modal, setModal] = useState(null)   // null | 'new' | noteObj
  const [confirm, setConfirm] = useState(null)
  const [search, setSearch] = useState('')
  const [msg, showMsg] = useToast()

  const load = useCallback(async () => {
    const all = await DailyNoteService.getAll()
    setNotes(all)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = notes.filter(n => {
    if (!search) return true
    return n.note_date.includes(search) || n.content.toLowerCase().includes(search.toLowerCase())
  })

  // Group by month
  const grouped = filtered.reduce((acc, note) => {
    const key = dayjs(note.note_date).format('MMMM YYYY')
    if (!acc[key]) acc[key] = []
    acc[key].push(note)
    return acc
  }, {})

  return (
    <>
      <div className="page-enter">
        <Toast msg={msg} />

        {/* Header */}
        <PageHeader icon="bi-journal-text" title="Catatan Harian" subtitle="Laporan mandor — tersimpan offline, sync saat ada sinyal"
          action={<button className="btn btn-primary btn-sm" onClick={() => setModal('new')}><i className="bi bi-plus-lg" /> Catatan Baru</button>} />

        {/* Info banner */}
        <div className="alert alert-info" style={{ marginBottom: 14 }}>
          <i className="bi bi-info-circle-fill" />
          <div>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Tanggal tidak berubah walau sinyal baru ada besok</div>
            <div style={{ fontSize: 11 }}>Mandor bisa tulis catatan hari ini, sinyal baru besok — tanggal tetap hari ini.</div>
          </div>
        </div>

        {/* Search */}
        {notes.length > 3 && (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <input
              className="form-input"
              placeholder="🔍 Cari tanggal atau isi catatan..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        )}

        {/* Stats */}
        {notes.length > 0 && (
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 14 }}>
            <div className="stat-card">
              <div className="stat-val" style={{ fontSize: 20, color: 'var(--pr)' }}>{notes.length}</div>
              <div className="stat-label">Total Catatan</div>
            </div>
            <div className="stat-card">
              <div className="stat-val" style={{ fontSize: 20, color: 'var(--wn)' }}>{notes.filter(n => !n.synced).length}</div>
              <div className="stat-label">Pending Sync</div>
            </div>
            <div className="stat-card">
              <div className="stat-val" style={{ fontSize: 20, color: 'var(--ok)' }}>
                {notes.length > 0 ? fmtDate(notes[0].note_date) : '-'}
              </div>
              <div className="stat-label">Catatan Terbaru</div>
            </div>
          </div>
        )}

        {/* Notes grouped by month */}
        {Object.keys(grouped).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mu)' }}>
            <i className="bi bi-journal-text" style={{ fontSize: 44, opacity: .4, display: 'block', marginBottom: 12 }} />
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
              Belum ada catatan harian
            </div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>
              Mandor bisa mulai catat semua pemasukan dan pengeluaran hari ini
            </div>
            <button className="btn btn-primary" onClick={() => setModal('new')}>
              <i className="bi bi-plus-circle" /> Buat Catatan Pertama
            </button>
          </div>
        ) : (
          Object.entries(grouped).map(([month, monthNotes]) => (
            <div key={month}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: 'var(--mu)',
                textTransform: 'uppercase', letterSpacing: 1,
                padding: '10px 4px 6px',
              }}>
                {month} · {monthNotes.length} catatan
              </div>
              {monthNotes.map(note => (
                <NoteCard
                  key={note.lid}
                  note={note}
                  onEdit={n => setModal(n)}
                  onDelete={n => setConfirm(n)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Modals udah diluar dari page-enter */}
      {modal !== null && (
        <NoteModal
          existing={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSuccess={() => {
            setModal(null)
            showMsg(modal === 'new' ? '✅ Catatan tersimpan!' : '✅ Catatan diperbarui!')
            load()
          }}
        />
      )}
      {confirm && (
        <ConfirmModal
          msg={`Hapus catatan tanggal ${fmtDate(confirm.note_date)}?`}
          onConfirm={async () => {
            await DailyNoteService.delete(confirm.lid)
            showMsg('Catatan dihapus')
            setConfirm(null)
            load()
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  )
}