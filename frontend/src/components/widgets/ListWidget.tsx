import type {
  DashboardEvent,
  DashboardLowStockItem,
  DashboardTransaction,
  LeaderboardRow,
  TopProduct,
} from '../../types'

function formatDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU')
}

function formatDateTime(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.toLocaleDateString('ru-RU')} ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
}

function LowStockRows({ rows }: { rows: DashboardLowStockItem[] }) {
  if (rows.length === 0) return <Empty text="Все остатки в норме." />
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li
          key={r.id}
          className={`text-sm ${i < rows.length - 1 ? 'border-b border-premium-border/60 pb-2' : ''}`}
        >
          <div className="truncate text-premium-text">{r['название']}</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="font-medium text-red-400">
              остаток {r['остаток']} {r['ед.измерения']}
            </span>
            <span className="text-xs text-premium-text-muted">
              · мин. {r['мин.остаток']} {r['ед.измерения']}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function RecentTransactionRows({ rows }: { rows: DashboardTransaction[] }) {
  if (rows.length === 0) return <Empty text="Движений пока нет." />
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li
          key={r.id}
          className={`text-sm ${i < rows.length - 1 ? 'border-b border-premium-border/60 pb-2' : ''}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-premium-text">{r['название']}</span>
            <span className={`shrink-0 font-medium ${r['тип'] === 'расход' ? 'text-red-400' : 'text-premium-text'}`}>
              {r['тип'] === 'расход' ? '-' : '+'}
              {r['кол-во']} {r['ед.измерения']}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-premium-text-muted">{formatDate(r['дата'])}</div>
        </li>
      ))}
    </ul>
  )
}

function TopProductRows({ rows }: { rows: TopProduct[] }) {
  if (rows.length === 0) return <Empty text="Продаж пока нет." />
  return (
    <ol className="space-y-1.5">
      {rows.map((r, i) => (
        <li key={r.product_id} className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate text-premium-text">
            {i + 1}. {r['название']}
          </span>
          <span className="shrink-0 font-medium text-premium-text">{r['кол-во']}</span>
        </li>
      ))}
    </ol>
  )
}

function LeaderboardRows({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length === 0) return <Empty text="Производства в этом месяце ещё не было." />
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.worker_id} className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate text-premium-text">{r['ФИО']}</span>
          <span className="shrink-0 text-premium-text-muted">
            <span className="font-medium text-premium-text">{r['сегодня']}</span> сегодня ·{' '}
            <span className="font-medium text-premium-text">{r['месяц']}</span> за месяц
          </span>
        </li>
      ))}
    </ul>
  )
}

function RecentEventRows({ rows }: { rows: DashboardEvent[] }) {
  if (rows.length === 0) return <Empty text="Событий пока нет." />
  return (
    <ul className="space-y-1.5">
      {rows.map((r, i) => (
        <li key={i} className="flex items-center justify-between gap-2 text-sm">
          <span className="min-w-0 truncate text-premium-text">{r['текст']}</span>
          <span className="shrink-0 text-premium-text-muted">{formatDateTime(r['время'])}</span>
        </li>
      ))}
    </ul>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="py-4 text-center text-sm text-premium-text-muted">{text}</div>
}

export function ListWidget({ widgetKey, data }: { widgetKey: string; data: unknown }) {
  switch (widgetKey) {
    case 'low_stock':
      return <LowStockRows rows={data as DashboardLowStockItem[]} />
    case 'recent_transactions':
      return <RecentTransactionRows rows={data as DashboardTransaction[]} />
    case 'top_products':
      return <TopProductRows rows={data as TopProduct[]} />
    case 'production_leaderboard':
      return <LeaderboardRows rows={data as LeaderboardRow[]} />
    case 'recent_events':
      return <RecentEventRows rows={data as DashboardEvent[]} />
    default:
      return <Empty text="Нет отрисовки для этого виджета." />
  }
}
