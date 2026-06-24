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
      className={`bg-white rounded-2xl border border-gray-100 ${onClick ? 'cursor-pointer hover:border-gray-200 transition-colors' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
