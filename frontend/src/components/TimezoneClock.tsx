import { useEffect, useState } from 'react'

const TIMEZONES: { value: string; label: string }[] = [
  { value: 'Europe/Kaliningrad', label: 'Калининград (МСК−1)' },
  { value: 'Europe/Moscow', label: 'Москва (МСК)' },
  { value: 'Europe/Samara', label: 'Самара (МСК+1)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (МСК+2)' },
  { value: 'Asia/Omsk', label: 'Омск (МСК+3)' },
  { value: 'Asia/Krasnoyarsk', label: 'Красноярск (МСК+4)' },
  { value: 'Asia/Irkutsk', label: 'Иркутск (МСК+5)' },
  { value: 'Asia/Yakutsk', label: 'Якутск (МСК+6)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток (МСК+7)' },
  { value: 'Asia/Magadan', label: 'Магадан (МСК+8)' },
  { value: 'Asia/Kamchatka', label: 'Камчатка (МСК+9)' },
]

const STORAGE_KEY = 'oinarri_timezone'

function formatParts(now: Date, tz: string) {
  const date = new Intl.DateTimeFormat('ru-RU', {
    timeZone: tz,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(now)
  const weekday = new Intl.DateTimeFormat('ru-RU', { timeZone: tz, weekday: 'long' }).format(now)
  const time = new Intl.DateTimeFormat('ru-RU', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now)
  return { date, weekday, time }
}

export function TimezoneClock({ dark = false }: { dark?: boolean }) {
  const [tz, setTz] = useState(() => localStorage.getItem(STORAGE_KEY) || '')
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    if (!tz) return
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [tz])

  function selectTz(value: string) {
    setTz(value)
    localStorage.setItem(STORAGE_KEY, value)
    setNow(new Date())
  }

  const wrapClass = dark
    ? 'fixed bottom-4 right-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-right shadow-lg shadow-black/20 backdrop-blur-xl'
    : 'fixed bottom-4 right-4 rounded-xl border border-ink/10 bg-white/90 px-4 py-3 text-right shadow-sm backdrop-blur'
  const selectClass = dark
    ? 'rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-white outline-none focus:border-terracotta/70'
    : 'rounded-lg border border-ink/10 px-2 py-1 text-xs text-ink outline-none focus:border-terracotta'
  const timeClass = dark ? 'text-lg font-semibold tabular-nums text-white' : 'text-lg font-semibold tabular-nums text-ink'
  const dateClass = dark ? 'text-xs text-white/40' : 'text-xs text-ink/50'

  return (
    <div className={wrapClass}>
      {!tz ? (
        <select value="" onChange={(e) => selectTz(e.target.value)} className={selectClass}>
          <option value="" disabled>
            Часовой пояс…
          </option>
          {TIMEZONES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      ) : (
        <button onClick={() => selectTz('')} className="block w-full text-right" title="Сменить часовой пояс">
          <div className={timeClass}>{formatParts(now, tz).time}</div>
          <div className={dateClass}>
            {formatParts(now, tz).date}, {formatParts(now, tz).weekday}
          </div>
        </button>
      )}
    </div>
  )
}
