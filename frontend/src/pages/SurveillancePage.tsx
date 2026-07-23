import { useEffect, useRef, useState, type FormEvent } from 'react'
import Hls from 'hls.js'
import { Camera, Pencil, Video, WifiOff } from 'lucide-react'
import { apiFetch, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { usePremiumBackground } from '../lib/usePremiumBackground'
import type { CameraSettings, Screenshot } from '../types'
import { SkeletonRows } from '../components/SkeletonRows'

function formatDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ru-RU')
}

// Phase 1 (2026-07-23) — только живой просмотр, без записи/перемотки (см. CLAUDE.md).
// Формат потока определяем по расширению URL: .m3u8 — HLS (мост ffmpeg RTSP→HLS через
// Tailscale Funnel), иначе — прямой HTTP/MJPEG-поток с самой камеры, если она такое отдаёт.
function isHls(url: string) {
  return url.trim().toLowerCase().endsWith('.m3u8')
}

function SettingsForm({
  initialUrl,
  onSaved,
  onCancel,
}: {
  initialUrl: string
  onSaved: (url: string | null) => void
  onCancel: (() => void) | null
}) {
  const [url, setUrl] = useState(initialUrl)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const trimmed = url.trim()
      const resp = await apiFetch<CameraSettings>('/surveillance/settings', {
        method: 'PUT',
        body: JSON.stringify({ stream_url: trimmed || null }),
      })
      onSaved(resp.stream_url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-premium-border bg-premium-surface p-4 space-y-3">
      <div>
        <label className="block text-xs text-premium-text/60 mb-1">Адрес потока (.m3u8 или прямой HTTP/MJPEG)</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://camera.<tailnet>.ts.net/stream.m3u8"
          className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
        />
      </div>
      {error && <div className="text-sm text-red-400">{error}</div>}
      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-premium-border py-2 text-sm font-medium text-premium-text hover:bg-premium-surface-2"
          >
            Отмена
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-premium-gold py-2 text-sm font-medium text-premium-bg hover:bg-premium-gold-hi disabled:opacity-60"
        >
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </div>
    </form>
  )
}

