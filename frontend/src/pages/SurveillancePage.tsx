import { Camera, Cpu, Wifi, WifiOff } from 'lucide-react'

const KNOWN_CAMERA = {
  brand: 'Hunter',
  model: 'HN-B45IR (2.8)',
  type: 'Аналоговая/AHD (не IP)',
  power: '12В DC',
  note: 'Коаксиальный видеовыход + отдельное питание — не RJ45/PoE.',
}

export function SurveillancePage() {
  return (
    <div className="px-4 py-4 sm:px-8 sm:py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Видеонаблюдение</h1>
        <p className="mt-1 text-sm text-ink/50">Раздел в разработке — пока камера не подключена к системе.</p>
      </div>

      {/* Заглушка плеера — реального потока ещё нет, см. блок ниже почему */}
      <div className="mb-6 flex aspect-video w-full max-w-3xl flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-ink/20 bg-ink/[0.02] text-ink/40">
        <WifiOff className="h-10 w-10" strokeWidth={1.5} />
        <div className="text-sm font-medium">Камера не подключена</div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:max-w-3xl">
        <div className="rounded-xl border border-ink/10 bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <Camera className="h-4 w-4 text-terracotta" />
            Что известно о камере
          </div>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink/50">Бренд</dt>
              <dd className="text-ink">{KNOWN_CAMERA.brand}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink/50">Модель</dt>
              <dd className="text-ink">{KNOWN_CAMERA.model}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink/50">Тип сигнала</dt>
              <dd className="text-ink">{KNOWN_CAMERA.type}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink/50">Питание</dt>
              <dd className="text-ink">{KNOWN_CAMERA.power}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink/40">{KNOWN_CAMERA.note}</p>
        </div>

        <div className="rounded-xl border border-ink/10 bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <Cpu className="h-4 w-4 text-terracotta" />
            Что нужно дальше
          </div>
          <ul className="space-y-2 text-sm text-ink/70">
            <li className="flex gap-2">
              <Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/30" />
              Аналоговая камера сама в сеть не отдаёт поток — нужен AHD-регистратор
              (DVR) с сетевым выходом, или замена на IP-камеру с ONVIF/RTSP.
            </li>
            <li className="flex gap-2">
              <Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/30" />
              Если появится DVR — нужна модель и наличие сетевого порта
              (Ethernet), чтобы понять, отдаёт ли он RTSP/есть ли облачный сервис.
            </li>
            <li className="flex gap-2">
              <Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/30" />
              При удалённом хостинге (Render) камера/DVR должны быть доступны
              из интернета — локальная сеть за роутером без доп. настройки не подойдёт.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
