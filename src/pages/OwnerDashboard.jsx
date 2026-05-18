import DailyNotesPage from './DailyNotesPage'
import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import dayjs from 'dayjs'
import db from '../services/db'
import { UnitService, SvcService, SolarService, InspService, StockService, CostService } from '../services/dataServices'
import { pullFromCloud, processSyncQueue } from '../services/dataServices'
import { exportRingkasanBulanan, exportServiceLog, exportSolarLog, exportInspeksiLog } from '../services/exportService'
import { SectionHeader, EmptyState, useToast, Toast, ConfirmModal } from '../components/UI'
import { useSync } from '../hooks/useSync'

const rp = n => `Rp ${Math.round(n||0).toLocaleString('id-ID')}`
const num = n => (n||0).toLocaleString('id-ID')
const today = () => dayjs().format('YYYY-MM-DD')
const COLORS = ['#775537','#F5A623','#C0DDDA','#4CAF82','#E05252','#4A90D9']

const OWNER_TABS = [
  { id:'dashboard', icon:'bi-speedometer2', label:'Dashboard',       section:'OVERVIEW' },
  { id:'biaya',     icon:'bi-cash-stack',   label:'Analisa Biaya',   section:'ANALITIK' },
  { id:'solar',     icon:'bi-fuel-pump',    label:'Solar Analytics' },
  { id:'maint',     icon:'bi-tools',        label:'Maintenance' },
  { id:'ranking',   icon:'bi-trophy',       label:'Ranking Unit' },
  { id:'dep',       icon:'bi-graph-down',   label:'Depresiasi',      section:'LAPORAN' },
  { id:'spare',     icon:'bi-boxes',        label:'Spare Part' },
  { id:'export',    icon:'bi-download',     label:'Export Excel' },
  { id:'sync',      icon:'bi-cloud-arrow-up', label:'Sync Cloud' },
  { id:'notes',     icon:'bi-journal-text',  label:'Catatan Harian', section:'LAPANGAN' },
]

