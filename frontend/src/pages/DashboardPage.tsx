import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { DashboardData, DashboardKpiRow, DashboardSpend, TopProduct } from '../types'

function formatDate(value: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU')
}

function formatMoney(value: number) {
  return `${value.toLocaleString('ru-RU')} ₽`
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  const label = new Date(y, m - 1, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

const TX_LABEL: Record<string, string> = {
  'приход': 'Приход',
  'расход': 'Расход',
  'корректировка': 'Корректировка',
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [kpi, setKpi] = useState<DashboardKpiRow[]>([])
  const [loading, setLoading] = useState(true)

  const [spend, setSpend] = useState<DashboardSpend | null>(null)
  const [spendLoading, setSpendLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  function loadSpend(from: string, to: string) {
    setSpendLoading(true)
    const params = new URLSearchParams()
    if (from) params.set('date_from', from)
    if (to) params.set('date_to', to)
    const qs = params.toString()
    apiFetch<DashboardSpend>(`/dashboard/spend${qs ? `?${qs}` : ''}`)
      .then(setSpend)
      .finally(() => setSpendLoading(false))
  }

  useEffect(() => {
    Promise.all([
      apiFetch<DashboardData>('/dashboard'),
      apiFetch<TopProduct[]>('/sales/top'),
      apiFetch<DashboardKpiRow[]>('/dashboard/kpi'),
    ])
      .then(([dashboard, top, kpiRows]) => {
        setData(dashboard)
        setTopProducts(top)
        setKpi(kpiRows)
      })
      .finally(() => setLoading(false))
    loadSpend('', '')
  }, [])

  const kpiSorted = [...kpi].sort(
    (a, b) => b['месяц'].localeCompare(a['месяц']) || a['ФИО'].localeCompare(b['ФИО']),
  )

  if (loading) {
    return <div className="px-4 py-4 text-ink/40 sm:px-8 sm:py-6">Загрузка…</div>
  }

  if (!data) {
    return <div className="px-4 py-4 text-ink/40 sm:px-8 sm:py-6">Не удалось загрузить дашборд.</div>
  }

  return (
    <div className="space-y-6 px-4 py-4 sm:px-8 sm:py-6">
      <h1 className="text-xl font-semibold text-ink sm:text-2xl">Дашборд</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
          <div className="text-xs text-ink/50 mb-1">Всего компонентов</div>
          <div className="text-2xl font-semibold text-ink">{data['всего_компонентов']}</div>
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-ink/10 bg-white shadow-sm">
          <div className="border-b border-ink/10 px-4 py-3 font-medium text-ink">Ниже минимума</div>
          <div className="divide-y divide-ink/5">
            {data['ниже_минимума'].length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-ink/40">Всё в порядке.</div>
            )}
            {data['ниже_минимума'].map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="truncate text-ink">{item['название']}</span>
                <span className="shrink-0 font-medium text-red-600">
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
              <div key={item.material_id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="truncate text-ink">{item['название']}</span>
                <span className="shrink-0 text-ink/60">
                  {item['кол-во']} {item['ед.измерения']}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-ink/10 bg-white shadow-sm">
          <div className="border-b border-ink/10 px-4 py-3 font-medium text-ink">Топ продукта</div>
          <div className="divide-y divide-ink/5">
            {topProducts.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-ink/40">Нет данных по отгрузке.</div>
            )}
            {topProducts.map((item, i) => (
              <div key={item.product_id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="truncate text-ink">
                  <span className="mr-2 text-ink/40">{i + 1}.</span>
                  {item['название']}
                </span>
                <span className="shrink-0 text-ink/60">{item['кол-во']} шт</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-ink/10 bg-white shadow-sm">
        <div className="border-b border-ink/10 px-4 py-3 font-medium text-ink">Последние движения</div>

        <div className="space-y-2 p-3 md:hidden">
          {data['последние_движения'].length === 0 && (
            <div className="px-1 py-4 text-center text-sm text-ink/40">Движений пока нет.</div>
          )}
          {data['последние_движения'].map((tx) => (
            <div key={tx.id} className="rounded-lg border border-ink/10 p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="truncate text-sm font-medium text-ink">{tx['название']}</span>
                <span className="shrink-0 text-sm font-semibold text-ink">{tx['кол-во']}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-ink/50">
                <span>{TX_LABEL[tx['тип']] ?? tx['тип']}</span>
                <span>{formatDate(tx['дата'])}</span>
              </div>
              {tx['комментарий'] && <div className="mt-1 truncate text-xs text-ink/50">{tx['комментарий']}</div>}
            </div>
          ))}
        </div>

        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b border-ink/10 text-left text-ink/50">
              <th className="px-4 py-2 font-medium">Дата</th>
              <th className="px-4 py-2 font-medium">Компонент</th>
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

      <div className="rounded-xl border border-ink/10 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-4 py-3">
          <span className="font-medium text-ink">Траты (закупка сырья)</span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-ink/10 bg-white px-2 py-1.5 text-sm outline-none focus:border-terracotta"
            />
            <span className="text-ink/40">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-ink/10 bg-white px-2 py-1.5 text-sm outline-none focus:border-terracotta"
            />
            <button
              onClick={() => loadSpend(dateFrom, dateTo)}
              className="rounded-lg bg-terracotta px-3 py-1.5 text-sm font-medium text-white hover:bg-terracotta-dark"
            >
              Применить
            </button>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setDateFrom('')
                  setDateTo('')
                  loadSpend('', '')
                }}
                className="rounded-lg border border-ink/10 px-3 py-1.5 text-sm text-ink/60 hover:bg-cream"
              >
                Сброс
              </button>
            )}
          </div>
        </div>

        {spendLoading && <div className="px-4 py-6 text-center text-sm text-ink/40">Загрузка…</div>}

        {!spendLoading && spend && (
          <>
            <div className="px-4 py-3 text-2xl font-semibold text-ink">{formatMoney(spend['всего'])}</div>

            <div className="grid grid-cols-1 gap-0 md:grid-cols-2 md:divide-x md:divide-ink/5">
              <div>
                <div className="px-4 py-2 text-xs font-medium text-ink/50">По месяцам</div>
                <div className="divide-y divide-ink/5">
                  {spend['по_месяцам'].length === 0 && (
                    <div className="px-4 py-6 text-center text-sm text-ink/40">Нет данных за период.</div>
                  )}
                  {spend['по_месяцам'].map((row) => (
                    <div key={row['месяц']} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                      <span className="text-ink">{monthLabel(row['месяц'])}</span>
                      <span className="shrink-0 font-medium text-ink">{formatMoney(row['сумма'])}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="px-4 py-2 text-xs font-medium text-ink/50">Топ материалов по тратам</div>
                <div className="divide-y divide-ink/5">
                  {spend['топ_материалов'].length === 0 && (
                    <div className="px-4 py-6 text-center text-sm text-ink/40">Нет данных за период.</div>
                  )}
                  {spend['топ_материалов'].map((row, i) => (
                    <div key={row.material_id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                      <span className="truncate text-ink">
                        <span className="mr-2 text-ink/40">{i + 1}.</span>
                        {row['название']}
                      </span>
                      <span className="shrink-0 text-ink/60">{formatMoney(row['сумма'])}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl border border-ink/10 bg-white shadow-sm">
        <div className="border-b border-ink/10 px-4 py-3 font-medium text-ink">КПД по производству</div>

        <div className="space-y-2 p-3 md:hidden">
          {kpiSorted.length === 0 && (
            <div className="px-1 py-4 text-center text-sm text-ink/40">Данных по производству пока нет.</div>
          )}
          {kpiSorted.map((row) => (
            <div key={`${row['месяц']}-${row.worker_id}`} className="rounded-lg border border-ink/10 p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="truncate text-sm font-medium text-ink">{row['ФИО']}</span>
                <span className="shrink-0 text-xs text-ink/50">{monthLabel(row['месяц'])}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-ink/50">
                <span>Партий: {row['партий']}</span>
                <span>Брак: {row['брак']}</span>
                <span className="font-medium text-ink">Произведено: {row['произведено']}</span>
              </div>
            </div>
          ))}
        </div>

        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b border-ink/10 text-left text-ink/50">
              <th className="px-4 py-2 font-medium">Месяц</th>
              <th className="px-4 py-2 font-medium">Сотрудник</th>
              <th className="px-4 py-2 font-medium text-right">Партий</th>
              <th className="px-4 py-2 font-medium text-right">Брак</th>
              <th className="px-4 py-2 font-medium text-right">Произведено</th>
            </tr>
          </thead>
          <tbody>
            {kpiSorted.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink/40">
                  Данных по производству пока нет.
                </td>
              </tr>
            )}
            {kpiSorted.map((row) => (
              <tr key={`${row['месяц']}-${row.worker_id}`} className="border-b border-ink/5 last:border-0">
                <td className="px-4 py-2 text-ink/50">{monthLabel(row['месяц'])}</td>
                <td className="px-4 py-2 text-ink">{row['ФИО']}</td>
                <td className="px-4 py-2 text-right">{row['партий']}</td>
                <td className="px-4 py-2 text-right">{row['брак']}</td>
                <td className="px-4 py-2 text-right font-medium">{row['произведено']}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
