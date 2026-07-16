import { useEffect, useState } from 'react'

export type ThemePref = 'dark' | 'light' | 'system'
const STORAGE_KEY = 'oinarri_login_theme'

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolve(pref: ThemePref): 'dark' | 'light' {
  return pref === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : pref
}

export function useLoginTheme() {
  const [pref, setPref] = useState<ThemePref>(() => (localStorage.getItem(STORAGE_KEY) as ThemePref) || 'system')
  const [resolved, setResolved] = useState<'dark' | 'light'>(() => resolve(pref))

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, pref)
    setResolved(resolve(pref))
    if (pref !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setResolved(resolve('system'))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [pref])

  return { pref, setPref, resolved }
}
