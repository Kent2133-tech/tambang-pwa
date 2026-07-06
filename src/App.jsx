import { useState, useEffect } from 'react'
import { useSync } from './hooks/useSync'
import { OperatorService } from './services/dataServices'
import { SyncBadge } from './components/UI'
import { OwnerPinModal } from './components/OwnerPinModal'
import OwnerDashboard from './pages/OwnerDashboard'
import DashboardPage from './pages/DashboardPage'
import { KendaraanPage, MesinPage } from './pages/UnitPages'
import ServicePage from './pages/ServicePage'
import { SolarPage, InspeksiPage, SparePage, RitasePage } from './pages/OperatorPages'
import SettingsPage from './pages/SettingsPage'
import DailyNotesPage from './pages/DailyNotesPage'
import TransaksiPage from './pages/TransaksiPage'
import MaintenanceCalendarPage from './pages/MaintenanceCalendarPage'

const NAV_ITEMS = [
  { id:'home',     icon:'bi-house-fill',           label:'Beranda',         section:'UTAMA' },
  { id:'kendaraan',icon:'bi-truck-front-fill',     label:'Kendaraan',       section:'UNIT' },
  { id:'mesin',    icon:'bi-gear-wide-connected',  label:'Mesin Produksi' },
  { id:'kalender', icon:'bi-calendar2-check-fill', label:'Kalender Service' },
  { id:'service',  icon:'bi-tools',                label:'Riwayat Service', section:'OPERASIONAL' },
  { id:'solar',    icon:'bi-fuel-pump-fill',       label:'Input Solar' },
  { id:'ritase',   icon:'bi-truck',                label:'Ritase / Produksi' },
  { id:'inspeksi', icon:'bi-clipboard2-check-fill',label:'Inspeksi' },
  { id:'notes',    icon:'bi-journal-text',         label:'Catatan Harian',  section:'LAPANGAN' },
  { id:'transaksi',icon:'bi-cash-coin',            label:'Transaksi Kas' },
  { id:'spare',    icon:'bi-boxes',                label:'Stok Spare',      section:'DATA' },
  { id:'settings', icon:'bi-gear-fill',            label:'Pengaturan' },
]

const PAGE_MAP = {
  home: DashboardPage, kendaraan: KendaraanPage, mesin: MesinPage,
  kalender: MaintenanceCalendarPage,
  service: ServicePage, solar: SolarPage, ritase: RitasePage,
  inspeksi: InspeksiPage, notes: DailyNotesPage, transaksi: TransaksiPage, spare: SparePage, settings: SettingsPage,
}

// Menu harian yang paling sering dipakai mandor — 1 tap dari bottom nav
const BOTTOM_NAV = [
  { id:'home',      icon:'bi-house-fill',     label:'Beranda' },
  { id:'solar',     icon:'bi-fuel-pump-fill', label:'Solar' },
  { id:'ritase',    icon:'bi-truck',          label:'Ritase' },
  { id:'notes',     icon:'bi-journal-text',   label:'Catatan' },
  { id:'transaksi', icon:'bi-cash-coin',      label:'Kas' },
]

function BottomNav({ page, onNavigate }) {
  return (
    <nav className="bottom-nav">
      {BOTTOM_NAV.map(item => (
        <button key={item.id} className={`bnav-item ${page === item.id ? 'active' : ''}`} onClick={() => onNavigate(item.id)}>
          <i className={`bi ${item.icon}`} />
          {item.label}
        </button>
      ))}
    </nav>
  )
}

export default function App() {
  const { online, lastSync, syncing } = useSync()
  const [page, setPage] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [ownerMode, setOwnerMode] = useState(false)

  useEffect(() => { OperatorService.init() }, [])

  const navigate = (id) => { setPage(id); setSidebarOpen(false) }

  if (ownerMode) {
    return (
      <div style={{ height:'100vh', overflow:'hidden' }}>
        <OwnerDashboard onClose={() => setOwnerMode(false)} />
      </div>
    )
  }

  const PageComp = PAGE_MAP[page] || DashboardPage
  const currentNav = NAV_ITEMS.find(n => n.id === page)

  return (
    <div className="app-layout">
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:290 }} />
      )}

      <div className={`sidebar ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="sb-header">
          <div className="sb-logo"><i className="bi bi-minecart-loaded" /> GRAPERS</div>
          <div className="sb-sub">Tambang System</div>
          <div style={{ marginTop:10, background:'rgba(255,255,255,.07)', borderRadius:8, padding:'8px 10px' }}>
            <div style={{ fontWeight:700, fontSize:13, color:'#fff' }}>Selamat Datang</div>
            <div style={{ fontSize:10, color:'var(--st)', textTransform:'uppercase', letterSpacing:'.5px' }}>Operator / Mandor</div>
          </div>
        </div>
        <nav className="sb-nav">
          {NAV_ITEMS.map(item => (
            <div key={item.id}>
              {item.section && <div className="sb-section">{item.section}</div>}
              <button className={`sb-item ${page === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}>
                <i className={`bi ${item.icon}`} />{item.label}
              </button>
            </div>
          ))}
          <div className="sb-section">AKSES LANJUTAN</div>
          <button className="sb-item" onClick={() => { setSidebarOpen(false); setShowPinModal(true) }}
            style={{ color:'rgba(251,226,157,.85)', border:'1px solid rgba(251,226,157,.25)', borderRadius:9, marginTop:2 }}>
            <i className="bi bi-shield-lock-fill" style={{ color:'var(--ac)' }} />Owner Dashboard
          </button>
          
          {/* Badge khusus untuk Sidebar (Desktop) */}
          <div className="badge-desktop" style={{ padding:'12px 8px 8px' }}>
            <SyncBadge online={online} syncing={syncing} lastSync={lastSync} />
          </div>
        </nav>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div className="topbar">
          <button onClick={() => setSidebarOpen(o => !o)} aria-label="Menu"
            style={{ background:'none', border:'none', color:'var(--st)', fontSize:22, cursor:'pointer', padding:'8px 6px', display:'flex', alignItems:'center' }}>
            <i className="bi bi-list" />
          </button>
          <span className="topbar-title">{currentNav?.label || 'GRAPERS'}</span>

          {/* Badge khusus untuk Topbar (Mobile) */}
          <div className="badge-mobile" style={{ marginLeft:'auto' }}>
            <SyncBadge online={online} syncing={syncing} lastSync={lastSync} />
          </div>
        </div>
        <div className="main-content"><div key={page}><PageComp /></div></div>
        <BottomNav page={page} onNavigate={navigate} />
      </div>

      {showPinModal && (
        <OwnerPinModal onSuccess={() => { setShowPinModal(false); setOwnerMode(true) }} onClose={() => setShowPinModal(false)} />
      )}
    </div>
  )
}