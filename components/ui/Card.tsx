'use client'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export default function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${onClick ? 'cursor-pointer hover:border-gray-200 transition-colors' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
