import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { login } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (pin.length < 4) { setError('PIN minimal 4 digit'); return }
    setLoading(true)
    setError('')
    const res = await login(pin)
    if (!res.success) { setError('PIN salah. Coba lagi.'); setPin('') }
    setLoading(false)
  }

  const handleKey = (e) => { if (e.key === 'Enter') handleLogin() }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sb)', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: '100%', maxWidth: 360, textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,.3)' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>⛏</div>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 24, color: 'var(--sb)', marginBottom: 4 }}>SCRAPERS</div>
        <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 28 }}>Tambang System · Masuk dengan PIN</div>

        <div style={{ marginBottom: 16 }}>
          <input
            type="password"
            inputMode="numeric"
            className="form-input"
            placeholder="Masukkan PIN"
            value={pin}
            onChange={e => setPin(e.target.value)}
            onKeyDown={handleKey}
            style={{ textAlign: 'center', fontSize: 20, letterSpacing: 6, fontWeight: 700 }}
            autoFocus
          />
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 12, justifyContent: 'center' }}>{error}</div>}

        <button
          className="btn btn-primary btn-full"
          onClick={handleLogin}
          disabled={loading || pin.length < 4}
          style={{ padding: '12px', fontSize: 15, opacity: (loading || pin.length < 4) ? .6 : 1 }}
        >
          {loading ? 'Memeriksa...' : 'Masuk'}
        </button>

        <div style={{ marginTop: 20, fontSize: 11, color: 'var(--mu)', lineHeight: 1.6 }}>
          Owner: PIN 251025<br/>
          Operator 1: PIN 1111 · Operator 2: PIN 2222 · Mandor: PIN 3333
        </div>
      </div>
    </div>
  )
}
