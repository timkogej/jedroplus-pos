'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useCompany } from '@/components/layout/CompanyContext'

/**
 * True when it is past 18:00 and today's Z-report (dnevni zaključek) has not
 * been made yet — drives the red dot in the menus.
 */
export function useZReportWarning(): boolean {
  const pathname = usePathname()
  const company = useCompany()
  const [warning, setWarning] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      if (new Date().getHours() < 18) return
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const { data: report } = await supabase
        .from('pos_z_reports')
        .select('id')
        .eq('company_id', company.id)
        .eq('report_date', today)
        .maybeSingle()
      if (!cancelled) setWarning(!report)
    }
    check()
    return () => { cancelled = true }
  }, [pathname, company.id])

  return warning
}
