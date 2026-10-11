type Variant = 'error' | 'warning' | 'info' | 'success'

const STYLE: Record<Variant, { box: string; title: string; body: string; icon: string; path: string }> = {
  error: {
    box: 'border-red-200 bg-red-50',
    title: 'text-red-900',
    body: 'text-red-800',
    icon: 'text-red-500',
    path: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
  },
  warning: {
    box: 'border-amber-200 bg-amber-50',
    title: 'text-amber-900',
    body: 'text-amber-800',
    icon: 'text-amber-500',
    path: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  },
  info: {
    box: 'border-blue-200 bg-blue-50',
    title: 'text-blue-900',
    body: 'text-blue-800',
    icon: 'text-blue-500',
    path: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z',
  },
  success: {
    box: 'border-green-200 bg-green-50',
    title: 'text-green-900',
    body: 'text-green-800',
    icon: 'text-green-600',
    path: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
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
        <svg className={`mt-0.5 h-5 w-5 flex-shrink-0 ${s.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d={s.path} />
        </svg>
        <div className="min-w-0 text-sm">
          {title && <p className={`font-semibold ${s.title}`}>{title}</p>}
          {children && <div className={`${title ? 'mt-0.5' : ''} ${s.body}`}>{children}</div>}
        </div>
      </div>
      {action && <div className="flex flex-shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}
