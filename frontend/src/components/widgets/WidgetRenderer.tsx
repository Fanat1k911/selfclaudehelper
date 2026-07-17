import type { WidgetCatalogItem } from '../../types'
import { BarWidget } from './BarWidget'
import { DonutWidget } from './DonutWidget'
import { LineWidget } from './LineWidget'
import { ListWidget } from './ListWidget'
import { StatWidget } from './StatWidget'

export function WidgetRenderer({ widget, data }: { widget: WidgetCatalogItem; data: unknown }) {
  if (data === undefined) {
    return <div className="flex h-full items-center justify-center text-sm text-premium-text-muted">Загрузка…</div>
  }
  switch (widget.kind) {
    case 'list':
      return <ListWidget widgetKey={widget.key} data={data} />
    case 'bar':
      return <BarWidget widgetKey={widget.key} data={data} />
    case 'line':
      return <LineWidget widgetKey={widget.key} data={data} />
    case 'donut':
      return <DonutWidget widgetKey={widget.key} data={data} />
    case 'stat':
      return <StatWidget widgetKey={widget.key} data={data} />
    default:
      return null
  }
}
