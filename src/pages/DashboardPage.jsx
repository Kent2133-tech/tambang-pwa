import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts'
import dayjs from 'dayjs'
import { UnitService, SvcService, SolarService, CostService } from '../services/dataServices'
import { SectionHeader, EmptyState } from '../components/UI'

const rp = n => `Rp ${Math.round(n||0).toLocaleString('id-ID')}`
const COLORS = ['#775537','#F5A623','#4CAF82','#4A90D9','#E05252','#C0DDDA']

export default function DashboardPage() {
  const [data, setData] = useState({ units: [], totalCost: 0, solarCost: 0, svcCost: 0, trendData: [], pieData: [], unitStatus: {} })
  const [loading, setLoading] = useState(true)
  const month = dayjs().month() + 1
  const year = dayjs().year()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const units = await UnitService.getAll()
      const svcs = await SvcService.getByMonth(year, month)
      const solar = await SolarService.getByMonth(year, month)
      const costs = await CostService.getByMonth(year, month)

      const solarCost = solar.reduce((a, s) => a + (s.liters||0)*(s.pricePerLiter||0), 0)
      const svcCost = svcs.reduce((a, s) => a + (s.cost||0), 0)
      const otherCost = costs.reduce((a, c) => a + (c.amount||0), 0)
      const totalCost = solarCost + svcCost + otherCost

      // 7-day trend
      const trendData = []
      for (let i = 6; i >= 0; i--) {
        const d = dayjs().subtract(i, 'day').format('YYYY-MM-DD')
        const label = dayjs().subtract(i, 'day').format('DD/MM')
        const daySolar = solar.filter(s => s.date === d).reduce((a, s) => a + (s.liters||0)*(s.pricePerLiter||0), 0)
        const daySvc = svcs.filter(s => s.date === d).reduce((a, s) => a + (s.cost||0), 0)
        trendData.push({ label, solar: daySolar, service: daySvc, total: daySolar + daySvc })
      }

      const pieData = [
        { name: 'Solar/BBM', value: solarCost },
        { name: 'Service', value: svcCost },
        { name: 'Lainnya', value: otherCost },
      ].filter(d => d.value > 0)

      const unitStatus = {
        total: units.length,
        sehat: units.filter(u => UnitService.operationalStatus(u) === 'sehat').length,
        hampir: units.filter(u => UnitService.operationalStatus(u) === 'hampir').length,
        overdue: units.filter(u => UnitService.operationalStatus(u) === 'overdue').length,
      }

      setData({ units, totalCost, solarCost, svcCost, trendData, pieData, unitStatus })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>⏳ Memuat dashboard...</div>

  const { unitStatus, trendData, pieData, totalCost, solarCost, svcCost } = data

  return (
    <div className="page-enter stagger">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 18, color: 'var(--tm)' }}>Dashboard</div>
        <div style={{ fontSize: 12, color: 'var(--mu)' }}>{dayjs().format('DD MMMM YYYY')}</div>
      </div>

      {/* Unit Status */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {[
          { l: 'Total Unit', v: unitStatus.total, c: 'var(--pr)', bg: 'rgba(119,85,55,.08)' },
          { l: '🟢 Sehat', v: unitStatus.sehat, c: 'var(--ok)', bg: 'rgba(76,175,130,.07)' },
          { l: '🟡 Hampir', v: unitStatus.hampir, c: 'var(--wn)', bg: 'rgba(245,166,35,.07)' },
          { l: '🔴 Overdue', v: unitStatus.overdue, c: 'var(--er)', bg: 'rgba(224,82,82,.07)' },
        ].map(x => (
          <div key={x.l} className="stat-card" style={{ background: x.bg }}>
            <div className="stat-val" style={{ color: x.c }}>{x.v}</div>
            <div className="stat-label">{x.l}</div>
          </div>
        ))}
      </div>

      {/* Cost Summary */}
      <div className="stat-grid">
        {[
          { l: 'Total Biaya Bulan Ini', v: rp(totalCost), c: 'var(--pr)' },
          { l: 'Solar/BBM', v: rp(solarCost), c: '#b3700a' },
          { l: 'Service', v: rp(svcCost), c: 'var(--in)' },
        ].map(x => (
          <div key={x.l} className="stat-card" style={{ gridColumn: x.l.includes('Total') ? 'span 2' : 'span 1' }}>
            <div className="stat-val" style={{ fontSize: 16, color: x.c }}>{x.v}</div>
            <div className="stat-label">{x.l}</div>
          </div>
        ))}
      </div>

      {/* 7-Day Trend */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">📈 Tren Biaya 7 Hari</span>
        </div>
        {trendData.some(d => d.total > 0) ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={trendData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => rp(v)} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Bar dataKey="solar" name="Solar" fill="#b3700a" radius={[3,3,0,0]} stackId="a" />
              <Bar dataKey="service" name="Service" fill="var(--pr)" radius={[3,3,0,0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyState icon="bi-bar-chart" text="Belum ada data biaya minggu ini" />}
      </div>

      {/* Pie Chart */}
      {pieData.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">🥧 Distribusi Biaya Bulan Ini</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 10 }}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => rp(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Overdue alerts */}
      {unitStatus.overdue > 0 && (
        <div className="alert alert-error">
          <i className="bi bi-exclamation-octagon-fill" />
          {unitStatus.overdue} unit melewati batas maintenance! Segera lakukan servis.
        </div>
      )}
      {unitStatus.hampir > 0 && (
        <div className="alert alert-warn">
          <i className="bi bi-exclamation-triangle-fill" />
          {unitStatus.hampir} unit mendekati jadwal maintenance.
        </div>
      )}
    </div>
  )
}
