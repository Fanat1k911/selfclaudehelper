import { useState } from 'react'

const ZOOM_STEPS = [1, 2, 3]

// Полноэкранный просмотр вложения (2026-07-27, запрос Александра) — открывать
// window.open(dataURL) не сработало: браузеры блокируют data:-навигацию в новой вкладке
// как потенциальный фишинг/малварь-вектор, отдают about:blank вместо картинки. Модалка в
// том же окне + ручной зум: ЛКМ — шаг вперёд по ZOOM_STEPS (1×→2×→3×→1×), ПКМ — шаг назад,
// с preventDefault, чтобы не всплывало браузерное контекстное меню поверх картинки.
export function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [zoomIndex, setZoomIndex] = useState(0)
  const zoom = ZOOM_STEPS[zoomIndex]

  function zoomIn() {
    setZoomIndex((i) => (i + 1) % ZOOM_STEPS.length)
  }

  function zoomOut(e: React.MouseEvent) {
    e.preventDefault()
    setZoomIndex((i) => (i - 1 + ZOOM_STEPS.length) % ZOOM_STEPS.length)
  }

  return (
    <div
      className="backdrop-fade-in fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black/70 p-4"
      onClick={onClose}
    >
      <img
        src={src}
        alt=""
        onClick={(e) => {
          e.stopPropagation()
          zoomIn()
        }}
        onContextMenu={(e) => {
          e.stopPropagation()
          zoomOut(e)
        }}
        style={{ transform: `scale(${zoom})` }}
        className="modal-pop-in max-h-full max-w-full cursor-zoom-in rounded-lg object-contain transition-transform"
      />
    </div>
  )
}
