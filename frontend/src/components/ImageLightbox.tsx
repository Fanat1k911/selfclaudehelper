import { useState } from 'react'

const ZOOM_STEPS = [1, 2, 3]

// Полноэкранный просмотр вложения (2026-07-27, запрос Александра) — открывать
// window.open(dataURL) не сработало: браузеры блокируют data:-навигацию в новой вкладке
// как потенциальный фишинг/малварь-вектор, отдают about:blank вместо картинки.
//
// Первая версия зума через CSS transform: scale() выглядела сломанной у Александра —
// картинка открывалась не по центру и не увеличивалась по клику. Переписано на явную
// ширину в пикселях (naturalWidth × коэффициент зума) вместо transform — так поведение
// не зависит от того, как flex/overflow контейнер трактует масштабированный по transform
// элемент, при zoom=1 картинка просто вписана в 90vw/90vh, при клике переключаем на
// фиксированный px-размер и снимаем ограничения, внешний div со scroll даёт долистать
// до краёв увеличенной картинки.
export function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [zoomIndex, setZoomIndex] = useState(0)
  const [naturalWidth, setNaturalWidth] = useState<number | null>(null)
  const zoom = ZOOM_STEPS[zoomIndex]

  function zoomIn() {
    setZoomIndex((i) => (i + 1) % ZOOM_STEPS.length)
  }

  function zoomOut() {
    setZoomIndex((i) => (i - 1 + ZOOM_STEPS.length) % ZOOM_STEPS.length)
  }

  const imgStyle =
    zoom === 1 || naturalWidth === null
      ? { maxWidth: '90vw', maxHeight: '90vh' }
      : { width: naturalWidth * zoom, maxWidth: 'none', height: 'auto' }

  return (
    <div
      className="backdrop-fade-in fixed inset-0 z-50 overflow-auto bg-black/70 p-4"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center">
        <img
          src={src}
          alt=""
          onLoad={(e) => setNaturalWidth(e.currentTarget.naturalWidth)}
          onClick={(e) => {
            e.stopPropagation()
            zoomIn()
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            zoomOut()
          }}
          style={imgStyle}
          className="modal-pop-in cursor-zoom-in rounded-lg object-contain"
        />
      </div>
    </div>
  )
}
