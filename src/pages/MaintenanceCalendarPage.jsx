import { useState, useEffect } from 'react'
import { UnitService } from '../services/dataServices'
import { EmptyState } from '../components/UI'

function getMaintenanceItems(unit) {
  const intervals = unit.maintenanceIntervals || { ringan: 250, sedang: 1000, besar: 2000, overhaul: 5000 }
  const lastSvc = unit.lastServiceHours || {}
  const currentHours = unit.totalHours || 0
  return Object.entries(intervals).map(([type, interval]) => {
    const lastDone = lastSvc[type] || 0
    const nextDue = lastDone + interval
    const hoursLeft = nextDue - currentHours
    const status = hoursLeft <= 0 ? 'overdue' : hoursLeft <= 50 ? 'hampir' : 'sehat'
    return { type, interval, lastDone, nextDue, hoursLeft, status }
  }).sort((a, b) => a.hoursLeft - b.hoursLeft)
}

const STATUS_CONFIG = {
  overdue: { color: 'var(--er)', bg: 'rgba(224,82,82,.08)', border: 'rgba(224,82,82,.3)', label: '🔴 Overdue', badgeClass: 'badge-error' },
  hampir:  { color: 'var(--wn)', bg: 'rgba(245,166,35,.08)', border: 'rgba(245,166,35,.3)', label: '🟡 Hampir Due', badgeClass: 'badge-warn' },
  sehat:   { color: 'var(--ok)', bg: 'rgba(76,175,130,.06)', border: 'rgba(76,175,130,.2)', label: '🟢 Aman', badgeClass: 'badge-ok' },
}

const TYPE_LABEL = { ringan: 'Servis Ringan', sedang: 'Servis Sedang', besar: 'Servis Besar', overhaul: 'Overhaul' }

export default function MaintenanceCalendarPage() {
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    UnitService.getActive().then(u => { setUnits(u); setLoading(false) })
  }, [])

  const allItems = units.flatMap(u =>
    getMaintenanceItems(u).map(item => ({ ...item, unit: u }))
  ).sort((a, b) => a.hoursLeft - b.hoursLeft)

  const filtered = filter === 'all' ? allItems : allItems.filter(i => i.status === filter)

  const counts = {
    overdue: allItems.filter(i => i.status === 'overdue').length,
    hampir:  allItems.filter(i => i.status === 'hampir').length,
    sehat:   allItems.filter(i => i.status === 'sehat').length,
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>⏳ Memuat...</div>

  return (
    <div className="page-enter">
      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 18, marginBottom: 4 }}>📅 Kalender Maintenance</div>
      <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 16 }}>Jadwal servis semua unit berdasarkan jam operasi</div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'all',     label: `Semua (${allItems.length})`,      color: 'var(--pr)' },
          { key: 'overdue', label: `🔴 Overdue (${counts.overdue})`,  color: 'var(--er)' },
          { key: 'hampir',  label: `🟡 Hampir (${counts.hampir})`,    color: 'var(--wn)' },
          { key: 'sehat',   label: `🟢 Aman (${counts.sehat})`,       color: 'var(--ok)' },
        ].map(({ key, label, color }) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${filter === key ? color : 'var(--bd)'}`,
            background: filter === key ? color + '15' : '#fff', color: filter === key ? color : 'var(--mu)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{label}</button>
        ))}
      </div>

      {filtered.length === 0 ? <EmptyState icon="bi-calendar2-check" text="Tidak ada unit di kategori ini" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((item, i) => {
            const cfg = STATUS_CONFIG[item.status]
            return (
              <div key={i} style={{
                background: cfg.bg, border: `1.5px solid ${cfg.border}`,
                borderRadius: 12, padding: '12px 14px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--tm)' }}>{item.unit.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--mu)' }}>{item.unit.type} · {item.unit.kodeUnit || '-'}</div>
                  </div>
                  <span className={`badge ${cfg.badgeClass}`}>{cfg.label}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--sb)', fontWeight: 600, marginBottom: 4 }}>
                  {TYPE_LABEL[item.type] || item.type} (setiap {item.interval.toLocaleString('id-ID')} jam)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                  {[
                    { l: 'Jam Sekarang', v: `${(item.unit.totalHours || 0).toLocaleString('id-ID')} jam` },
                    { l: 'Terakhir Servis', v: item.lastDone ? `${item.lastDone.toLocaleString('id-ID')} jam` : 'Belum pernah' },
                    {
                      l: item.hoursLeft <= 0 ? 'Telat' : 'Sisa',
                      v: item.hoursLeft <= 0
                        ? `${Math.abs(item.hoursLeft).toLocaleString('id-ID')} jam`
                        : `${item.hoursLeft.toLocaleString('id-ID')} jam`,
                      c: cfg.color,
                    },
                  ].map(({ l, v, c }) => (
                    <div key={l} style={{ background: 'rgba(255,255,255,.6)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: c || 'var(--tm)', fontWeight: 700 }}>{v}</div>
                      <div style={{ fontSize: 9, color: 'var(--mu)', marginTop: 1 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