export function SurveillancePage() {
  usePremiumBackground()
  const { user } = useAuth()
  const canManage = user?.role === 'founder' || user?.role === 'developer'

  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [editingSettings, setEditingSettings] = useState(false)

  const [screenshots, setScreenshots] = useState<Screenshot[]>([])
  const [loadingShots, setLoadingShots] = useState(true)
  const [savingShot, setSavingShot] = useState(false)
  const [shotError, setShotError] = useState<string | null>(null)
  const [streamError, setStreamError] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const hlsRef = useRef<Hls | null>(null)

  async function loadScreenshots() {
    setLoadingShots(true)
    try {
      setScreenshots(await apiFetch<Screenshot[]>('/surveillance/screenshots'))
    } finally {
      setLoadingShots(false)
    }
  }

  useEffect(() => {
    apiFetch<CameraSettings>('/surveillance/settings')
      .then((s) => setStreamUrl(s.stream_url))
      .finally(() => setLoadingSettings(false))
    loadScreenshots()
  }, [])

  useEffect(() => {
    setStreamError(false)
    if (!streamUrl || !isHls(streamUrl)) return
    const video = videoRef.current
    if (!video) return

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari — нативная поддержка HLS, hls.js не нужен.
      video.src = streamUrl
      return
    }
    if (Hls.isSupported()) {
      const hls = new Hls()
      hlsRef.current = hls
      hls.loadSource(streamUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) setStreamError(true)
      })
      return () => {
        hls.destroy()
        hlsRef.current = null
      }
    }
    setStreamError(true)
  }, [streamUrl])

  async function handleScreenshot() {
    setShotError(null)
    const source = streamUrl && isHls(streamUrl) ? videoRef.current : imgRef.current
    if (!source) return
    try {
      const canvas = document.createElement('canvas')
      const w = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth
      const h = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight
      if (!w || !h) {
        setShotError('Поток ещё не готов — подожди пару секунд и попробуй снова.')
        return
      }
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(source, 0, 0, w, h)
      const dataUrl = canvas.toDataURL('image/png')

      setSavingShot(true)
      await apiFetch('/surveillance/screenshots', {
        method: 'POST',
        body: JSON.stringify({ image_base64: dataUrl, comment: '' }),
      })
      await loadScreenshots()
    } catch (err) {
      // Canvas "tainted" — источник потока не отдаёт CORS-заголовки (Access-Control-Allow-Origin).
      // Чинится на стороне моста/камеры, не здесь.
      setShotError(
        err instanceof DOMException && err.name === 'SecurityError'
          ? 'Источник потока не разрешает сохранение кадра (нет CORS-заголовков) — нужно настроить на стороне моста камеры.'
          : 'Не удалось сохранить скриншот.',
      )
    } finally {
      setSavingShot(false)
    }
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-premium-bg px-4 py-4 sm:px-8 sm:py-6">
      <div className="premium-grain" aria-hidden />
      <div className="relative mb-6 flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold italic text-premium-text sm:text-2xl">Видеонаблюдение</h1>
        {canManage && streamUrl && !editingSettings && (
          <button
            onClick={() => setEditingSettings(true)}
            className="flex items-center gap-1.5 text-xs text-premium-text/50 hover:text-premium-gold-hi"
          >
            <Pencil size={13} /> Настроить поток
          </button>
        )}
      </div>

      {editingSettings && (
        <div className="relative mb-6 max-w-xl">
          <SettingsForm
            initialUrl={streamUrl ?? ''}
            onCancel={streamUrl ? () => setEditingSettings(false) : null}
            onSaved={(url) => {
              setStreamUrl(url)
              setEditingSettings(false)
            }}
          />
        </div>
      )}

      {!editingSettings && !loadingSettings && !streamUrl && (
        <div className="relative mb-6 max-w-xl space-y-3">
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-premium-border bg-premium-surface text-premium-text/40">
            <WifiOff className="h-10 w-10" strokeWidth={1.5} />
            <div className="text-sm font-medium">Поток не настроен</div>
          </div>
          {canManage ? (
            <SettingsForm initialUrl="" onCancel={null} onSaved={setStreamUrl} />
          ) : (
            <p className="text-sm text-premium-text/50">Настраивается Founder/Developer.</p>
          )}
        </div>
      )}

      {!editingSettings && streamUrl && (
        <div className="relative mb-6 max-w-3xl space-y-3">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-premium-border bg-black">
            {streamError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 text-premium-text/60">
                <WifiOff className="h-8 w-8" strokeWidth={1.5} />
                <div className="text-sm">Поток недоступен</div>
              </div>
            )}
            {isHls(streamUrl) ? (
              <video ref={videoRef} className="h-full w-full" autoPlay muted playsInline crossOrigin="anonymous" />
            ) : (
              // eslint-disable-next-line jsx-a11y/alt-text
              <img
                ref={imgRef}
                src={streamUrl}
                crossOrigin="anonymous"
                onError={() => setStreamError(true)}
                onLoad={() => setStreamError(false)}
                className="h-full w-full object-contain"
              />
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleScreenshot}
              disabled={savingShot || streamError}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-premium-gold px-4 py-2 text-sm font-medium text-premium-bg hover:bg-premium-gold-hi disabled:opacity-40"
            >
              <Camera size={15} /> {savingShot ? 'Сохраняем…' : 'Скриншот'}
            </button>
            {shotError && <div className="text-sm text-red-400">{shotError}</div>}
          </div>
        </div>
      )}

      <div className="relative max-w-3xl">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold italic text-premium-text">
          <Video size={16} className="text-premium-gold-hi" /> Сохранённые кадры
        </h2>
        {loadingShots && (
          <div className="overflow-hidden rounded-xl border border-premium-border bg-premium-surface">
            <SkeletonRows />
          </div>
        )}
        {!loadingShots && screenshots.length === 0 && (
          <div className="rounded-xl border border-premium-border bg-premium-surface px-4 py-6 text-center text-sm text-premium-text/40">
            Скриншотов ещё нет.
          </div>
        )}
        {!loadingShots && screenshots.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {screenshots.map((shot) => (
              <a
                key={shot.id}
                href={shot['изображение']}
                download={`screenshot-${shot.id}.png`}
                className="group overflow-hidden rounded-xl border border-premium-border bg-premium-surface"
              >
                <img src={shot['изображение']} alt="" className="aspect-video w-full object-cover" />
                <div className="p-2 text-xs text-premium-text/50">
                  <div className="truncate text-premium-text/70">{shot['ФИО сотрудника']}</div>
                  <div>{formatDate(shot['дата'])}</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
