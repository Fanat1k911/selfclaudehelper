import { Camera, Cpu, Wifi, WifiOff } from 'lucide-react'
import { usePremiumBackground } from '../lib/usePremiumBackground'

const KNOWN_CAMERA = {
  brand: 'Hunter',
  model: 'HN-B45IR (2.8)',
  type: 'Аналоговая/AHD (не IP)',
  power: '12В DC',
  note: 'Коаксиальный видеовыход + отдельное питание — не RJ45/PoE.',
}

export function SurveillancePage() {
  usePremiumBackground()
  return (
    <div className="relative min-h-full overflow-hidden bg-premium-bg px-4 py-4 sm:px-8 sm:py-6">
      <div className="premium-grain" aria-hidden />
      <div className="relative mb-6">
        <h1 className="font-display text-xl font-semibold italic text-premium-text sm:text-2xl">Видеонаблюдение</h1>
        <p className="mt-1 text-sm text-premium-text/50">Раздел в разработке — пока камера не подключена к системе.</p>
      </div>

      {/* Заглушка плеера — реального потока ещё нет, см. блок ниже почему */}
      <div className="relative mb-6 flex aspect-video w-full max-w-3xl flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-premium-border bg-premium-surface text-premium-text/40">
        <WifiOff className="h-10 w-10" strokeWidth={1.5} />
        <div className="text-sm font-medium">Камера не подключена</div>
      </div>

      <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-2 lg:max-w-3xl">
        <div className="rounded-xl border border-premium-border bg-premium-surface p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-premium-text">
            <Camera className="h-4 w-4 text-premium-gold-hi" />
            Что известно о камере
          </div>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-premium-text/50">Бренд</dt>
              <dd className="text-premium-text">{KNOWN_CAMERA.brand}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-premium-text/50">Модель</dt>
              <dd className="text-premium-text">{KNOWN_CAMERA.model}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-premium-text/50">Тип сигнала</dt>
              <dd className="text-premium-text">{KNOWN_CAMERA.type}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-premium-text/50">Питание</dt>
              <dd className="text-premium-text">{KNOWN_CAMERA.power}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-premium-text/40">{KNOWN_CAMERA.note}</p>
        </div>

        <div className="rounded-xl border border-premium-border bg-premium-surface p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-premium-text">
            <Cpu className="h-4 w-4 text-premium-gold-hi" />
            Что нужно дальше
          </div>
          <ul className="space-y-2 text-sm text-premium-text/70">
            <li className="flex gap-2">
              <Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0 text-premium-text/30" />
              Аналоговая камера сама в сеть не отдаёт поток — нужен AHD-регистратор
              (DVR) с сетевым выходом, или замена на IP-камеру с ONVIF/RTSP.
            </li>
            <li className="flex gap-2">
              <Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0 text-premium-text/30" />
              Если появится DVR — нужна модель и наличие сетевого порта
              (Ethernet), чтобы понять, отдаёт ли он RTSP/есть ли облачный сервис.
            </li>
            <li className="flex gap-2">
              <Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0 text-premium-text/30" />
              При удалённом хостинге (Render) камера/DVR должны быть доступны
              из интернета — локальная сеть за роутером без доп. настройки не подойдёт.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
