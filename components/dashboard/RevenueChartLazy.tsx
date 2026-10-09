'use client'
import dynamic from 'next/dynamic'
import type { RevenuePoint } from '@/components/dashboard/RevenueChart'

// The chart library is large; load it after the page is already usable.
const RevenueChart = dynamic(() => import('@/components/dashboard/RevenueChart'), {
  ssr: false,
  loading: () => <div className="h-44 w-full animate-pulse rounded-xl bg-gray-50" aria-hidden="true" />,
})

export default function RevenueChartLazy({ data }: { data: RevenuePoint[] }) {
  return <RevenueChart data={data} />
}
