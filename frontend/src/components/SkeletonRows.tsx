// Скелетон вместо голого "Загрузка…" (2026-07-22, /redesign-existing-projects: "no
// loading states, replace spinners with skeleton loaders matching the layout shape") —
// анимация через opacity (GPU-accelerated, не top/left), уважает prefers-reduced-motion
// (см. .skeleton-pulse в index.css).
export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="skeleton-pulse h-11 rounded-lg bg-premium-surface-2"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  )
}
