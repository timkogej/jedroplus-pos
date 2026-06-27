'use client'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface RevenuePoint {
  /** ISO date (YYYY-MM-DD) */
  date: string
  /** Short label shown on the X axis, e.g. "27.6." */
  label: string
  total: number
  count: number
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: RevenuePoint }> }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="bg-gray-900 text-white rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-medium">{new Date(point.date).toLocaleDateString('sl-SI', { day: 'numeric', month: 'long' })}</p>
      <p className="text-gray-200 mt-0.5">{point.total.toFixed(2)} €</p>
      <p className="text-gray-400">{point.count} {point.count === 1 ? 'račun' : 'računov'}</p>
    </div>
  )
}

export default function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const hasRevenue = data.some((d) => d.total > 0)

  if (!hasRevenue) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-gray-400">
        Ni prometa v zadnjih 30 dneh
      </div>
    )
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6D5EF7" />
              <stop offset="100%" stopColor="#2F80ED" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(v) => `${v} €`}
          />
          <Tooltip cursor={{ fill: 'rgba(109,94,247,0.06)' }} content={<ChartTooltip />} />
          <Bar dataKey="total" fill="url(#revenueGradient)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
