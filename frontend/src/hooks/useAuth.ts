import { useState, useEffect } from 'react'
import { auth } from '@/lib/auth'
import { api } from '@/lib/api'

export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(auth.isLoggedIn())
  const [setupRequired, setSetupRequired] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const check = () => {
      api.authCheck()
        .then((data: { has_user: boolean; setup_required: boolean }) => {
          if (cancelled) return
          setError(null)
          setSetupRequired(data.setup_required)
          setIsLoggedIn(auth.isLoggedIn())
        })
        .catch(() => {
          if (cancelled) return
          // The API being unreachable on first load is usually the tray app
          // still starting up, not a permanent failure — keep retrying
          // instead of leaving the user stuck behind a disabled form until
          // they manually refresh the page.
          setError('Slimarr is still starting or the local API is unreachable.')
          retryTimer = setTimeout(check, 3000)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }

    check()
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [])

  const login = async (username: string, password: string) => {
    const data = await api.login(username, password)
    auth.setToken(data.token)
    setIsLoggedIn(true)
  }

  const register = async (username: string, password: string) => {
    const data = await api.register(username, password)
    auth.setToken(data.token)
    setIsLoggedIn(true)
    setSetupRequired(false)
  }

  const logout = () => {
    auth.removeToken()
    setIsLoggedIn(false)
  }

  return { isLoggedIn, setupRequired, loading, error, login, register, logout }
}
