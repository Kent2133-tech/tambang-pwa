import { createContext, useContext, useState, useEffect } from 'react'
import { OperatorService } from '../services/dataServices'

const AuthCtx = createContext(null)

// No login needed — default to mandor/operator view
export function AuthProvider({ children }) {
  const [user] = useState({ name: 'Operator', role: 'operator', active: 1 })
  const isOwner = false
  const isMandor = true
  return (
    <AuthCtx.Provider value={{ user, isOwner, isMandor, loading: false }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
