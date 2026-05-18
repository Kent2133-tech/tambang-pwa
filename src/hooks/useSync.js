import { useState, useEffect, useRef } from 'react'
import { processSyncQueue } from '../services/dataServices'

export function useSync(intervalMs = 30000) {
  const [online, setOnline] = useState(navigator.onLine)
  const [lastSync, setLastSync] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const timerRef = useRef(null)

  const doSync = async () => {
    if (!navigator.onLine || syncing) return
    setSyncing(true)
    try {
      await processSyncQueue()
      setLastSync(new Date())
    } catch (e) {
      console.warn('Sync failed:', e)
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    const onOnline = () => { setOnline(true); doSync() }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    timerRef.current = setInterval(doSync, intervalMs)
    doSync()
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(timerRef.current)
    }
  }, [])

  return { online, lastSync, syncing, doSync }
}