// ── OWNER DASHBOARD ──────────────────────────────────────────────
function OwDash() {
  const [d, setD] = useState({ units:[], mCost:0, yCost:0, solar:0, dt:0, trend:[], oc:0 })
  useEffect(() => {
    async function load() {
      const units = await UnitService.getAll()
      const ms = dayjs().startOf('month').format('YYYY-MM-DD')
      const ys = dayjs().startOf('year').format('YYYY-MM-DD')
      const [mC, sl, sv] = await Promise.all([
        db.cost_logs.filter(l => l.date >= ms).toArray(),
        db.solar_logs.filter(l => l.date >= ms).toArray(),
        db.svc_logs.filter(l => l.date >= ms).toArray(),
      ])
      const mCost = mC.reduce((a,l)=>a+(l.amount||0),0)+sl.reduce((a,l)=>a+(l.liters||0)*(l.pricePerLiter||0),0)+sv.reduce((a,l)=>a+(l.cost||0),0)
      const yC = await db.cost_logs.filter(l => l.date >= ys).toArray()
      const trend = []
      for (let i=5;i>=0;i--) {
        const m = dayjs().subtract(i,'month')
        const s=m.startOf('month').format('YYYY-MM-DD'), e=m.endOf('month').format('YYYY-MM-DD')
        const [cc,sc,vc] = await Promise.all([
          db.cost_logs.filter(l=>l.date>=s&&l.date<=e).toArray(),
          db.solar_logs.filter(l=>l.date>=s&&l.date<=e).toArray(),
          db.svc_logs.filter(l=>l.date>=s&&l.date<=e).toArray(),
        ])
        trend.push({ label:m.format('MMM'), total:cc.reduce((a,l)=>a+(l.amount||0),0)+sc.reduce((a,l)=>a+(l.liters||0)*(l.pricePerLiter||0),0)+vc.reduce((a,l)=>a+(l.cost||0),0) })
      }
      setD({ units, mCost, yCost:yC.reduce((a,l)=>a+(l.amount||0),0), solar:sl.reduce((a,l)=>a+(l.liters||0),0), dt:sv.reduce((a,l)=>a+(l.downtimeHours||0),0), trend, oc:units.filter(u=>UnitService.operationalStatus(u)==='overdue').length })
    }
    load()
  }, [])
  return (
    <div className="page-enter">
      <div className="stat-grid stagger" style={{ gridTemplateColumns:'repeat(2,1fr)' }}>
        {[
          { c:'var(--er)', l:'Biaya Bulan Ini', v:rp(d.mCost) },
          { c:'var(--pr)', l:'Biaya Tahun Ini', v:rp(d.yCost) },
          { c:'#b3700a',   l:'Solar Bulan Ini', v:`${num(d.solar)} L` },
          { c:'var(--er)', l:'Downtime / Overdue', v:`${d.dt}h / ${d.oc}` },
        ].map(x=>(
          <div key={x.l} className="stat-card">
            <div className="stat-val" style={{fontSize:16,color:x.c}}>{x.v}</div>
            <div className="stat-label">{x.l}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">📈 Tren Biaya 6 Bulan</span></div>
        {d.trend.some(t=>t.total>0) ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={d.trend}>
              <XAxis dataKey="label" tick={{fontSize:10}}/>
              <YAxis tick={{fontSize:10}} tickFormatter={v=>`${(v/1e6).toFixed(1)}jt`}/>
              <Tooltip formatter={v=>rp(v)} contentStyle={{fontSize:11,borderRadius:8}}/>
              <Bar dataKey="total" name="Total" fill="var(--pr)" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyState icon="bi-bar-chart" text="Belum ada data biaya"/>}
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">🏥 Health Score Unit</span></div>
        {d.units.length===0 ? <EmptyState icon="bi-truck" text="Belum ada unit"/> :
          d.units.slice(0,8).map(u => {
            const os = UnitService.operationalStatus(u)
            const hp = os==='sehat'?85:os==='hampir'?55:25
            return (
              <div key={u.lid} style={{marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11.5,marginBottom:3}}>
                  <span style={{fontWeight:600}}>{u.name}</span>
                  <span className={`badge ${os==='sehat'?'badge-ok':os==='hampir'?'badge-warn':'badge-error'}`}>{hp}%</span>
                </div>
                <div style={{height:5,background:'var(--bd)',borderRadius:3}}>
                  <div style={{height:'100%',width:`${hp}%`,background:hp>60?'var(--ok)':hp>30?'var(--wn)':'var(--er)',borderRadius:3,transition:'width .6s cubic-bezier(.22,1,.36,1)'}}/>
                </div>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}

function OwBiaya() {
  const [period, setPeriod] = useState('month')
  const [d, setD] = useState({ cats:{}, total:0 })
  useEffect(()=>{
    async function load() {
      const start = period==='month' ? dayjs().startOf('month').format('YYYY-MM-DD') : dayjs().startOf('year').format('YYYY-MM-DD')
      const [costs,solar,svc] = await Promise.all([db.cost_logs.filter(l=>l.date>=start).toArray(),db.solar_logs.filter(l=>l.date>=start).toArray(),db.svc_logs.filter(l=>l.date>=start).toArray()])
      const cats={}
      costs.forEach(c=>{cats[c.category]=(cats[c.category]||0)+(c.amount||0)})
      cats['Solar/BBM']=solar.reduce((a,l)=>a+(l.liters||0)*(l.pricePerLiter||0),0)
      cats['Service']=(cats['Service']||0)+svc.reduce((a,l)=>a+(l.cost||0),0)
      setD({cats,total:Object.values(cats).reduce((a,v)=>a+v,0)})
    }
    load()
  },[period])
  const pieData = Object.entries(d.cats).filter(([,v])=>v>0).map(([name,value])=>({name,value}))
  return (
    <div className="page-enter">
      <div style={{display:'flex',gap:8,marginBottom:14}}>
        {[['month','Bulan Ini'],['year','Tahun Ini']].map(([k,v])=>(
          <button key={k} onClick={()=>setPeriod(k)} className={`btn btn-sm ${period===k?'btn-primary':'btn-secondary'}`}>{v}</button>
        ))}
      </div>
      <div style={{background:'linear-gradient(135deg,var(--prd),var(--pr))',borderRadius:12,padding:'18px 16px',color:'#fff',marginBottom:14}}>
        <div style={{fontSize:11.5,opacity:.8,marginBottom:4}}>Total Biaya {period==='month'?'Bulan Ini':'Tahun Ini'}</div>
        <div style={{fontFamily:'Space Grotesk',fontSize:24,fontWeight:800}}>{rp(d.total)}</div>
      </div>
      {pieData.length>0&&<div className="card" style={{marginBottom:14}}>
        <div className="card-header"><span className="card-title">Distribusi</span></div>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart><Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} style={{fontSize:10}}>
            {pieData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
          </Pie><Tooltip formatter={v=>rp(v)}/></PieChart>
        </ResponsiveContainer>
      </div>}
      <div className="card">
        <div className="card-header"><span className="card-title">Rincian</span></div>
        {Object.entries(d.cats).filter(([,v])=>v>0).sort(([,a],[,b])=>b-a).map(([cat,amt],i)=>{
          const pct=d.total?Math.round(amt/d.total*100):0
          return <div key={cat} style={{marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12.5,marginBottom:3}}>
              <span style={{fontWeight:600}}>{cat}</span>
              <div style={{display:'flex',gap:8}}><span style={{fontSize:11,color:'var(--mu)'}}>{pct}%</span><span style={{fontWeight:700}}>{rp(amt)}</span></div>
            </div>
            <div style={{height:5,background:'var(--bd)',borderRadius:3}}><div style={{height:'100%',width:`${pct}%`,background:`hsl(${i*45+15},56%,50%)`,borderRadius:3}}/></div>
          </div>
        })}
        {d.total===0&&<EmptyState icon="bi-receipt" text="Belum ada data biaya"/>}
      </div>
    </div>
  )
}

function OwSolar() {
  const [rows,setRows]=useState([]); const [trend,setTrend]=useState([])
  useEffect(()=>{
    async function load(){
      const units=await UnitService.getAll(); const allSolar=await SolarService.getAll()
      const r=await Promise.all(units.map(async u=>{const logs=allSolar.filter(l=>l.unit_lid===u.lid);const tL=logs.reduce((a,l)=>a+(l.liters||0),0);const tC=logs.reduce((a,l)=>a+(l.liters||0)*(l.pricePerLiter||0),0);const est=Math.round((u.totalHours||0)*(u.fuelConsumptionPerHour||0));return{...u,tL,tC,est,dev:tL-est}}))
      setRows(r.filter(x=>x.totalHours>0||x.tL>0))
      const tr=[];for(let i=5;i>=0;i--){const m=dayjs().subtract(i,'month');const s=m.startOf('month').format('YYYY-MM-DD'),e=m.endOf('month').format('YYYY-MM-DD');const logs=allSolar.filter(l=>l.date>=s&&l.date<=e);tr.push({label:m.format('MMM'),liters:logs.reduce((a,l)=>a+(l.liters||0),0)})}
      setTrend(tr)
    }
    load()
  },[])
  return (
    <div className="page-enter">
      <div className="stat-grid stagger" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        {[{l:'Total Real',v:`${num(rows.reduce((a,r)=>a+r.tL,0))} L`,c:'#b3700a'},{l:'Total Est.',v:`${num(rows.reduce((a,r)=>a+r.est,0))} L`,c:'var(--ok)'},{l:'Total Biaya',v:rp(rows.reduce((a,r)=>a+r.tC,0)),c:'var(--pr)'}].map(x=><div key={x.l} className="stat-card"><div className="stat-val" style={{fontSize:14,color:x.c}}>{x.v}</div><div className="stat-label">{x.l}</div></div>)}
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">Tren Konsumsi Solar</span></div>
        <ResponsiveContainer width="100%" height={160}><LineChart data={trend}><XAxis dataKey="label" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/><Tooltip formatter={v=>`${num(v)} L`} contentStyle={{fontSize:11,borderRadius:8}}/><Line type="monotone" dataKey="liters" stroke="var(--pr)" strokeWidth={2} dot={{fill:'var(--pr)',r:3}}/></LineChart></ResponsiveContainer>
      </div>
      {rows.length>0&&<div className="card"><div className="card-header"><span className="card-title">Detail per Unit</span></div><div className="table-wrap"><table><thead><tr><th>Unit</th><th>Real (L)</th><th>Selisih</th><th>Biaya</th></tr></thead><tbody>{rows.map(u=><tr key={u.lid}><td style={{fontWeight:600}}>{u.name}</td><td style={{fontWeight:700}}>{num(u.tL)}</td><td style={{color:u.dev>0?'var(--er)':'var(--ok)',fontWeight:600}}>{u.dev>0?'+':''}{num(u.dev)}</td><td style={{color:'var(--er)',fontWeight:600}}>{rp(u.tC)}</td></tr>)}</tbody></table></div></div>}
    </div>
  )
}

function OwMaint() {
  const [d,setD]=useState([])
  const MT=[{t:'ringan'},{t:'sedang'},{t:'besar'},{t:'overhaul'},{t:'perbaikan'}]
  useEffect(()=>{async function load(){const units=await UnitService.getAll();const res=await Promise.all(units.map(async u=>{const logs=await SvcService.getByUnit(u.lid);const bT={};MT.forEach(m=>{bT[m.t]={count:0,cost:0}});logs.forEach(l=>{if(bT[l.maintenanceType]){bT[l.maintenanceType].count++;bT[l.maintenanceType].cost+=l.cost||0}});return{...u,logs,tCost:logs.reduce((a,l)=>a+(l.cost||0),0),tDt:logs.reduce((a,l)=>a+(l.downtimeHours||0),0),bT,os:UnitService.operationalStatus(u)}}));setD(res.sort((a,b)=>b.tCost-a.tCost))}; load()},[])
  return(
    <div className="page-enter">
      <div className="stat-grid stagger" style={{gridTemplateColumns:'repeat(2,1fr)'}}>
        {[{l:'Total Service',v:d.reduce((a,u)=>a+u.logs.length,0),c:'var(--pr)'},{l:'Total Biaya',v:rp(d.reduce((a,u)=>a+u.tCost,0)),c:'var(--er)'},{l:'Total Downtime',v:`${num(d.reduce((a,u)=>a+u.tDt,0))}h`,c:'var(--wn)'},{l:'Overdue',v:d.filter(u=>u.os==='overdue').length,c:'var(--er)'}].map(x=><div key={x.l} className="stat-card"><div className="stat-val" style={{fontSize:16,color:x.c}}>{x.v}</div><div className="stat-label">{x.l}</div></div>)}
      </div>
      <div className="card"><div className="card-header"><span className="card-title">Detail per Unit</span></div>
        {d.length===0?<EmptyState icon="bi-tools" text="Belum ada data"/>:<div className="table-wrap"><table><thead><tr><th>Unit</th><th>Status</th><th>Service</th><th>Biaya</th><th>Downtime</th></tr></thead><tbody>{d.map(u=><tr key={u.lid}><td style={{fontWeight:600}}>{u.name}</td><td><span className={`badge ${u.os==='sehat'?'badge-ok':u.os==='hampir'?'badge-warn':'badge-error'}`}>{u.os==='sehat'?'Sehat':u.os==='hampir'?'Hampir':'Overdue'}</span></td><td style={{fontWeight:700}}>{u.logs.length}x</td><td style={{color:'var(--er)',fontWeight:600}}>{rp(u.tCost)}</td><td>{u.tDt?`${u.tDt}h`:'-'}</td></tr>)}</tbody></table></div>}
      </div>
    </div>
  )
}

function OwRank() {
  const [d,setD]=useState([])
  useEffect(()=>{async function load(){const units=await UnitService.getAll();const res=await Promise.all(units.map(async u=>{const[costs,solar,svc]=await Promise.all([CostService.getAll(),SolarService.getByUnit(u.lid),SvcService.getByUnit(u.lid)]);const unitCosts=costs.filter(c=>c.unit_lid===u.lid);const tC=unitCosts.reduce((a,c)=>a+(c.amount||0),0)+solar.reduce((a,l)=>a+(l.liters||0)*(l.pricePerLiter||0),0)+svc.reduce((a,l)=>a+(l.cost||0),0);const tD=svc.reduce((a,l)=>a+(l.downtimeHours||0),0);const os=UnitService.operationalStatus(u);const hp=os==='sehat'?85:os==='hampir'?55:25;const score=Math.max(0,Math.min(100,Math.round(hp-(u.totalHours?(tD/u.totalHours)*50:0))));return{...u,tC,tD,cph:u.totalHours>0?tC/u.totalHours:0,score,os}}));setD(res.sort((a,b)=>b.score-a.score))}; load()},[])
  return(
    <div className="page-enter"><div className="card"><div className="card-header"><span className="card-title">🏆 Ranking Performa Unit</span></div>
      {d.length===0?<EmptyState icon="bi-trophy" text="Belum ada data unit"/>:d.map((u,i)=><div key={u.lid} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:i<d.length-1?'1px solid var(--bd)':'none'}}>
        <div style={{width:26,height:26,borderRadius:'50%',background:i<3?'var(--ac)':'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:11,color:i<3?'var(--prd)':'var(--mu)',flexShrink:0}}>#{i+1}</div>
        <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u.name}</div><div style={{fontSize:11,color:'var(--mu)'}}>{num(u.totalHours)}h · {rp(u.tC)}</div><div style={{height:4,background:'var(--bd)',borderRadius:2,marginTop:4}}><div style={{height:'100%',width:`${u.score}%`,background:u.score>70?'var(--ok)':u.score>40?'var(--wn)':'var(--er)',borderRadius:2}}/></div></div>
        <div style={{textAlign:'right',flexShrink:0}}><div style={{fontFamily:'Space Grotesk',fontWeight:800,fontSize:20,color:u.score>70?'var(--ok)':u.score>40?'var(--wn)':'var(--er)',lineHeight:1}}>{u.score}</div><div style={{fontSize:9.5,color:'var(--mu)'}}>SKOR</div></div>
      </div>)}
    </div></div>
  )
}

function OwDep() {
  const [d,setD]=useState([])
  useEffect(()=>{UnitService.getAll().then(units=>{const r=units.filter(u=>u.purchasePrice).map(u=>{const ann=u.purchasePrice&&u.economicLifeYears?(u.purchasePrice*(1-(u.residualPercent||10)/100))/u.economicLifeYears:0;const yrs=new Date().getFullYear()-(u.purchaseYear||new Date().getFullYear());const res=u.purchasePrice*((u.residualPercent||10)/100);const bv=Math.max(res,u.purchasePrice-ann*yrs);const pct=u.purchasePrice?Math.round((1-bv/u.purchasePrice)*100):0;return{...u,ann,bv,yrs,pct}}).sort((a,b)=>b.pct-a.pct);setD(r)})},[])
  return(
    <div className="page-enter">
      <div className="stat-grid stagger" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        {[{l:'Total Nilai Beli',v:rp(d.reduce((a,u)=>a+(u.purchasePrice||0),0)),c:'var(--pr)'},{l:'Total Nilai Buku',v:rp(d.reduce((a,u)=>a+u.bv,0)),c:'var(--ok)'},{l:'Dep/Tahun',v:rp(d.reduce((a,u)=>a+u.ann,0)),c:'var(--wn)'}].map(x=><div key={x.l} className="stat-card"><div className="stat-val" style={{fontSize:13,color:x.c}}>{x.v}</div><div className="stat-label">{x.l}</div></div>)}
      </div>
      {d.length===0?<EmptyState icon="bi-graph-down" text="Tambahkan harga beli pada data unit"/>:<div className="card"><div className="card-header"><span className="card-title">Detail Depresiasi</span></div><div className="table-wrap"><table><thead><tr><th>Unit</th><th>Harga Beli</th><th>Nilai Buku</th><th>Terdepresiasi</th></tr></thead><tbody>{d.map(u=><tr key={u.lid}><td><div style={{fontWeight:600}}>{u.name}</div><div style={{fontSize:10,color:'var(--mu)'}}>{u.purchaseYear} ({u.yrs}th)</div></td><td style={{fontWeight:700}}>{rp(u.purchasePrice||0)}</td><td style={{fontWeight:700,color:'var(--pr)'}}>{rp(u.bv)}</td><td style={{minWidth:100}}><div style={{display:'flex',alignItems:'center',gap:6}}><div style={{flex:1,height:5,background:'var(--bd)',borderRadius:3}}><div style={{height:'100%',width:`${u.pct}%`,background:u.pct>70?'var(--er)':u.pct>40?'var(--wn)':'var(--ok)',borderRadius:3}}/></div><span style={{fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>{u.pct}%</span></div></td></tr>)}</tbody></table></div></div>}
    </div>
  )
}

function OwSpare() {
  const [stock,setStock]=useState([]); const [msg,showMsg]=useToast(); const [modal,setModal]=useState(null); const [confirm,setConfirm]=useState(null); const [f,setF]=useState({name:'',qty:0,unit:'pcs',minQty:2}); const sf=(k,v)=>setF(p=>({...p,[k]:v}))
  const load=useCallback(async()=>setStock(await StockService.getAll()),[])
  useEffect(()=>{load()},[load])
  const low=stock.filter(s=>(s.qty||0)<=(s.minQty||2))
  return(
    <div className="page-enter"><Toast msg={msg}/>
      {low.length>0&&<div className="alert alert-error"><i className="bi bi-exclamation-octagon-fill"/>{low.length} item stok menipis!</div>}
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:8}}><button className="btn btn-primary btn-sm" onClick={()=>{setF({name:'',qty:0,unit:'pcs',minQty:2});setModal('add')}}><i className="bi bi-plus-lg"/>Tambah</button></div>
      {stock.length===0?<EmptyState icon="bi-archive" text="Belum ada stok spare part"/>:<div className="card"><div className="table-wrap"><table><thead><tr><th>Nama Part</th><th>Stok</th><th>Status</th><th></th></tr></thead><tbody>{stock.map(s=><tr key={s.lid}><td style={{fontWeight:600}}>{s.name}</td><td style={{fontWeight:700,color:(s.qty||0)<=(s.minQty||2)?'var(--er)':'var(--ok)'}}>{s.qty||0} {s.unit||'pcs'}</td><td><span className={`badge ${(s.qty||0)<=0?'badge-error':(s.qty||0)<=(s.minQty||2)?'badge-warn':'badge-ok'}`}>{(s.qty||0)<=0?'Habis':(s.qty||0)<=(s.minQty||2)?'Menipis':'Aman'}</span></td><td style={{display:'flex',gap:4}}><button className="btn-icon btn-sm" onClick={()=>{setF({...s});setModal('edit')}}><i className="bi bi-pencil"/></button><button className="btn-icon btn-sm" onClick={()=>setConfirm(s)}><i className="bi bi-trash3"/></button></td></tr>)}</tbody></table></div></div>}
      {(modal==='add'||modal==='edit')&&<div className="modal-overlay" onClick={()=>setModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-title">{modal==='add'?'Tambah':'Edit'} Stok</div><div className="form-group"><label className="form-label">Nama Part</label><input className="form-input" value={f.name} onChange={e=>sf('name',e.target.value)}/></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}><div className="form-group"><label className="form-label">Stok</label><input type="number" className="form-input" value={f.qty} onChange={e=>sf('qty',e.target.value)} inputMode="numeric"/></div><div className="form-group"><label className="form-label">Min</label><input type="number" className="form-input" value={f.minQty} onChange={e=>sf('minQty',e.target.value)}/></div><div className="form-group"><label className="form-label">Satuan</label><input className="form-input" value={f.unit} onChange={e=>sf('unit',e.target.value)}/></div></div><div className="modal-footer"><button className="btn btn-primary btn-full" onClick={async()=>{if(f.lid)await StockService.update(f.lid,f);else await StockService.add(f);showMsg('Tersimpan!');setModal(null);load()}} disabled={!f.name}><i className="bi bi-floppy-fill"/>Simpan</button><button className="btn btn-secondary" onClick={()=>setModal(null)}>Batal</button></div></div></div>}
      {confirm&&<ConfirmModal msg={`Hapus "${confirm.name}"?`} onConfirm={async()=>{await StockService.delete(confirm.lid);showMsg('Dihapus');setConfirm(null);load()}} onClose={()=>setConfirm(null)}/>}
    </div>
  )
}

function OwExport() {
  const [msg,showMsg]=useToast(); const [loading,setLoading]=useState(''); const [exportMonth,setExportMonth]=useState(dayjs().format('YYYY-MM'))
  const doExport=async(type)=>{setLoading(type);try{if(type==='service')await exportServiceLog();else if(type==='solar')await exportSolarLog();else if(type==='inspeksi')await exportInspeksiLog();else if(type==='bulanan'){const[year,month]=exportMonth.split('-').map(Number);await exportRingkasanBulanan(year,month)};showMsg('✅ File berhasil didownload!')}catch(e){showMsg('❌ Export gagal')};setLoading('')}
  return(
    <div className="page-enter"><Toast msg={msg}/>
      <div className="card"><div className="card-header"><span className="card-title">📊 Export Bulanan</span></div><div style={{display:'flex',gap:10,alignItems:'flex-end'}}><div className="form-group" style={{flex:1,marginBottom:0}}><label className="form-label">Pilih Bulan</label><input type="month" className="form-input" value={exportMonth} onChange={e=>setExportMonth(e.target.value)}/></div><button className="btn btn-primary" onClick={()=>doExport('bulanan')} disabled={loading==='bulanan'}><i className="bi bi-file-earmark-excel-fill"/>{loading==='bulanan'?'...':'Download'}</button></div></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10}}>
        {[{type:'service',ico:'🔧',title:'Service Log'},{type:'solar',ico:'⛽',title:'Solar Log'},{type:'inspeksi',ico:'📋',title:'Inspeksi'}].map(c=><div key={c.type} className="card" style={{textAlign:'center'}}><div style={{fontSize:24,marginBottom:6}}>{c.ico}</div><div style={{fontWeight:700,fontSize:13,marginBottom:10}}>{c.title}</div><button className="btn btn-secondary btn-full btn-sm" onClick={()=>doExport(c.type)} disabled={loading===c.type}><i className="bi bi-download"/>{loading===c.type?'...':'Excel'}</button></div>)}
      </div>
    </div>
  )
}

function OwSync() {
  const {online,syncing,lastSync,doSync}=useSync(); const [prog,setProg]=useState(''); const [pulling,setPulling]=useState(false); const [msg,showMsg]=useToast()
  const pullAll=async()=>{if(!online){showMsg('Tidak ada koneksi');return};setPulling(true);setProg('Memulai...');const res=await pullFromCloud(m=>setProg(m));setPulling(false);if(res.success){showMsg('✅ Berhasil!');setProg('Selesai ✓')}else{showMsg('❌ Gagal: '+res.error);setProg('')}}
  return(
    <div className="page-enter"><Toast msg={msg}/>
      <div className="card"><div className="card-header"><span className="card-title">Status Jaringan</span></div><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>{[{l:'Jaringan',v:online?'🟢 Online':'🔴 Offline'},{l:'Status',v:syncing?'⏳ Proses...':'✅ Idle'},{l:'Terakhir Sync',v:lastSync?lastSync.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}):'-'}].map(x=><div key={x.l} style={{background:'var(--bg)',borderRadius:8,padding:'10px 12px'}}><div style={{fontSize:10,color:'var(--mu)',fontWeight:600,marginBottom:3}}>{x.l}</div><div style={{fontFamily:'Space Grotesk',fontWeight:700,fontSize:12}}>{x.v}</div></div>)}</div></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div className="card" style={{textAlign:'center'}}><div style={{fontSize:24,marginBottom:8}}>📤</div><div style={{fontWeight:700,fontSize:13,marginBottom:4}}>Push ke Cloud</div><div style={{fontSize:11,color:'var(--mu)',marginBottom:12}}>Kirim data pending</div><button className="btn btn-primary btn-full btn-sm" onClick={doSync} disabled={!online||syncing}><i className={`bi ${syncing?'bi-arrow-repeat spin':'bi-cloud-upload-fill'}`}/>{syncing?'Sync...':'Push'}</button></div>
        <div className="card" style={{textAlign:'center'}}><div style={{fontSize:24,marginBottom:8}}>📥</div><div style={{fontWeight:700,fontSize:13,marginBottom:4}}>Pull dari Cloud</div>{prog&&<div style={{fontSize:10,color:'var(--in)',marginBottom:8}}>{prog}</div>}<div style={{fontSize:11,color:'var(--mu)',marginBottom:12}}>Ambil semua data</div><button className="btn btn-secondary btn-full btn-sm" onClick={pullAll} disabled={!online||pulling}><i className={`bi ${pulling?'bi-arrow-repeat spin':'bi-cloud-download-fill'}`}/>{pulling?'...':'Pull'}</button></div>
      </div>
      <div className="card"><div className="card-header"><span className="card-title">📱 Cara Install di HP</span></div>{[['1','Buka di Safari (iOS) atau Chrome (Android)'],['2','iOS: Tap Share → "Add to Home Screen"'],['3','Android: Tap menu ⋮ → "Add to Home Screen"'],['4','Tap Add — app muncul di home screen']].map(([n,t])=><div key={n} style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:10}}><div style={{width:22,height:22,borderRadius:'50%',background:'var(--pr)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:10,flexShrink:0}}>{n}</div><span style={{fontSize:13}}>{t}</span></div>)}</div>
    </div>
  )
}

const OWNER_PAGES = { dashboard:OwDash, biaya:OwBiaya, solar:OwSolar, maint:OwMaint, ranking:OwRank, dep:OwDep, spare:OwSpare, export:OwExport, sync:OwSync, notes:DailyNotesPage }

// ── MAIN OWNER SHELL — sama kayak operator (topbar + hamburger) ──
export default function OwnerDashboard({ onClose }) {
  const [tab, setTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const Page = OWNER_PAGES[tab] || OwDash
  const currentTab = OWNER_TABS.find(t => t.id === tab)

  const navigate = (id) => { setTab(id); setSidebarOpen(false) }

  return (
    <div style={{ height:'100vh', height:'100dvh', display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg)' }}>

      {/* Topbar — mobile only */}
      <div className="owner-topbar">
        <button onClick={() => setSidebarOpen(o => !o)} style={{ background:'none', border:'none', color:'var(--ac)', fontSize:22, cursor:'pointer', padding:4, display:'flex', alignItems:'center' }}>
          <i className="bi bi-list"/>
        </button>
        <span style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:16, color:'var(--ac)', flex:1 }}>
          👑 {currentTab?.label || 'Owner'}
        </span>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,.1)', border:'none', color:'rgba(255,255,255,.7)', fontSize:12, fontWeight:600, padding:'6px 12px', borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
          <i className="bi bi-x-circle"/> Tutup
        </button>
      </div>

      {/* Sidebar overlay */}
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:290 }}/>}

      {/* Sidebar */}
      <div className={`owner-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div style={{ padding:'20px 16px 12px', borderBottom:'1px solid rgba(255,255,255,.08)' }}>
          <div style={{ fontFamily:'Space Grotesk', fontWeight:800, fontSize:18, color:'var(--ac)' }}>👑 Owner Panel</div>
          <div style={{ fontSize:11, color:'rgba(212,184,150,.6)', marginTop:3 }}>SCRAPERS Dashboard</div>
        </div>
        <nav style={{ flex:1, overflowY:'auto', padding:8, WebkitOverflowScrolling:'touch' }}>
          {OWNER_TABS.map(item => (
            <div key={item.id}>
              {item.section && <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,.3)', letterSpacing:1, textTransform:'uppercase', padding:'10px 8px 3px' }}>{item.section}</div>}
              <button onClick={() => navigate(item.id)} style={{
                display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:9,
                color: tab===item.id ? '#fff' : 'rgba(255,255,255,.6)',
                fontSize:13, fontWeight:600, cursor:'pointer',
                border:'none', background: tab===item.id ? 'var(--pr)' : 'transparent',
                width:'100%', textAlign:'left', transition:'all .15s', position:'relative',
              }}>
                {tab===item.id && <div style={{ position:'absolute', left:0, top:'50%', transform:'translateY(-50%)', width:3, height:'60%', background:'var(--ac)', borderRadius:'0 3px 3px 0' }}/>}
                <i className={`bi ${item.icon}`} style={{ fontSize:15, width:18 }}/>{item.label}
              </button>
            </div>
          ))}
        </nav>
        <div style={{ padding:'12px 8px', borderTop:'1px solid rgba(255,255,255,.08)' }}>
          <button onClick={onClose} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:9, color:'rgba(255,255,255,.4)', fontSize:13, fontWeight:600, cursor:'pointer', border:'none', background:'transparent', width:'100%' }}>
            <i className="bi bi-x-circle" style={{ fontSize:15 }}/> Tutup Owner Panel
          </button>
        </div>
      </div>

      {/* Page content */}
      <div className="owner-main-content">
        <div key={tab}>
          <Page/>
        </div>
      </div>
    </div>
  )
}
