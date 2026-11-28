import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import type { Tables } from '../lib/database.types'
import { supabase } from '../lib/supabase'

type AuthState = {
  session: Session | null
  profile: Tables<'profiles'> | null
  /** the profile couldn't be loaded: don't offer forms that would overwrite it with blanks */
  profileFailed: boolean
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)
let profileGen = 0
let currentUid: string | null = null // the signed-in account right now; older requests must not write

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  // remembers which user the profile was loaded for, so "not loaded yet" differs from "no profile"
  const [loaded, setLoaded] = useState<{ uid: string | null; profile: Tables<'profiles'> | null; failed?: boolean }>({ uid: null, profile: null })
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const loadProfile = async (s: Session | null) => {
    if (s && s.user.id !== currentUid) return // a refresh for an account that has since signed out: ignore, don't cancel the current load
    const g = ++profileGen // only the newest request may write; sign-out also invalidates pending ones
    if (!s) return setLoaded({ uid: null, profile: null })
    const { data, error } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle()
    if (g === profileGen && currentUid === s.user.id) setLoaded({ uid: s.user.id, profile: error ? null : data, failed: !!error })
  }

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      currentUid = data.session?.user.id ?? null
      setSession(data.session)
      await loadProfile(data.session)
      setLoading(false)
      // drop the one-time ?code= left by OAuth / email links
      if (new URLSearchParams(window.location.search).has('code'))
        window.history.replaceState(null, '', window.location.pathname + window.location.hash)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      currentUid = s?.user.id ?? null
      setSession(s)
      // never await Supabase calls inside this callback (it holds the auth lock)
      setTimeout(() => { if (active) void loadProfile(s) }, 0)
      if (event === 'PASSWORD_RECOVERY') navigate('/reset-password')
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [navigate])

  const profile = session && loaded.uid === session.user.id ? loaded.profile : null
  const value: AuthState = {
    session,
    profile,
    profileFailed: !!session && loaded.uid === session.user.id && !!loaded.failed,
    loading: loading || (!!session && loaded.uid !== session.user.id),
    refreshProfile: () => loadProfile(session),
    signOut: async () => {
      await supabase.auth.signOut()
      navigate('/')
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
