import { useEffect, useState } from 'react'

export type ThemePref = 'dark' | 'light' | 'system'
const STORAGE_KEY = 'oinarri_login_theme'
const VALID_PREFS: ThemePref[] = ['dark', 'light', 'system']

function readStoredPref(): ThemePref {
  const stored = localStorage.getItem(STORAGE_KEY)
  return VALID_PREFS.includes(stored as ThemePref) ? (stored as ThemePref) : 'system'
}

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function useLoginTheme() {
  const [pref, setPref] = useState<ThemePref>(readStoredPref)
  // Реактивен только на смену темы ОС (matchMedia listener) — сам переключатель темы
  // (setPref) не ждёт этот стейт, resolved считается прямо в рендере ниже, синхронно,
  // без лишнего тика и мигания старой темой на один кадр.
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, pref)
  }, [pref])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolved: 'dark' | 'light' = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref
  return { pref, setPref, resolved }
}
