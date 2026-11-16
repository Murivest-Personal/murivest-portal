'use client'

import {createContext, useCallback, useContext, useState} from 'react'
import AuthModal, {type Mode} from './AuthModal'

interface AuthModalContextValue {
  open: (mode?: Mode) => void
}

const AuthModalContext = createContext<AuthModalContextValue>({open: () => {}})

export function useAuthModal() {
  return useContext(AuthModalContext)
}

/** Page-level provider — one modal instance, triggered from any CTA. */
export function AuthModalProvider({
  children,
  authRequired = false,
}: {
  children: React.ReactNode
  authRequired?: boolean
}) {
  const [open, setOpen] = useState(() => authRequired)
  const [mode, setMode] = useState<Mode>('signin')

  const openModal = useCallback((m: Mode = 'signin') => {
    setMode(m)
    setOpen(true)
  }, [])

  return (
    <AuthModalContext.Provider value={{open: openModal}}>
      {children}
      <AuthModal open={open} initialMode={mode} onClose={() => setOpen(false)} />
    </AuthModalContext.Provider>
  )
}
