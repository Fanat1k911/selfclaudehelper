import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { DashboardData } from '../types'

function formatDate(value: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU')
}

const TX_LABEL: Record<string, string> = {
  'приход': 'Приход',
  'расход': 'Расход',
  'корректировка': 'Корректировка',
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<DashboardData>('/dashboard')
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="px-8 py-6 text-ink/40">Загрузка…</div>
  }

  if (!data) {
    return <div className="px-8 py-6 text-ink/40">Не удалось загрузить дашборд.</div>
  }

  return (
    <div className="px-8 py-6 space-y-6">
      <h1 className="text-2xl font-semibold text-ink">Дашборд</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
          <div className="text-xs text-ink/50 mb-1">Всего ингредиентов</div>
          <div className="text-2xl font-semibold text-ink">{data['всего_ингредиентов']}</div>
        </div>
        <div className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
          <div className="text-xs text-ink/50 mb-1">Ниже минимума</div>
          <div className="text-2xl font-semibold text-red-600">{data['ниже_минимума'].length}</div>
        </div>
        <div className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
          <div className="text-xs text-ink/50 mb-1">Записей в топ-расходе</div>
          <div className="text-2xl font-semibold text-ink">{data['топ_расход'].length}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-ink/10 bg-white shadow-sm">
          <div className="border-b border-ink/10 px-4 py-3 font-medium text-ink">Ниже минимума</div>
          <div className="divide-y divide-ink/5">
            {data['ниже_минимума'].length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-ink/40">Всё в порядке.</div>
            )}
            {data['ниже_минимума'].map((item) => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-ink">{item['название']}</span>
                <span className="text-red-600 font-medium">
                  {item['остаток']} / {item['мин.остаток']} {item['ед.измерения']}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-ink/10 bg-white shadow-sm">
          <div className="border-b border-ink/10 px-4 py-3 font-medium text-ink">Топ расхода</div>
          <div className="divide-y divide-ink/5">
            {data['топ_расход'].length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-ink/40">Нет данных по расходу.</div>
            )}
            {data['топ_расход'].map((item) => (
              <div key={item.material_id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-ink">{item['название']}</span>
                <span className="text-ink/60">
                  {item['кол-во']} {item['ед.измерения']}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-ink/10 bg-white shadow-sm">
        <div className="border-b border-ink/10 px-4 py-3 font-medium text-ink">Последние движения</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-ink/50">
              <th className="px-4 py-2 font-medium">Дата</th>
              <th className="px-4 py-2 font-medium">Ингредиент</th>
              <th className="px-4 py-2 font-medium">Тип</th>
              <th className="px-4 py-2 font-medium text-right">Кол-во</th>
              <th className="px-4 py-2 font-medium">Комментарий</th>
            </tr>
          </thead>
          <tbody>
            {data['последние_движения'].length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink/40">
                  Движений пока нет.
                </td>
              </tr>
            )}
            {data['последние_движения'].map((tx) => (
              <tr key={tx.id} className="border-b border-ink/5 last:border-0">
                <td className="px-4 py-2 text-ink/50">{formatDate(tx['дата'])}</td>
                <td className="px-4 py-2 text-ink">{tx['название']}</td>
                <td className="px-4 py-2 text-ink/60">{TX_LABEL[tx['тип']] ?? tx['тип']}</td>
                <td className="px-4 py-2 text-right font-medium">{tx['кол-во']}</td>
                <td className="px-4 py-2 text-ink/50">{tx['комментарий']}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
