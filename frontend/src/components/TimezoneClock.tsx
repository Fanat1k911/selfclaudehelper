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

// Живёт только на LoginPage — стилизуется через те же CSS-переменные темы логина
// (--login-*, см. index.css), поэтому светлая/тёмная/системная тема совпадает с карточкой
// без отдельного набора классов.
export function TimezoneClock({ hidden = false }: { hidden?: boolean }) {
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

  return (
    <div
      className={`fixed bottom-4 right-4 rounded-xl border px-4 py-3 text-right shadow-lg shadow-black/10 backdrop-blur-xl transition-opacity duration-200 ${
        hidden ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{ background: 'var(--login-card-bg)', borderColor: 'var(--login-card-border)' }}
    >
      {!tz ? (
        <select
          value=""
          onChange={(e) => selectTz(e.target.value)}
          className="rounded-lg border bg-transparent px-2 py-1 text-xs outline-none"
          style={{ borderColor: 'var(--login-input-border)', color: 'var(--login-text)' }}
        >
          <option value="" disabled>
            Часовой пояс…
          </option>
          {/* Раскрытый список опций рисует ОС/браузер, не наша тема (обычно белый фон
              независимо от data-login-theme) — чёрный текст читаем в обоих случаях. */}
          {TIMEZONES.map((t) => (
            <option key={t.value} value={t.value} style={{ color: '#000' }}>
              {t.label}
            </option>
          ))}
        </select>
      ) : (
        <button onClick={() => selectTz('')} className="block w-full text-right" title="Сменить часовой пояс">
          <div className="text-lg font-semibold tabular-nums" style={{ color: 'var(--login-text)' }}>
            {formatParts(now, tz).time}
          </div>
          <div className="text-xs" style={{ color: 'var(--login-text-muted)' }}>
            {formatParts(now, tz).date}, {formatParts(now, tz).weekday}
          </div>
        </button>
      )}
    </div>
  )
}
