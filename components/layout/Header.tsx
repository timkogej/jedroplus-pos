'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface HeaderProps {
  slug: string
  title: string
  fursStatus?: 'online' | 'offline' | 'unknown'
  action?: React.ReactNode
}

export default function Header({ slug, title, fursStatus = 'unknown', action }: HeaderProps) {
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const fursColors = {
    online: 'bg-green-400',
    offline: 'bg-red-400',
    unknown: 'bg-amber-400',
  }
  const fursLabels = {
    online: 'FURS: povezano',
    offline: 'FURS: nedosegljivo',
    unknown: 'FURS: preverjam...',
  }

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
      <div className="flex items-center justify-between px-4 md:px-6 h-14">
        <div className="flex items-center gap-3">
          {/* Mobile logo */}
          <Link href={`/${slug}/dashboard`} className="md:hidden">
            <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
                <path d="M16 4V28M4 16H28" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
              </svg>
            </div>
          </Link>
          <h1 className="text-base font-semibold text-gray-900">{title}</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* FURS status — always visible, compact on mobile */}
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${fursColors[fursStatus]} animate-pulse`} title={fursLabels[fursStatus]} />
            <span className="hidden sm:inline text-xs text-gray-500">{fursLabels[fursStatus]}</span>
          </div>

          {action}

          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-gray-700 transition-colors p-1"
            title="Odjava"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
