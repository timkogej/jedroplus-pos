import Icon, { type IconName } from '@/components/ui/Icon'

type Variant = 'error' | 'warning' | 'info' | 'success'

const STYLE: Record<Variant, { box: string; title: string; body: string; icon: string; name: IconName }> = {
  error: {
    box: 'border-red-200 bg-red-50',
    title: 'text-red-900',
    body: 'text-red-800',
    icon: 'text-red-500',
    name: 'alertCircle',
    
  },
  warning: {
    box: 'border-amber-200 bg-amber-50',
    title: 'text-amber-900',
    body: 'text-amber-800',
    icon: 'text-amber-500',
    name: 'alertTriangle',
    
  },
  info: {
    box: 'border-blue-200 bg-blue-50',
    title: 'text-blue-900',
    body: 'text-blue-800',
    icon: 'text-blue-500',
    name: 'infoCircle',
    
  },
  success: {
    box: 'border-green-200 bg-green-50',
    title: 'text-green-900',
    body: 'text-green-800',
    icon: 'text-green-600',
    name: 'checkCircle2',
    
  },
}

/**
 * One look for every notice: error, warning, info, success. Colours meet text
 * contrast (dark text on a light tint), the icon never carries the meaning alone
 * (there is always text), and errors/warnings are announced to screen readers.
 */
export default function Alert({
  variant = 'info',
  title,
  action,
  className = '',
  children,
}: {
  variant?: Variant
  title?: string
  /** A button or link shown on the right (below the text on phones). */
  action?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) {
  const s = STYLE[variant]
  return (
    <div
      role={variant === 'error' || variant === 'warning' ? 'alert' : 'status'}
      className={`flex flex-col gap-3 rounded-xl border p-3.5 sm:flex-row sm:items-center sm:justify-between ${s.box} ${className}`}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon name={s.name} className={`mt-0.5 h-5 w-5 flex-shrink-0 ${s.icon}`} />
        <div className="min-w-0 text-sm">
          {title && <p className={`font-semibold ${s.title}`}>{title}</p>}
          {children && <div className={`${title ? 'mt-0.5' : ''} ${s.body}`}>{children}</div>}
        </div>
      </div>
      {action && <div className="flex flex-shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}
